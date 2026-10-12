create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  tagline text not null,
  price_per_member_monthly numeric(10,2) not null check (price_per_member_monthly >= 0),
  display_order integer not null unique,
  features jsonb not null default '[]'::jsonb,
  highlighted boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, tagline, price_per_member_monthly, display_order, features, highlighted)
values
 ('essencial', 'Essencial', 'O necessário para começar com organização', 0.99, 1,
  '["Cadastro de unidades e moradores","Comunicados da associação","Solicitações e ocorrências","Suporte por e-mail"]'::jsonb, false),
 ('gestao', 'Gestão', 'Mais controle para o dia a dia', 1.49, 2,
  '["Tudo do Essencial","Documentos da associação","Chat geral e mensagens privadas","Gestão de prestadores","Alertas em tempo real"]'::jsonb, true),
 ('profissional', 'Profissional', 'Para associações em crescimento', 2.49, 3,
  '["Tudo do Gestão","Auditoria e histórico de atividades","Relatórios gerenciais avançados","Gestão ampliada de permissões","Atendimento prioritário"]'::jsonb, false),
 ('premium', 'Premium', 'Experiência completa e acompanhamento prioritário', 3.49, 4,
  '["Tudo do Profissional","Implantação assistida","Revisões periódicas de uso","Canal prioritário de suporte","Acesso antecipado a novidades"]'::jsonb, false)
on conflict (code) do update set
 name = excluded.name,
 tagline = excluded.tagline,
 price_per_member_monthly = excluded.price_per_member_monthly,
 display_order = excluded.display_order,
 features = excluded.features,
 highlighted = excluded.highlighted,
 active = true;

