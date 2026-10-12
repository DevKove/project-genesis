
-- Only a platform administrator may create trials or assign/change plans.
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
  normalized_cpf text := regexp_replace(coalesce(_responsible_cpf, ''), '\\D', '', 'g');
  normalized_email text := lower(trim(coalesce(_billing_email, '')));
  new_subscription public.association_subscriptions;
begin
  if current_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = current_user_id and ur.role = 'platform_admin'
  ) then
    raise exception 'Somente o administrador do sistema pode gerenciar planos e iniciar avaliações.' using errcode = '42501';
  end if;

  select lower(u.email) into verified_email
  from auth.users u
  where u.id = current_user_id and u.email_confirmed_at is not null;

  if verified_email is null then
    raise exception 'Confirme o e-mail da conta de administrador antes de iniciar a avaliação.' using errcode = '22023';
  end if;
  if normalized_email <> verified_email then
    raise exception 'Use o mesmo e-mail confirmado da conta de administrador para o faturamento.' using errcode = '22023';
  end if;
  if not public.is_valid_cpf(normalized_cpf) then
    raise exception 'Informe um CPF válido do responsável financeiro.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.subscription_plans p where p.code = _plan_code and p.active) then
    raise exception 'Plano indisponível.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.associations a where a.id = _association_id) then
    raise exception 'Associação não encontrada.' using errcode = 'P0002';
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

create or replace function public.admin_change_association_plan(
  _association_id uuid,
  _plan_code text
)
returns public.association_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  changed_subscription public.association_subscriptions;
  selected_price numeric(10,2);
begin
  if current_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = current_user_id and ur.role = 'platform_admin'
  ) then
    raise exception 'Somente o administrador do sistema pode alterar planos.' using errcode = '42501';
  end if;

  select p.price_per_member_monthly into selected_price
  from public.subscription_plans p
  where p.code = _plan_code and p.active;
  if selected_price is null then
    raise exception 'Plano indisponível.' using errcode = '22023';
  end if;

  update public.association_subscriptions
  set plan_code = _plan_code,
      unit_price_at_last_billing = selected_price,
      updated_at = now()
  where association_id = _association_id
  returning * into changed_subscription;

  if changed_subscription.id is null then
    raise exception 'A associação ainda não possui assinatura. Inicie a avaliação para atribuir o primeiro plano.' using errcode = 'P0002';
  end if;

  return changed_subscription;
end;
$$;

revoke all on function public.admin_change_association_plan(uuid,text) from public, anon;
grant execute on function public.admin_change_association_plan(uuid,text) to authenticated;
