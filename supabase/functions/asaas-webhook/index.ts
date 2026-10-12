import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const received = req.headers.get("asaas-access-token");
  if (!expected || !received || received.length !== expected.length) return Response.json({ ok: false }, { status: 401 });
  let matches = true;
  for (let i = 0; i < expected.length; i++) matches = matches && expected.charCodeAt(i) === received.charCodeAt(i);
  if (!matches) return Response.json({ ok: false }, { status: 401 });

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !service) return Response.json({ ok: false, error: "Server configuration incomplete" }, { status: 500 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  const eventType = typeof body?.event === "string" ? body.event : "";
  const paymentId = typeof body?.payment?.id === "string" ? body.payment.id : "";
  const providerStatus = typeof body?.payment?.status === "string" ? body.payment.status.toUpperCase() : "";
  const eventId = typeof body?.id === "string" ? body.id : null;
  if (!eventType || !paymentId) return Response.json({ ok: false, error: "Missing event/payment identifier" }, { status: 400 });

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  if (eventId) {
    const { data: prior, error } = await db.from("asaas_webhook_events").select("id,processed").eq("provider_event_id", eventId).maybeSingle();
    if (error) return Response.json({ ok: false }, { status: 500 });
    if (prior?.processed) return Response.json({ ok: true, duplicate: true });
  }

  const map: Record<string, string> = {
    PAYMENT_CREATED: "PENDING",
    PAYMENT_UPDATED: "PENDING",
    PAYMENT_CONFIRMED: "CONFIRMED",
    PAYMENT_RECEIVED: "RECEIVED",
    PAYMENT_OVERDUE: "OVERDUE",
    PAYMENT_REFUNDED: "REFUNDED",
    PAYMENT_PARTIALLY_REFUNDED: "REFUNDED",
    PAYMENT_DELETED: "CANCELLED",
    PAYMENT_RESTORED: "PENDING",
    PAYMENT_CHARGEBACK_REQUESTED: "UNKNOWN",
    PAYMENT_CHARGEBACK_DISPUTE: "UNKNOWN",
  };
  const newStatus = map[eventType];
  if (!newStatus) {
    const { error } = await db.from("asaas_webhook_events").upsert({
      provider_event_id: eventId, event_type: eventType, provider_payment_id: paymentId,
      provider_status: providerStatus || null, processed: true, processed_at: new Date().toISOString(),
    }, { onConflict: "provider_event_id", ignoreDuplicates: true });
    if (error) return Response.json({ ok: false }, { status: 500 });
    return Response.json({ ok: true, ignored: true });
  }

  const { data: localPayment, error: findError } = await db.from("asaas_subscription_payments")
    .select("id,association_id,subscription_id,billing_period,amount,resident_count,unit_price")
    .eq("provider_payment_id", paymentId).maybeSingle();
  if (findError) return Response.json({ ok: false }, { status: 500 });
  if (!localPayment) {
    const { error } = await db.from("asaas_webhook_events").upsert({
      provider_event_id: eventId, event_type: eventType, provider_payment_id: paymentId,
      provider_status: providerStatus || null, processed: false,
      processing_error: "Pagamento ainda não vinculado a um registro local",
    }, { onConflict: "provider_event_id", ignoreDuplicates: true });
    if (error) return Response.json({ ok: false }, { status: 500 });
    // 200 avoids endless retries; reconciliation can use this log.
    return Response.json({ ok: true, unmatched: true });
  }

  const paid = newStatus === "CONFIRMED" || newStatus === "RECEIVED";
  const now = new Date().toISOString();
  const { error: updateError } = await db.from("asaas_subscription_payments").update({
    status: newStatus, provider_status: providerStatus || newStatus,
    last_provider_event: eventType, updated_at: now, ...(paid ? { paid_at: now } : {}),
  }).eq("id", localPayment.id);
  if (updateError) return Response.json({ ok: false }, { status: 500 });

  if (paid) {
    const periodStart = localPayment.billing_period;
    const d = new Date(periodStart + "T00:00:00.000Z");
    d.setUTCMonth(d.getUTCMonth() + 1);
    const periodEnd = d.toISOString().slice(0, 10);
    const { error: subUpdateError } = await db.from("association_subscriptions").update({
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      member_count_at_last_billing: localPayment.resident_count,
      unit_price_at_last_billing: localPayment.unit_price,
      updated_at: now,
    }).eq("id", localPayment.subscription_id);
    if (subUpdateError) return Response.json({ ok: false }, { status: 500 });
  }

  const { error: eventError } = await db.from("asaas_webhook_events").upsert({
    provider_event_id: eventId, event_type: eventType, provider_payment_id: paymentId,
    provider_status: providerStatus || newStatus, processed: true, processed_at: now, processing_error: null,
  }, { onConflict: "provider_event_id", ignoreDuplicates: true });
  if (eventError) return Response.json({ ok: false }, { status: 500 });
  return Response.json({ ok: true });
});
