Deno.serve((req: Request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://devkove.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({
    ok: false,
    code: "PAYMENT_PROVIDER_RETIRED",
    error: "Esta integração foi desativada. Nenhuma operação de pagamento é processada."
  }), { status: 410, headers });
});