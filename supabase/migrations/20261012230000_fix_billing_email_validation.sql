
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
  if not public.is_valid_cpf(normalized_cpf) then
    raise exception 'Informe um CPF válido do responsável financeiro.' using errcode = '22023';
  end if;
  if normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$' then
    raise exception 'Informe um e-mail de faturamento válido.' using errcode = '22023';
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
