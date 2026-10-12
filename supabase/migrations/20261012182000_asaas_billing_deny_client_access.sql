-- Client roles must never read or mutate provider payment records or webhook events directly.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='asaas_subscription_payments' and policyname='No direct client access to Asaas payments') then
    create policy "No direct client access to Asaas payments" on public.asaas_subscription_payments for all to anon, authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='asaas_webhook_events' and policyname='No direct client access to Asaas webhook events') then
    create policy "No direct client access to Asaas webhook events" on public.asaas_webhook_events for all to anon, authenticated using (false) with check (false);
  end if;
end $$;
