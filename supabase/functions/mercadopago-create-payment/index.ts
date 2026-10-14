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
  const productionAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const testAccessToken = Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response(503, { ok: false, error: "Integração Mercado Pago ainda não configurada no servidor." });
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData.user) return response(401, { ok: false, error: "Sessão inválida. Entre novamente." });

    const body = await req.json().catch(() => ({}));
    const associationId = typeof body.association_id === "string" ? body.association_id : "";
    const paymentMethod = body.payment_method === "pix" ? "pix" : "card";
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
      if (!productionAccessToken) return response(503, { ok: false, diagnostic: true, error: "Credencial do Mercado Pago não configurada no servidor." });
      const mpResponse = await fetch("https://api.mercadopago.com/users/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${productionAccessToken ?? ""}`, "Content-Type": "application/json" },
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
        credential_environment: productionAccessToken?.startsWith("APP_USR-") ? "APP_USR (prefixo compartilhado por credenciais de teste e produção; ambiente não identificável apenas pelo prefixo)" : productionAccessToken?.startsWith("TEST-") ? "prefixo TEST (verifique o tipo de integração)" : "não identificado",
        message: "Credencial aceita pelo Mercado Pago. Nenhuma cobrança ou preferência foi criada.",
      });
    }

    // Checkout de teste: apenas administradores da plataforma e credencial de teste dedicada.
    // Creates a Mercado Pago TEST preference with no notification_url and writes
    // nothing to the database, so no subscription or payment row is ever changed.
    if (body.action === "sandbox_checkout") {
      if (!platformAdmin) return response(403, { ok: false, sandbox: true, error: "Somente administradores da plataforma podem testar o checkout." });
      if (!testAccessToken) {
        return response(409, {
          ok: false, sandbox: true, requires_test_credential: true,
          error: "A credencial de teste do Mercado Pago não está configurada no servidor. Configure o Access Token de teste em MERCADOPAGO_TEST_ACCESS_TOKEN. Não use nem substitua a credencial de produção.",
        });
      }
      const testRef = `sandbox-${crypto.randomUUID()}`;
      const returnUrl = "https://devkove.github.io/project-genesis/app/assinatura?checkout_teste=1";
      const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { Authorization: `Bearer ${testAccessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": testRef },
        body: JSON.stringify({
          items: [{ id: "sandbox-test", title: "Morada360 — Teste de checkout (sandbox)", quantity: 1, currency_id: "BRL", unit_price: 1 }],
          external_reference: testRef,
          back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
          auto_return: "approved",
          metadata: { sandbox_test: true },
        }),
      });
      const mpData = await mpResponse.json().catch(() => ({}));
      // Checkout Pro usa init_point também com credenciais de teste; o ambiente é determinado pela credencial usada, não pelo nome do campo.
      const sandboxUrl = mpData.init_point;
      if (!mpResponse.ok || !mpData.id || typeof sandboxUrl !== "string" || !sandboxUrl.startsWith("https://")) {
        console.error("Mercado Pago sandbox preference failed", { status: mpResponse.status });
        return response(502, { ok: false, sandbox: true, error: "O Mercado Pago não retornou init_point válido para a credencial de teste. Confira a credencial de teste e os detalhes do erro nos logs da função." });
      }
      return response(200, { ok: true, sandbox: true, checkout_url: sandboxUrl, preference_id: String(mpData.id), message: "Checkout de teste criado. Nenhum registro de assinatura ou pagamento foi alterado." });
    }

    // Fail closed: never allow an unknown credential format to create checkout.

    if (!productionAccessToken) return response(503, { ok: false, error: "Credencial de produção do Mercado Pago não configurada no servidor." });
    const accessToken = productionAccessToken;
    const isTestEnvironment = false;
    const isProductionEnvironment = accessToken.startsWith("APP_USR-");
    if (!isTestEnvironment && !isProductionEnvironment) {
      return response(503, { ok: false, error: "Ambiente da credencial do Mercado Pago não identificado. Checkout bloqueado por segurança." });
    }

    const { data: subscription, error: subError } = await admin.from("association_subscriptions")
      .select("id,association_id,plan_code,status,trial_ends_at,current_period_end,billing_email,responsible_cpf")
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
    if (existing?.status === "PENDING" && (existing.checkout_url || existing.provider_payment_id)) {
      const existingIsPix = Boolean(existing.provider_payment_id) && !existing.provider_preference_id;
      if ((paymentMethod === "pix") !== existingIsPix) {
        return response(409, { ok: false, error: existingIsPix
          ? "Já existe um Pix pendente para esta mensalidade. Conclua esse Pix antes de escolher cartão."
          : "Já existe um checkout pendente para esta mensalidade. Conclua ou aguarde a atualização desse pagamento antes de gerar um Pix." });
      }
      if (existingIsPix && paymentMethod === "pix" && existing.provider_payment_id) {
        const existingPixResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(existing.provider_payment_id))}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const existingPixData = await existingPixResponse.json().catch(() => ({}));
        const transactionData = existingPixData?.point_of_interaction?.transaction_data ?? {};
        if (existingPixResponse.ok && existingPixData.id) {
          return response(200, {
            ok: true, pix: true, payment_id: existing.id, provider_payment_id: String(existingPixData.id),
            amount: existing.amount, status: existingPixData.status,
            qr_code: typeof transactionData.qr_code === "string" ? transactionData.qr_code : null,
            qr_code_base64: typeof transactionData.qr_code_base64 === "string" ? transactionData.qr_code_base64 : null,
            checkout_url: typeof transactionData.ticket_url === "string" ? transactionData.ticket_url : existing.checkout_url,
            reused: true,
          });
        }
        return response(502, { ok: false, error: "Não foi possível recuperar os dados do Pix pendente. Tente novamente em instantes." });
      }
      return response(200, { ok: true, pix: existingIsPix, checkout_url: existing.checkout_url, payment_id: existing.id, amount: existing.amount, reused: true });
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

    if (paymentMethod === "pix") {
      const cpfDigits = String(subscription.responsible_cpf ?? "").replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        await admin.from("mercadopago_subscription_payments").update({ status: "FAILED", provider_status: "pix_missing_valid_cpf", updated_at: new Date().toISOString() }).eq("id", paymentId);
        return response(409, { ok: false, error: "Para gerar o Pix, cadastre um CPF válido do responsável financeiro na assinatura." });
      }
      const pixResponse = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": paymentId },
        body: JSON.stringify({
          transaction_amount: amount,
          description: `Morada360 — Plano ${plan.name}`,
          payment_method_id: "pix",
          external_reference: paymentId,
          notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
          payer: { email: subscription.billing_email, identification: { type: "CPF", number: cpfDigits } },
          metadata: { payment_id: paymentId, association_id: associationId, subscription_id: subscription.id, billing_period: period, resident_count: residentCount, payment_method: "pix" },
        }),
      });
      const pixData = await pixResponse.json().catch(() => ({}));
      const transactionData = pixData?.point_of_interaction?.transaction_data ?? {};
      const qrCode = typeof transactionData.qr_code === "string" ? transactionData.qr_code : null;
      const qrCodeBase64 = typeof transactionData.qr_code_base64 === "string" ? transactionData.qr_code_base64 : null;
      const ticketUrl = typeof transactionData.ticket_url === "string" ? transactionData.ticket_url : null;
      if (!pixResponse.ok || !pixData.id || (!qrCode || !qrCodeBase64) && !ticketUrl) {
        await admin.from("mercadopago_subscription_payments").update({ status: "FAILED", provider_status: `pix_error_${pixResponse.status || "invalid_response"}`, updated_at: new Date().toISOString() }).eq("id", paymentId);
        console.error("Mercado Pago Pix creation failed", { status: pixResponse.status, cause: pixData?.message ?? pixData?.error ?? "invalid_response" });
        return response(502, { ok: false, error: "O Mercado Pago não conseguiu gerar o Pix. Nenhum pagamento foi confirmado." });
      }
      const providerStatus = String(pixData.status ?? "pending").toLowerCase();
      const { error: pixSaveError } = await admin.from("mercadopago_subscription_payments").update({
        provider_payment_id: String(pixData.id), provider_preference_id: null, checkout_url: ticketUrl,
        status: providerStatus === "approved" ? "APPROVED" : "PENDING",
        provider_status: providerStatus === "approved" ? "approved" : "pix_created", updated_at: new Date().toISOString(),
      }).eq("id", paymentId);
      if (pixSaveError) {
        console.error("Mercado Pago Pix local save failed", { payment_id: paymentId, cause: pixSaveError.message });
        return response(500, { ok: false, error: "O Pix foi criado, mas não foi possível atualizar o registro local. Entre em contato com o suporte antes de tentar novamente." });
      }
      return response(200, { ok: true, pix: true, payment_id: paymentId, provider_payment_id: String(pixData.id), amount, status: providerStatus, qr_code: qrCode, qr_code_base64: qrCodeBase64, checkout_url: ticketUrl, reused: false });
    }

    const siteUrl = "https://devkove.github.io/project-genesis/app/assinatura";
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
    // Test credentials must use sandbox_init_point exclusively; production credentials
    // must use init_point exclusively. Never fall back across environments.
    const checkoutUrl = isTestEnvironment ? mpData.sandbox_init_point : mpData.init_point;
    if (!mpResponse.ok || !mpData.id || typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
      await admin.from("mercadopago_subscription_payments").update({
        status: "FAILED",
        provider_status: `preference_error_${mpResponse.status || "invalid_checkout_url"}`,
        updated_at: new Date().toISOString(),
      }).eq("id", paymentId);
      return response(502, {
        ok: false,
        error: isTestEnvironment
          ? "O Mercado Pago não retornou um checkout de teste válido. Nenhuma cobrança foi confirmada."
          : "O Mercado Pago não conseguiu gerar o checkout. Nenhuma cobrança foi confirmada.",
      });
    }
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
