-- Asaas subscription billing foundation. Applied to the connected Supabase project.
create table if not exists public.asaas_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete restrict,
  subscription_id uuid not null references public.association_subscriptions(id) on delete restrict,
  billing_period date not null,
  amount numeric(12,2) not null check (amount > 0),
  resident_count integer not null default 0 check (resident_count >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_type text not null check (billing_type in ('PIX','BOLETO','UNDEFINED')),
  status text not null default 'CREATING' check (status in ('CREATING','PENDING','CONFIRMED','RECEIVED','OVERDUE','REFUNDED','CANCELLED','FAILED','UNKNOWN')),
  due_date date not null,
  provider_payment_id text unique,
  invoice_url text,
  bank_slip_url text,
  pix_copy_paste text,
  pix_qr_code_image text,
  provider_status text,
  last_provider_event text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (association_id, billing_period)
);
create index if not exists asaas_subscription_payments_association_created_idx on public.asaas_subscription_payments (association_id, created_at desc);
create index if not exists asaas_subscription_payments_status_due_idx on public.asaas_subscription_payments (status, due_date);
create table if not exists public.asaas_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text unique,
  event_type text not null,
  provider_payment_id text,
  provider_status text,
  processed boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
create index if not exists asaas_webhook_events_payment_idx on public.asaas_webhook_events (provider_payment_id, received_at desc);
alter table public.asaas_subscription_payments enable row level security;
alter table public.asaas_webhook_events enable row level security;
revoke all on public.asaas_subscription_payments from anon, authenticated;
revoke all on public.asaas_webhook_events from anon, authenticated;
