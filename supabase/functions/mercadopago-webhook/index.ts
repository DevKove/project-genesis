import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
async function verifySignature(secret: string, signature: string, requestId: string, dataId: string) {
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
  if (!parts.ts || !parts.v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected, parts.v1.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { ok: false });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceKey || !accessToken || !webhookSecret) return json(503, { ok: false, error: "Webhook não configurado." });

  try {
    const payload = await req.json();
    const url = new URL(req.url);
    const dataId = String(url.searchParams.get("data.id") || payload?.data?.id || "");
    const requestId = req.headers.get("x-request-id") || "";
    const signature = req.headers.get("x-signature") || "";
    if (!await verifySignature(webhookSecret, signature, requestId, dataId)) return json(401, { ok: false, error: "Assinatura inválida." });

    if (payload?.type !== "payment" && payload?.topic !== "payment") return json(200, { ok: true, ignored: true });
    if (!/^\d+$/.test(dataId)) return json(400, { ok: false, error: "ID de pagamento inválido." });

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mpPayment = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok || !mpPayment.id) return json(502, { ok: false, error: "Não foi possível consultar o pagamento no Mercado Pago." });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const paymentId = String(mpPayment.external_reference || "");
    if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return json(200, { ok: true, ignored: true });
    const { data: localPayment } = await admin.from("mercadopago_subscription_payments").select("*").eq("id", paymentId).maybeSingle();
    if (!localPayment) return json(200, { ok: true, ignored: true });
    const amountMatches = Math.abs(Number(mpPayment.transaction_amount) - Number(localPayment.amount)) < 0.01;
    if (mpPayment.currency_id !== "BRL" || !amountMatches || String(mpPayment.external_reference) !== localPayment.id) {
      return json(422, { ok: false, error: "Pagamento não corresponde à cobrança registrada." });
    }

    const providerStatus = String(mpPayment.status || "unknown");
    const eventKey = `${dataId}:${providerStatus}`;
    const { data: priorEvent } = await admin.from("mercadopago_webhook_events").select("id,processed").eq("provider_event_id", eventKey).maybeSingle();
    if (priorEvent?.processed) return json(200, { ok: true, duplicate: true });
    if (!priorEvent) {
      const { error: eventInsertError } = await admin.from("mercadopago_webhook_events").insert({
        provider_event_id: eventKey, provider_payment_id: dataId, provider_status: providerStatus, processed: false,
      });
      if (eventInsertError) {
        const { data: raced } = await admin.from("mercadopago_webhook_events").select("processed").eq("provider_event_id", eventKey).maybeSingle();
        if (raced?.processed) return json(200, { ok: true, duplicate: true });
        if (eventInsertError.code !== "23505") return json(500, { ok: false, error: "Não foi possível registrar o evento." });
      }
    }

    const mapStatus: Record<string, string> = { approved: "APPROVED", pending: "PENDING", in_process: "PENDING", rejected: "REJECTED", cancelled: "CANCELLED", refunded: "REFUNDED", charged_back: "REFUNDED" };
    const localStatus = mapStatus[providerStatus] || "PENDING";
    const paidAt = providerStatus === "approved" ? (mpPayment.date_approved || new Date().toISOString()) : null;
    const { error: updatePaymentError } = await admin.from("mercadopago_subscription_payments").update({
      provider_payment_id: String(mpPayment.id), provider_status: providerStatus, status: localStatus,
      paid_at: paidAt, updated_at: new Date().toISOString(),
    }).eq("id", localPayment.id);
    if (updatePaymentError) return json(500, { ok: false, error: "Não foi possível atualizar o pagamento." });

    if (providerStatus === "approved" && localPayment.status !== "APPROVED") {
      const { data: subscription } = await admin.from("association_subscriptions").select("id,status,current_period_end")
        .eq("id", localPayment.subscription_id).maybeSingle();
      if (subscription && !["cancelled", "suspended"].includes(subscription.status)) {
        const now = new Date();
        const priorEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
        const start = priorEnd && priorEnd > now ? priorEnd : now;
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);
        const { error: subscriptionUpdateError } = await admin.from("association_subscriptions").update({
          status: "active", payment_provider: "mercadopago",
          current_period_start: start.toISOString(), current_period_end: end.toISOString(),
          member_count_at_last_billing: localPayment.resident_count,
          unit_price_at_last_billing: localPayment.unit_price,
          updated_at: now.toISOString(),
        }).eq("id", localPayment.subscription_id);
        if (subscriptionUpdateError) return json(500, { ok: false, error: "Não foi possível atualizar a assinatura após o pagamento." });
      }
    }
    if (["refunded", "charged_back"].includes(providerStatus) && localPayment.status === "APPROVED") {
      const { error: revokeError } = await admin.from("association_subscriptions").update({
        status: "payment_required", current_period_end: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", localPayment.subscription_id).eq("status", "active");
      if (revokeError) return json(500, { ok: false, error: "Não foi possível atualizar a assinatura após o estorno." });
    }
    await admin.from("mercadopago_webhook_events").update({ processed: true, processed_at: new Date().toISOString() }).eq("provider_event_id", eventKey);
    return json(200, { ok: true });
  } catch (error) {
    console.error("mercadopago-webhook error", error instanceof Error ? error.message : "unknown");
    return json(500, { ok: false, error: "Erro interno no processamento da notificação." });
  }
});
