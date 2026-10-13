-- Mercado Pago manual monthly checkout. No recurring/preapproval API is used.
create table if not exists public.mercadopago_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete restrict,
  subscription_id uuid not null references public.association_subscriptions(id) on delete restrict,
  billing_period date not null,
  amount numeric(12,2) not null check (amount > 0),
  resident_count integer not null default 0 check (resident_count >= 0),
  unit_price numeric(12,2) not null check (unit_price > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED','REFUNDED','FAILED')),
  provider_payment_id text unique,
  provider_preference_id text,
  checkout_url text,
  provider_status text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (association_id, billing_period)
);
create index if not exists mercadopago_payments_assoc_created_idx
  on public.mercadopago_subscription_payments (association_id, created_at desc);
create index if not exists mercadopago_payments_status_idx
  on public.mercadopago_subscription_payments (status, billing_period);
alter table public.mercadopago_subscription_payments enable row level security;
revoke all on public.mercadopago_subscription_payments from anon, authenticated;

create table if not exists public.mercadopago_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  provider_payment_id text,
  provider_status text,
  processed boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
alter table public.mercadopago_webhook_events enable row level security;
revoke all on public.mercadopago_webhook_events from anon, authenticated;

create or replace function public.get_my_association_billing_status(_association_id uuid)
returns table (
  plan_code text,
  subscription_status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  latest_payment_status text,
  latest_payment_url text,
  latest_payment_period date,
  latest_payment_amount numeric,
  can_pay boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.association_members m
    where m.association_id = _association_id
      and m.user_id = auth.uid()
      and m.role in ('admin','presidente','tesoureiro')
  ) and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'platform_admin'
  ) then
    raise exception 'Você não tem permissão para consultar a cobrança desta associação.' using errcode = '42501';
  end if;

  return query
  select s.plan_code, s.status, s.trial_ends_at, s.current_period_end,
         p.status, p.checkout_url, p.billing_period, p.amount,
         (
           exists (
             select 1 from public.association_members m
             where m.association_id = s.association_id and m.user_id = auth.uid()
               and m.role in ('admin','presidente','tesoureiro')
           )
           or exists (
             select 1 from public.user_roles ur
             where ur.user_id = auth.uid() and ur.role = 'platform_admin'
           )
         )
  from public.association_subscriptions s
  left join lateral (
    select mp.status, mp.checkout_url, mp.billing_period, mp.amount
    from public.mercadopago_subscription_payments mp
    where mp.association_id = s.association_id
    order by mp.created_at desc
    limit 1
  ) p on true
  where s.association_id = _association_id;
end;
$$;
revoke all on function public.get_my_association_billing_status(uuid) from public, anon;
grant execute on function public.get_my_association_billing_status(uuid) to authenticated;
