-- Hardening applied to the production Supabase project ivajgtokxrzwnspihllr.
-- Keep this migration in version control; no payment or subscription rows are modified.
alter table public.mercadopago_subscription_payments enable row level security;
alter table public.mercadopago_webhook_events enable row level security;

drop policy if exists "No direct client access to MercadoPago payments" on public.mercadopago_subscription_payments;
create policy "No direct client access to MercadoPago payments"
  on public.mercadopago_subscription_payments
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct client access to MercadoPago webhook events" on public.mercadopago_webhook_events;
create policy "No direct client access to MercadoPago webhook events"
  on public.mercadopago_webhook_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all privileges on table public.mercadopago_subscription_payments from anon, authenticated;
revoke all privileges on table public.mercadopago_webhook_events from anon, authenticated;

revoke execute on function public.notify_association_communication() from public, anon, authenticated;
revoke execute on function public.notify_chat_message() from public, anon, authenticated;
revoke execute on function public.start_association_trial(uuid, text, text, text) from public, anon, authenticated;

revoke execute on function public.initialize_association_subscription(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_change_association_plan(uuid, text) from public, anon;
revoke execute on function public.get_my_association_billing_status(uuid) from public, anon;
revoke execute on function public.get_my_association_plan(uuid) from public, anon;
revoke execute on function public.has_association_feature(uuid, text) from public, anon;
