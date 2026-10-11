import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedAppOrigin = (() => {
  const configuredUrl = Deno.env.get("APP_URL");
  if (!configuredUrl) return null;
  try {
    return new URL(configuredUrl).origin;
  } catch {
    return null;
  }
})();

function corsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get("Origin");
  return {
    ...(requestOrigin && allowedAppOrigin && requestOrigin === allowedAppOrigin
      ? { "Access-Control-Allow-Origin": allowedAppOrigin }
      : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

type RequestRow = {
  id: string;
  association_id: string;
  association_name: string;
  user_id: string;
  full_name: string;
  email: string;
  status: "pendente" | "aprovado" | "rejeitado";
  review_note: string | null;
};

function htmlEscape(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => replacements[char] ?? char);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const appUrl = Deno.env.get("APP_URL");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey || !fromEmail || !appUrl) {
    return new Response(JSON.stringify({ error: "Email provider is not configured." }), {
      status: 503, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const authorization = req.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response(JSON.stringify({ error: "Authentication required." }), {
    status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return new Response(JSON.stringify({ error: "Invalid session." }), {
    status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // A valid session is not enough: block pending/rejected platform accounts from using this service-role relay.
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("profiles")
    .select("account_status")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (callerProfileError || callerProfile?.account_status !== "approved") {
    return new Response(JSON.stringify({ error: "Approved account required." }), {
      status: 403,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  let payload: { request_id?: string; event?: string };
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  }

  if (!payload.request_id || !["requested", "reviewed"].includes(payload.event ?? "")) {
    return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
  }

  const { data: request, error: requestError } = await adminClient
    .from("association_join_requests")
    .select("id,association_id,association_name,user_id,full_name,email,status,review_note")
    .eq("id", payload.request_id)
    .maybeSingle();
  if (requestError || !request) return new Response(JSON.stringify({ error: "Request not found." }), {
    status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
  const joinRequest = request as RequestRow;

  const { data: membership } = await adminClient.from("association_members")
    .select("role")
    .eq("association_id", joinRequest.association_id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const callerIsAdmin = membership?.role === "admin";

  if (payload.event === "requested") {
    if (joinRequest.user_id !== authData.user.id || joinRequest.status !== "pendente") {
      return new Response(JSON.stringify({ error: "Not authorized for this notification." }), {
        status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }
  } else if (!callerIsAdmin || !["aprovado", "rejeitado"].includes(joinRequest.status)) {
    return new Response(JSON.stringify({ error: "Not authorized for this notification." }), {
      status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const recipients: Array<{ email: string; subject: string; heading: string; message: string }> = [];
  const safeName = htmlEscape(joinRequest.full_name);
  const safeAssociation = htmlEscape(joinRequest.association_name);
  const dashboardUrl = new URL(payload.event === "requested" ? "/app/membros" : "/app", appUrl).toString();

  if (payload.event === "requested") {
    const { data: admins, error: adminsError } = await adminClient.from("association_members")
      .select("user_id")
      .eq("association_id", joinRequest.association_id)
      .eq("role", "admin");
    if (adminsError) return new Response(JSON.stringify({ error: "Could not load association administrators." }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
    for (const admin of admins ?? []) {
      const { data: adminUser } = await adminClient.auth.admin.getUserById(admin.user_id);
      const email = adminUser.user?.email?.trim();
      if (email) recipients.push({
        email,
        subject: `Novo pedido de acesso — ${joinRequest.association_name}`,
        heading: "Novo pedido de acesso",
        message: `${safeName} (${htmlEscape(joinRequest.email)}) solicitou acesso a ${safeAssociation}. Entre no painel para aprovar ou recusar o pedido.`,
      });
    }
  } else {
    recipients.push({
      email: joinRequest.email,
      subject: joinRequest.status === "aprovado" ? `Acesso aprovado — ${joinRequest.association_name}` : `Atualização do pedido — ${joinRequest.association_name}`,
      heading: joinRequest.status === "aprovado" ? "Seu acesso foi aprovado" : "Sua solicitação não foi aprovada",
      message: joinRequest.status === "aprovado"
        ? `Seu acesso a ${safeAssociation} foi aprovado. Entre no Morada360 para continuar.`
        : `Sua solicitação de acesso a ${safeAssociation} não foi aprovada.${joinRequest.review_note ? ` Observação: ${htmlEscape(joinRequest.review_note)}` : ""}`,
    });
  }

  const results = await Promise.all(recipients.map(async (recipient) => {
    const idempotencyKey = `join-${joinRequest.id}-${payload.event}-${recipient.email.toLowerCase()}`.slice(0, 240);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient.email],
        subject: recipient.subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172033"><h1>${recipient.heading}</h1><p>${recipient.message}</p><p><a href="${dashboardUrl}">Abrir Morada360</a></p><hr/><small>Esta é uma mensagem automática do Morada360.</small></div>`,
      }),
    });
    return { ok: response.ok, status: response.status };
  }));

  const failed = results.filter((result) => !result.ok).length;
  if (failed) return new Response(JSON.stringify({ sent: results.length - failed, failed }), {
    status: 502, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
  return new Response(JSON.stringify({ sent: results.length }), {
    status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
});