create table if not exists public.association_subscriptions (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null unique references public.associations(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  responsible_cpf text not null,
  billing_email text not null,
  status text not null default 'trialing' check (status in ('trialing','active','payment_required','past_due','cancelled','suspended')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '10 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  member_count_at_last_billing integer not null default 0 check (member_count_at_last_billing >= 0),
  unit_price_at_last_billing numeric(10,2) not null default 0 check (unit_price_at_last_billing >= 0),
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint association_subscriptions_cpf_digits check (responsible_cpf ~ '^[0-9]{11}$'),
  constraint association_subscriptions_email_format check (billing_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create unique index if not exists association_subscriptions_responsible_cpf_uidx
  on public.association_subscriptions (responsible_cpf);
create unique index if not exists association_subscriptions_billing_email_uidx
  on public.association_subscriptions (lower(billing_email));

alter table public.subscription_plans enable row level security;
alter table public.association_subscriptions enable row level security;

drop policy if exists "Authenticated users can view active subscription plans" on public.subscription_plans;
create policy "Authenticated users can view active subscription plans"
on public.subscription_plans for select to authenticated
using (active = true);

drop policy if exists "Association managers can view their subscription" on public.association_subscriptions;
create policy "Association managers can view their subscription"
on public.association_subscriptions for select to authenticated
using (
  exists (
    select 1 from public.association_members m
    where m.association_id = association_subscriptions.association_id
      and m.user_id = (select auth.uid())
      and m.role in ('admin','presidente','tesoureiro')
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'platform_admin'
  )
);

revoke all on public.association_subscriptions from anon, authenticated;
grant select on public.association_subscriptions to authenticated;
revoke all on public.subscription_plans from anon;
grant select on public.subscription_plans to authenticated;

create or replace function public.is_valid_cpf(_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  total integer;
  remainder integer;
  d1 integer;
  d2 integer;
  i integer;
begin
  if length(digits) <> 11 or digits ~ '^(.)\1{10}$' then return false; end if;
  total := 0;
  for i in 1..9 loop total := total + substring(digits from i for 1)::integer * (11-i); end loop;
  remainder := (total * 10) % 11;
  d1 := case when remainder = 10 then 0 else remainder end;
  if d1 <> substring(digits from 10 for 1)::integer then return false; end if;
  total := 0;
  for i in 1..10 loop total := total + substring(digits from i for 1)::integer * (12-i); end loop;
  remainder := (total * 10) % 11;
  d2 := case when remainder = 10 then 0 else remainder end;
  return d2 = substring(digits from 11 for 1)::integer;
end;
$$;

create or replace function public.start_association_trial(
  _association_id uuid,
  _plan_code text,
  _responsible_cpf text,
  _billing_email text
)
returns public.association_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  verified_email text;
  normalized_cpf text := regexp_replace(coalesce(_responsible_cpf, ''), '\D', '', 'g');
  normalized_email text := lower(trim(coalesce(_billing_email, '')));
  new_subscription public.association_subscriptions;
begin
  if current_user_id is null then raise exception 'Autenticação obrigatória.' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.association_members m
    where m.association_id = _association_id
      and m.user_id = current_user_id
      and m.role in ('admin','presidente')
  ) and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = current_user_id and ur.role = 'platform_admin'
  ) then
    raise exception 'Somente administrador ou presidente da associação pode iniciar o teste.' using errcode = '42501';
  end if;

  select lower(u.email) into verified_email
  from auth.users u
  where u.id = current_user_id and u.email_confirmed_at is not null;

  if verified_email is null then
    raise exception 'Confirme o e-mail da sua conta antes de iniciar o teste gratuito.' using errcode = '22023';
  end if;
  if normalized_email <> verified_email then
    raise exception 'Use o mesmo e-mail confirmado da sua conta para o faturamento.' using errcode = '22023';
  end if;
  if not public.is_valid_cpf(normalized_cpf) then
    raise exception 'Informe um CPF válido do responsável financeiro.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.subscription_plans p where p.code = _plan_code and p.active) then
    raise exception 'Plano indisponível.' using errcode = '22023';
  end if;
  if exists (select 1 from public.association_subscriptions s where s.association_id = _association_id) then
    raise exception 'Esta associação já possui uma assinatura cadastrada. O teste gratuito não pode ser reiniciado.' using errcode = '23505';
  end if;
  if exists (select 1 from public.association_subscriptions s where s.responsible_cpf = normalized_cpf) then
    raise exception 'Este CPF já está vinculado a outra assinatura.' using errcode = '23505';
  end if;
  if exists (select 1 from public.association_subscriptions s where lower(s.billing_email) = normalized_email) then
    raise exception 'Este e-mail já está vinculado a outra assinatura.' using errcode = '23505';
  end if;

  insert into public.association_subscriptions (
    association_id, plan_code, responsible_cpf, billing_email, status,
    trial_started_at, trial_ends_at, created_by
  ) values (
    _association_id, _plan_code, normalized_cpf, normalized_email, 'trialing',
    now(), now() + interval '10 days', current_user_id
  ) returning * into new_subscription;

  return new_subscription;
end;
$$;

revoke all on function public.start_association_trial(uuid,text,text,text) from public, anon;
grant execute on function public.start_association_trial(uuid,text,text,text) to authenticated;
revoke all on function public.is_valid_cpf(text) from public, anon;
grant execute on function public.is_valid_cpf(text) to authenticated;

create or replace function public.refresh_association_subscription_usage(_association_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_residents integer;
  price numeric(10,2);
begin
  select count(*)::integer into active_residents
  from public.residents r
  where r.association_id = _association_id and r.is_active = true;

  select p.price_per_member_monthly into price
  from public.association_subscriptions s
  join public.subscription_plans p on p.code = s.plan_code
  where s.association_id = _association_id;

  update public.association_subscriptions
  set member_count_at_last_billing = active_residents,
      unit_price_at_last_billing = coalesce(price, 0),
      updated_at = now()
  where association_id = _association_id;
end;
$$;
revoke all on function public.refresh_association_subscription_usage(uuid) from public, anon, authenticated;
