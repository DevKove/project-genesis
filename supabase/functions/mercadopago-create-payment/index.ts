import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "https://devkove.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return response(405, { ok: false, error: "Método não permitido." });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return response(401, { ok: false, error: "Autenticação obrigatória." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    return response(503, { ok: false, error: "Integração Mercado Pago ainda não configurada no servidor." });
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) return response(401, { ok: false, error: "Sessão inválida. Entre novamente." });

    const body = await req.json().catch(() => ({}));
    const associationId = typeof body.association_id === "string" ? body.association_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(associationId)) return response(400, { ok: false, error: "Associação inválida." });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: membership } = await admin.from("association_members").select("role")
      .eq("association_id", associationId).eq("user_id", userData.user.id)
      .in("role", ["admin", "presidente", "tesoureiro"]).maybeSingle();
    const { data: platformAdmin } = await admin.from("user_roles").select("user_id")
      .eq("user_id", userData.user.id).eq("role", "platform_admin").maybeSingle();
    if (!membership && !platformAdmin) return response(403, { ok: false, error: "Somente um responsável autorizado pode consultar a integração." });

    // Diagnóstico sem efeitos financeiros: valida o token consultando /users/me.
    // Este caminho não cria preferência, cobrança ou registro financeiro.
    if (body.action === "diagnostic") {
      const mpResponse = await fetch("https://api.mercadopago.com/users/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });
      const mpData = await mpResponse.json().catch(() => ({}));
      if (!mpResponse.ok || !mpData.id) {
        console.error("Mercado Pago diagnostic failed", { status: mpResponse.status, cause: mpData?.message ?? mpData?.error ?? "unknown" });
        return response(502, {
          ok: false,
          diagnostic: true,
          provider_status: mpResponse.status,
          error: mpResponse.status === 401 || mpResponse.status === 403
            ? "O Mercado Pago recusou a credencial configurada. Revise a credencial no servidor."
            : "Não foi possível validar a conta no Mercado Pago. Verifique a disponibilidade do provedor.",
        });
      }
      return response(200, {
        ok: true,
        diagnostic: true,
        provider: "Mercado Pago",
        account_id: String(mpData.id),
        country_id: typeof mpData.country_id === "string" ? mpData.country_id : null,
        site_id: typeof mpData.site_id === "string" ? mpData.site_id : null,
        credential_environment: accessToken.startsWith("TEST-") ? "teste" : accessToken.startsWith("APP_USR-") ? "produção" : "não identificado",
        message: "Credencial aceita pelo Mercado Pago. Nenhuma cobrança ou preferência foi criada.",
      });
    }

    const { data: subscription, error: subError } = await admin.from("association_subscriptions")
      .select("id,association_id,plan_code,status,trial_ends_at,current_period_end,billing_email")
      .eq("association_id", associationId).maybeSingle();
    if (subError || !subscription) return response(404, { ok: false, error: "Assinatura não encontrada para esta associação." });

    const now = new Date();
    if (subscription.status === "trialing" && new Date(subscription.trial_ends_at) > now) {
      return response(409, { ok: false, error: "Seu teste gratuito ainda está ativo. Nenhuma cobrança é necessária agora." });
    }
    if (subscription.status === "cancelled" || subscription.status === "suspended") {
      return response(409, { ok: false, error: "Esta assinatura não pode gerar cobrança. Entre em contato com o suporte." });
    }
    if (subscription.status === "active" && subscription.current_period_end && new Date(subscription.current_period_end) > now) {
      return response(409, { ok: false, error: "A assinatura está paga até o fim do período atual." });
    }

    const { data: plan, error: planError } = await admin.from("subscription_plans")
      .select("code,name,price_per_member_monthly").eq("code", subscription.plan_code).eq("active", true).single();
    if (planError || !plan) return response(409, { ok: false, error: "O plano atual não está disponível." });
    const { count, error: residentsError } = await admin.from("residents").select("id", { count: "exact", head: true })
      .eq("association_id", associationId).eq("is_active", true);
    if (residentsError) return response(500, { ok: false, error: "Não foi possível calcular os moradores ativos." });
    const residentCount = count ?? 0;
    const unitPrice = Number(plan.price_per_member_monthly);
    const amount = Math.round(residentCount * unitPrice * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return response(409, { ok: false, error: "O valor calculado é zero. Cadastre moradores ativos e confira o plano antes de pagar." });

    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const { data: existing } = await admin.from("mercadopago_subscription_payments").select("*")
      .eq("association_id", associationId).eq("billing_period", period).maybeSingle();
    if (existing?.status === "APPROVED") return response(409, { ok: false, error: "Já existe um pagamento aprovado para este mês." });
    if (existing?.status === "PENDING" && existing.checkout_url) {
      return response(200, { ok: true, checkout_url: existing.checkout_url, payment_id: existing.id, amount: existing.amount, reused: true });
    }

    let paymentId = existing?.id as string | undefined;
    if (!paymentId) {
      const { data: inserted, error: insertError } = await admin.from("mercadopago_subscription_payments").insert({
        association_id: associationId, subscription_id: subscription.id, billing_period: period,
        amount, resident_count: residentCount, unit_price: unitPrice, currency: "BRL",
        status: "PENDING", created_by: userData.user.id,
      }).select("id").single();
      if (insertError || !inserted) return response(500, { ok: false, error: "Não foi possível registrar a cobrança. Tente novamente." });
      paymentId = inserted.id;
    } else {
      const { error } = await admin.from("mercadopago_subscription_payments").update({
        amount, resident_count: residentCount, unit_price: unitPrice, status: "PENDING",
        provider_payment_id: null, provider_preference_id: null, checkout_url: null,
        provider_status: null, updated_at: new Date().toISOString(),
      }).eq("id", paymentId);
      if (error) return response(500, { ok: false, error: "Não foi possível preparar uma nova tentativa de pagamento." });
    }

    const siteUrl = "https://devkove.github.io/project-genesis/";
    const preferencePayload = {
      items: [{ id: plan.code, title: `Morada360 — Plano ${plan.name}`, description: `Mensalidade para ${residentCount} morador(es) ativo(s)`, quantity: 1, currency_id: "BRL", unit_price: amount }],
      payer: { email: subscription.billing_email },
      external_reference: paymentId,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      back_urls: { success: siteUrl, failure: siteUrl, pending: siteUrl },
      auto_return: "approved",
      statement_descriptor: "MORADA360",
      metadata: { payment_id: paymentId, association_id: associationId, subscription_id: subscription.id, billing_period: period, resident_count: residentCount },
    };
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": paymentId },
      body: JSON.stringify(preferencePayload),
    });
    const mpData = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok || !mpData.id || !(mpData.init_point || mpData.sandbox_init_point)) {
      await admin.from("mercadopago_subscription_payments").update({ status: "FAILED", provider_status: `preference_error_${mpResponse.status}`, updated_at: new Date().toISOString() }).eq("id", paymentId);
      return response(502, { ok: false, error: "O Mercado Pago não conseguiu gerar o checkout. Nenhuma cobrança foi confirmada." });
    }
    const checkoutUrl = accessToken.startsWith("TEST-") ? (mpData.sandbox_init_point || mpData.init_point) : mpData.init_point;
    await admin.from("mercadopago_subscription_payments").update({
      provider_preference_id: String(mpData.id), checkout_url: checkoutUrl, status: "PENDING",
      provider_status: "preference_created", updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    return response(200, { ok: true, checkout_url: checkoutUrl, payment_id: paymentId, amount, reused: false });
  } catch (error) {
    console.error("mercadopago-create-payment error", error instanceof Error ? error.message : "unknown");
    return response(500, { ok: false, error: "Erro interno ao preparar o pagamento." });
  }
});
