/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://devkove.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply({ ok: false, error: "Método não permitido." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://devkove.github.io") return reply({ ok: false, error: "Origem não autorizada." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const asaasKey = Deno.env.get("ASAAS_API_KEY");
  const asaasBase = (Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3").replace(/\/+$/, "");
  if (!supabaseUrl || !anonKey || !serviceKey || !asaasKey) return reply({ ok: false, error: "Configuração de faturamento incompleta no servidor." }, 500);
  // Sandbox-only rollout: production is deliberately blocked until end-to-end tests pass.
  if (new URL(asaasBase).hostname !== "api-sandbox.asaas.com") return reply({ ok: false, error: "A geração de cobranças está restrita ao Asaas Sandbox nesta etapa." }, 409);

  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ ok: false, error: "Sessão autenticada obrigatória." }, 401);
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return reply({ ok: false, error: "Sessão inválida ou expirada." }, 401);
  const userId = authData.user.id;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    admin.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profile?.account_status !== "approved" || !roleRows?.some((row: { role: string }) => row.role === "platform_admin")) {
    return reply({ ok: false, error: "Apenas administradores aprovados da plataforma podem gerar cobranças." }, 403);
  }

  let input: { association_id?: string; billing_type?: string; due_date?: string; billing_period?: string };
  try { input = await req.json(); } catch { return reply({ ok: false, error: "Corpo JSON inválido." }, 400); }
  const associationId = input.association_id;
  const billingType = input.billing_type;
  const dueDate = input.due_date;
  const billingPeriod = input.billing_period ?? "";
  if (!associationId || !/^[0-9a-f-]{36}$/i.test(associationId)) return reply({ ok: false, error: "Associação inválida." }, 400);
  if (billingType !== "PIX" && billingType !== "BOLETO") return reply({ ok: false, error: "Escolha Pix ou boleto." }, 400);
  if (!/^\d{4}-\d{2}-01$/.test(billingPeriod) || Number.isNaN(Date.parse(billingPeriod))) return reply({ ok: false, error: "Competência mensal inválida; use o primeiro dia do mês." }, 400);
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < new Date().toISOString().slice(0, 10)) {
    return reply({ ok: false, error: "Informe vencimento igual ou posterior à data atual." }, 400);
  }

  const { data: subscription, error: subError } = await admin.from("association_subscriptions")
    .select("id,association_id,plan_code,responsible_cpf,billing_email,status,trial_ends_at,provider_customer_id")
    .eq("association_id", associationId).maybeSingle();
  if (subError) return reply({ ok: false, error: "Não foi possível consultar a assinatura." }, 500);
  if (!subscription) return reply({ ok: false, error: "A associação ainda não possui assinatura cadastrada." }, 404);
  if (["cancelled", "canceled", "suspended"].includes(subscription.status)) return reply({ ok: false, error: "A assinatura está cancelada ou suspensa." }, 409);
  if (subscription.status === "trialing" && new Date(subscription.trial_ends_at).getTime() > Date.now()) {
    return reply({ ok: false, error: "O período gratuito ainda está ativo. Não é necessário gerar cobrança agora." }, 409);
  }

  const [{ data: association }, { data: plan }, { count, error: countError }] = await Promise.all([
    admin.from("associations").select("id,name,trade_name").eq("id", associationId).maybeSingle(),
    admin.from("subscription_plans").select("code,name,price_per_member_monthly,active").eq("code", subscription.plan_code).maybeSingle(),
    admin.from("residents").select("id", { count: "exact", head: true }).eq("association_id", associationId).eq("is_active", true),
  ]);
  if (!association || !plan?.active) return reply({ ok: false, error: "Associação ou plano ativo não encontrado." }, 404);
  if (countError) return reply({ ok: false, error: "Não foi possível calcular moradores ativos." }, 500);
  const residentCount = count ?? 0;
  const amount = Math.round(residentCount * Number(plan.price_per_member_monthly) * 100) / 100;
  if (residentCount < 1 || amount <= 0) return reply({ ok: false, error: "Não é possível cobrar sem moradores ativos faturáveis." }, 409);

  const { data: existing, error: existingError } = await admin.from("asaas_subscription_payments")
    .select("id,billing_period,amount,status,provider_payment_id,invoice_url,bank_slip_url,due_date,billing_type,pix_copy_paste,pix_qr_code_image")
    .eq("association_id", associationId).eq("billing_period", billingPeriod).maybeSingle();
  if (existingError) return reply({ ok: false, error: "Não foi possível verificar cobranças existentes." }, 500);
  if (existing) {
    if (existing.provider_payment_id) return reply({ ok: true, existing: true, payment: existing, message: "Já existe cobrança nesta competência; nenhuma duplicata foi criada." });
    return reply({ ok: false, error: "Há uma solicitação desta competência em processamento. Confira o Asaas antes de tentar novamente." }, 409);
  }

  const { data: reservation, error: reserveError } = await admin.from("asaas_subscription_payments").insert({
    association_id: associationId, subscription_id: subscription.id, billing_period: billingPeriod,
    amount, resident_count: residentCount, unit_price: Number(plan.price_per_member_monthly), billing_type: billingType, due_date: dueDate, status: "CREATING", created_by: userId,
  }).select("id").single();
  if (reserveError || !reservation) {
    if (reserveError?.code === "23505") return reply({ ok: false, error: "Outra solicitação está criando a cobrança desta competência. Atualize e confira o histórico." }, 409);
    return reply({ ok: false, error: "Não foi possível reservar o registro de cobrança." }, 500);
  }

  async function asaas(path: string, init: RequestInit = {}) {
    const response = await fetch(asaasBase + path, {
      ...init,
      headers: { access_token: asaasKey, accept: "application/json", "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (!response.ok) throw new Error(typeof data?.errors?.[0]?.description === "string" ? data.errors[0].description : "Asaas recusou a solicitação (HTTP " + response.status + ").");
    return data;
  }

  try {
    let customerId = subscription.provider_customer_id as string | null;
    if (!customerId) {
      const customer = await asaas("/customers", { method: "POST", body: JSON.stringify({
        name: association.trade_name || association.name,
        cpfCnpj: String(subscription.responsible_cpf).replace(/\D/g, ""),
        email: subscription.billing_email, externalReference: associationId, notificationDisabled: false,
      }) });
      if (!customer?.id) throw new Error("Asaas não retornou o identificador do cliente.");
      customerId = customer.id;
      const { error } = await admin.from("association_subscriptions")
        .update({ provider_customer_id: customerId, payment_provider: "asaas" }).eq("id", subscription.id);
      if (error) throw new Error("Cliente criado no Asaas, mas o vínculo local falhou. Confira o Asaas antes de repetir.");
    }

    const payment = await asaas("/payments", { method: "POST", body: JSON.stringify({
      customer: customerId, billingType, value: amount, dueDate,
      description: ("Morada360 - " + plan.name + " - competência " + billingPeriod.slice(0, 7) + " - " + residentCount + " morador(es) ativo(s)").slice(0, 500),
      externalReference: reservation.id,
    }) });
    if (!payment?.id) throw new Error("Asaas não retornou o identificador da cobrança.");

    let pix: any = null;
    if (billingType === "PIX") {
      try { pix = await asaas("/payments/" + encodeURIComponent(payment.id) + "/pixQrCode"); } catch { /* invoiceUrl remains available */ }
    }
    const providerStatus = String(payment.status ?? "PENDING").toUpperCase();
    const normalized = ["CONFIRMED", "RECEIVED", "OVERDUE"].includes(providerStatus) ? providerStatus : "PENDING";
    const { data: saved, error: saveError } = await admin.from("asaas_subscription_payments").update({
      provider_payment_id: payment.id, provider_status: providerStatus, status: normalized,
      invoice_url: payment.invoiceUrl ?? null, bank_slip_url: payment.bankSlipUrl ?? null,
      pix_copy_paste: pix?.payload ?? null, pix_qr_code_image: pix?.encodedImage ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", reservation.id).select("id,billing_period,amount,status,provider_payment_id,invoice_url,bank_slip_url,due_date,billing_type,pix_copy_paste,pix_qr_code_image").single();
    if (saveError || !saved) return reply({ ok: false, payment_created: true, provider_payment_id: payment.id, error: "Cobrança criada no Asaas, mas falhou a atualização local. Não repita; confira pelo identificador no Asaas." }, 502);
    return reply({ ok: true, existing: false, payment: saved, message: "Cobrança criada no Asaas Sandbox." });
  } catch (error) {
    await admin.from("asaas_subscription_payments").update({ status: "FAILED", provider_status: "FAILED", updated_at: new Date().toISOString() }).eq("id", reservation.id);
    return reply({ ok: false, error: error instanceof Error ? error.message : "Falha ao criar cobrança no Asaas." }, 502);
  }
});
