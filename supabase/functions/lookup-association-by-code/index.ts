import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const cors = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "https://devkove.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://devkove.github.io") return reply(403, { error: "Origem não permitida." });

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return reply(400, { error: "Informe um código de associação com 6 dígitos." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply(503, { error: "Consulta temporariamente indisponível." });

  // Use proxy-provided client IP headers. When forwarded-for is a chain, use its
  // last hop because upstream proxies append the source address.
  const forwardedChain = req.headers.get("x-forwarded-for");
  const clientIp = req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || (forwardedChain ? forwardedChain.split(",").at(-1)?.trim() : "");
  if (!clientIp) return reply(503, { error: "Não foi possível validar a origem da solicitação." });

  try {
    const ipHash = await sha256Hex(serviceKey + ":" + clientIp);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: allowed, error: limitError } = await admin.rpc("consume_association_code_lookup_limit", { _ip_hash: ipHash });
    if (limitError) {
      console.error("association lookup limiter failed", limitError.message);
      return reply(503, { error: "Consulta temporariamente indisponível." });
    }
    if (allowed !== true) return reply(429, { error: "Muitas tentativas. Aguarde um minuto e tente novamente." });

    const { data, error } = await admin.rpc("lookup_association_by_code", { _code: code });
    if (error) {
      console.error("association lookup failed", error.message);
      return reply(503, { error: "Não foi possível validar o código agora." });
    }
    return reply(200, Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("association lookup error", error instanceof Error ? error.message : "unknown");
    return reply(500, { error: "Falha ao validar o código." });
  }
});