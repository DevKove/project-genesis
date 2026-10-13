# Asaas Production Pix smoke test (Morada360)

This isolated endpoint is disabled by default and does not change Sandbox billing or subscription billing.

## Safety controls
- Uses only the production API URL https://api.asaas.com/v3.
- Requires ASAAS_PRODUCTION_ENABLED=true and ASAAS_PRODUCTION_API_KEY server secrets.
- Requires an authenticated, approved platform_admin.
- Fixed amount BRL 2.00, PIX only.
- Uses the administrator's name, CPF and email entered through the authenticated app; optional phone.
- One test reservation per admin; repeated requests reuse the existing charge and never intentionally create a duplicate.
- Separate table; never changes association monthly billing.
- Do not enable or invoke before explicit final confirmation.

## Deployment order
1. Review and merge this PR.
2. Apply migration 20261013000000_asaas_production_test_charges.sql.
3. Deploy Edge Function asaas-production-pix-test. It performs its own JWT/session and role validation, so verify_jwt may be false only for this function.
4. Set ASAAS_PRODUCTION_API_KEY securely in Supabase; keep ASAAS_PRODUCTION_ENABLED=false initially.
5. Add an authenticated app form that invokes this function. Do not collect CPF or API keys in chat or frontend logs.
6. Enable the flag only when ready for the explicitly authorized R$2 charge.

Important: this function creates a real charge when enabled and invoked. It is not deployed or enabled by this PR.
