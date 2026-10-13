create table if not exists public.asaas_production_test_charges (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references auth.users(id) on delete restrict,
 test_key text not null unique,
 provider_customer_id text,
 provider_payment_id text unique,
 amount numeric(10,2) not null default 2.00 check (amount = 2.00),
 status text not null default 'CREATING' check (status in ('CREATING','PENDING','CONFIRMED','FAILED')),
 invoice_url text,
 pix_copy_paste text,
 pix_qr_code_image text,
 provider_status text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.asaas_production_test_charges enable row level security;
revoke all on public.asaas_production_test_charges from anon, authenticated;
grant all on public.asaas_production_test_charges to service_role;
comment on table public.asaas_production_test_charges is 'Single R$2 production Pix smoke test per platform admin; service-role Edge Function only. Not used for subscription billing.';
