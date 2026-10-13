/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://devkove.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const isoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const todayInBrazil = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const digits = (value: string) => value.replace(/\D/g, "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://devkove.github.io") return json({ ok: false, error: "Origem não autorizada." }, 403);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    const baseUrl = (Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3").replace(/\/+$/, "");
    if (!supabaseUrl || !anonKey || !serviceKey || !asaasKey) return json({ ok: false, error: "Configuração do servidor incompleta." }, 500);
    if (!baseUrl.startsWith("https://api-sandbox.asaas.com/")) return json({ ok: false, error: "Esta função só pode emitir cobranças no Asaas Sandbox." }, 500);

    const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ ok: false, error: "Autenticação obrigatória." }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ ok: false, error: "Sessão inválida ou expirada." }, 401);
    const userId = authData.user.id;

    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
      admin.from("profiles").select("account_status").eq("id", userId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (profileError || rolesError) return json({ ok: false, error: "Não foi possível validar as permissões." }, 500);
    if (profile?.account_status !== "approved" || !roles?.some((r: { role: string }) => r.role === "platform_admin")) {
      return json({ ok: false, error: "Apenas administradores aprovados da plataforma podem gerar cobranças." }, 403);
    }

    let input: Record<string, unknown>;
    try { input = await req.json(); } catch { return json({ ok: false, error: "JSON inválido." }, 400); }
    const associationId = clean(input.association_id);
    const billingPeriod = clean(input.billing_period);
    const billingType = clean(input.billing_type).toUpperCase();
    const requestedDueDate = clean(input.due_date);
    const testMode = input.test_mode === true;
    const testAssociationId = "13c2ea32-036d-45c8-84b3-ded24bdd8c54";
    if (testMode && associationId !== testAssociationId) return json({ ok: false, error: "O modo de teste sem cadastro real está autorizado somente para a associação de testes AMBRAS." }, 403);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(associationId)) return json({ ok: false, error: "association_id inválido." }, 400);
    if (!isoDate(billingPeriod) || !billingPeriod.endsWith("-01")) return json({ ok: false, error: "billing_period deve ser o primeiro dia do mês no formato AAAA-MM-01." }, 400);
    if (!["PIX", "BOLETO", "UNDEFINED"].includes(billingType)) return json({ ok: false, error: "Forma de pagamento inválida. Use PIX, BOLETO ou UNDEFINED." }, 400);
    const dueDate = requestedDueDate || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    if (!isoDate(dueDate) || dueDate < todayInBrazil()) return json({ ok: false, error: "A data de vencimento deve ser hoje ou uma data futura no horário de Brasília." }, 400);

    const { data: subscription, error: subscriptionError } = await admin.from("association_subscriptions")
      .select("id, association_id, plan_code, responsible_cpf, billing_email, status, trial_ends_at, provider_customer_id, created_by")
      .eq("association_id", associationId).maybeSingle();
    if (subscriptionError) return json({ ok: false, error: "Falha ao consultar a assinatura." }, 500);
    if (!subscription) return json({ ok: false, error: "A associação ainda não possui assinatura cadastrada. Nenhuma cobrança foi criada." }, 409);
    if (["cancelled", "canceled", "suspended"].includes(clean(subscription.status).toLowerCase())) return json({ ok: false, error: "A assinatura está cancelada ou suspensa." }, 409);
    // This endpoint is hard-restricted to Asaas Sandbox above. Platform admins may
    // create a Sandbox test payment during trial without changing the trial status.

    const [{ data: association, error: associationError }, { data: plan, error: planError }, { count: residentCount, error: residentsError }] = await Promise.all([
      admin.from("associations").select("id,name,cnpj,email,phone").eq("id", associationId).maybeSingle(),
      admin.from("subscription_plans").select("code,name,price_per_member_monthly,active").eq("code", subscription.plan_code).maybeSingle(),
      admin.from("residents").select("id", { count: "exact", head: true }).eq("association_id", associationId).eq("is_active", true),
    ]);
    if (associationError || planError || residentsError) return json({ ok: false, error: "Falha ao consultar os dados de cobrança." }, 500);
    if (!association || !plan || !plan.active) return json({ ok: false, error: "Associação ou plano ativo não encontrado." }, 409);
    if (!clean(subscription.billing_email) || !clean(association.name)) return json({ ok: false, error: "Nome da associação e e-mail de cobrança são obrigatórios." }, 422);
    // A fixed synthetic CNPJ and one synthetic billable member are allowed only for
    // the hard-coded AMBRAS test association and only while the endpoint is Sandbox-only.
    // This path must never be enabled for another association or production endpoint.
    let cpfCnpj: string;
    let count: number;
    if (testMode) {
      cpfCnpj = "11222333000181"; // synthetic, checksum-valid Sandbox test identifier
      count = 1;
    } else {
      if (!association.cnpj) return json({ ok: false, error: "A associação precisa ter CNPJ cadastrado para gerar a cobrança. Nenhuma cobrança foi criada." }, 422);
      cpfCnpj = digits(association.cnpj);
      if (cpfCnpj.length !== 14) return json({ ok: false, error: "O CNPJ cadastrado não é válido para emissão de cobrança." }, 422);
      count = residentCount ?? 0;
      if (count < 1) return json({ ok: false, error: "Não há moradores ativos cadastrados para calcular a mensalidade. Nenhuma cobrança foi criada." }, 422);
    }
    const unitPrice = Number(plan.price_per_member_monthly);
    const amount = Math.round(count * unitPrice * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return json({ ok: false, error: "Valor de cobrança calculado inválido." }, 422);

    const { data: existing, error: existingError } = await admin.from("asaas_subscription_payments").select("*")
      .eq("association_id", associationId).eq("billing_period", billingPeriod).maybeSingle();
    if (existingError) return json({ ok: false, error: "Não foi possível verificar cobranças existentes." }, 500);
    if (existing?.provider_payment_id) return json({ ok: true, reused: true, payment: {
      id: existing.id, status: existing.status, amount: existing.amount, due_date: existing.due_date,
      invoice_url: existing.invoice_url, bank_slip_url: existing.bank_slip_url,
      pix_copy_paste: existing.pix_copy_paste, pix_qr_code_image: existing.pix_qr_code_image,
    } });
    if (existing && existing.status === "FAILED") {
      const { error: cleanupError } = await admin.from("asaas_subscription_payments").delete().eq("id", existing.id).is("provider_payment_id", null);
      if (cleanupError) return json({ ok: false, error: "A tentativa anterior falhou, mas não foi possível liberar a competência com segurança." }, 409);
    } else if (existing) return json({ ok: false, error: "Já existe um registro para este mês sem confirmação do Asaas. Por segurança, a emissão foi bloqueada para evitar cobrança duplicada; concilie esse registro antes de tentar novamente.", local_payment_id: existing.id }, 409);

    const { data: localPayment, error: insertError } = await admin.from("asaas_subscription_payments").insert({
      association_id: associationId, subscription_id: subscription.id, billing_period: billingPeriod,
      amount, currency: "BRL", billing_type: billingType, status: "CREATING", due_date: dueDate,
      created_by: userId, resident_count: count, unit_price: unitPrice,
    }).select("id").single();
    if (insertError) {
      if (insertError.code === "23505") return json({ ok: false, error: "Já existe cobrança registrada para esta associação e competência. Consulte o histórico antes de tentar novamente." }, 409);
      return json({ ok: false, error: "Não foi possível reservar a competência de cobrança." }, 500);
    }

    const asaasFetch = async (path: string, init: RequestInit = {}) => {
      const response = await fetch(baseUrl + path, {
        ...init,
        headers: { "Content-Type": "application/json", "access_token": asaasKey, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(20000),
      });
      const raw = await response.text();
      let body: any = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
      if (!response.ok) {
        const message = Array.isArray(body.errors) ? body.errors.map((e: any) => clean(e.description) || clean(e.code)).filter(Boolean).join("; ") : "";
        throw new Error(message || "O Asaas recusou a operação. Verifique os dados cadastrais no Sandbox.");
      }
      return body;
    };

    let customerId = testMode ? "" : clean(subscription.provider_customer_id) || clean(association.provider_customer_id);
    try {
      if (!customerId) {
        const lookup = await asaasFetch("/customers?cpfCnpj=" + encodeURIComponent(cpfCnpj) + "&limit=10");
        const found = Array.isArray(lookup.data) ? lookup.data.find((c: any) => digits(clean(c.cpfCnpj)) === cpfCnpj) : null;
        if (found?.id) customerId = clean(found.id);
      }
      if (!customerId) {
        const customer = await asaasFetch("/customers", { method: "POST", body: JSON.stringify({
          name: testMode ? "Morada360 AMBRAS - CLIENTE DE TESTE" : clean(association.name), cpfCnpj, email: clean(subscription.billing_email),
          phone: digits(clean(association.phone)) || undefined,
          externalReference: "morada360-association-" + associationId,
        }) });
        customerId = clean(customer.id);
        if (!customerId) throw new Error("O Asaas não retornou o identificador do cliente.");
      }
      if (!testMode) await admin.from("association_subscriptions").update({ provider_customer_id: customerId, payment_provider: "asaas", updated_at: new Date().toISOString() }).eq("id", subscription.id);

      const externalReference = "morada360-" + localPayment.id;
      const payment = await asaasFetch("/payments", { method: "POST", body: JSON.stringify({
        customer: customerId, billingType, value: amount, dueDate,
        description: (testMode ? "TESTE SANDBOX Morada360 - " : "Morada360 - ") + clean(plan.name) + " - competência " + billingPeriod.slice(0, 7),
        externalReference,
      }) });
      if (!clean(payment.id)) throw new Error("O Asaas não retornou o identificador da cobrança.");
      let pix: any = {};
      if (billingType === "PIX") {
        try { pix = await asaasFetch("/payments/" + encodeURIComponent(payment.id) + "/pixQrCode"); } catch { pix = {}; }
      }
      const statusMap: Record<string, string> = {
        PENDING: "PENDING", CONFIRMED: "CONFIRMED", RECEIVED: "RECEIVED",
        OVERDUE: "OVERDUE", REFUNDED: "REFUNDED", DELETED: "CANCELLED",
      };
      const providerStatus = clean(payment.status) || "PENDING";
      const update = {
        provider_payment_id: payment.id, invoice_url: clean(payment.invoiceUrl) || null,
        bank_slip_url: clean(payment.bankSlipUrl) || null,
        pix_copy_paste: clean(pix.payload) || null, pix_qr_code_image: clean(pix.encodedImage) || null,
        provider_status: providerStatus, status: statusMap[providerStatus] || "PENDING",
        last_provider_event: "PAYMENT_CREATED", updated_at: new Date().toISOString(),
      };
      const { data: saved, error: saveError } = await admin.from("asaas_subscription_payments").update(update).eq("id", localPayment.id).select("id,status,amount,due_date,invoice_url,bank_slip_url,pix_copy_paste,pix_qr_code_image,provider_payment_id").single();
      if (saveError || !saved) return json({ ok: false, error: "A cobrança foi criada no Asaas, mas não foi possível confirmar o salvamento local. Não tente emitir novamente; verifique o Asaas pelo identificador externo " + externalReference + ".", external_reference: externalReference }, 502);
      return json({ ok: true, sandbox: true, test_mode: testMode, payment: saved });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada na integração.";
      // Keep CREATING for uncertain provider outcomes to prevent duplicate charges.
      if (/recusou a operação|obrigat|inválid|invalid|cpf|cnpj|e-mail|email|não encontrado/i.test(message)) {
        await admin.from("asaas_subscription_payments").update({ status: "FAILED", provider_status: "ERROR", last_provider_event: "PAYMENT_CREATION_FAILED", updated_at: new Date().toISOString() }).eq("id", localPayment.id);
      }
      return json({ ok: false, error: message, local_payment_id: localPayment.id, safe_to_retry: false }, 502);
    }
  } catch (error) {
    console.error("asaas-billing-create failure", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "Erro interno ao processar a cobrança." }, 500);
  }
});