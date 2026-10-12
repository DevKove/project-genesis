import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://devkove.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: cors });
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return respond({ ok: false, error: "Método não permitido." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://devkove.github.io") return respond({ ok: false, error: "Origem não autorizada." }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !anon || !service) return respond({ ok: false, error: "Configuração do servidor incompleta." }, 500);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond({ ok: false, error: "Autenticação obrigatória." }, 401);

  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return respond({ ok: false, error: "Sessão inválida ou expirada." }, 401);

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    admin.from("profiles").select("account_status").eq("id", authData.user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", authData.user.id),
  ]);
  if (profileError || rolesError) return respond({ ok: false, error: "Não foi possível validar as permissões." }, 500);
  if (profile?.account_status !== "approved" || !roles?.some((item: { role: string }) => item.role === "platform_admin")) {
    return respond({ ok: false, error: "Apenas administradores aprovados da plataforma podem gerar cobranças." }, 403);
  }

  return respond({ ok: false, stage: "authorization_verified", error: "Autorização validada. Emissão de cobrança permanece bloqueada até a etapa de integração com o Asaas Sandbox." }, 501);
});