-- Idempotent schema extension for pricing snapshots used to reconcile paid invoices.
alter table public.asaas_subscription_payments
  add column if not exists resident_count integer not null default 0 check (resident_count >= 0),
  add column if not exists unit_price numeric(12,2) not null default 0 check (unit_price >= 0);
