-- MORADA360: billing lifecycle and plan-entitlement hardening.
-- Applied to Supabase project ivajgtokxrzwnspihllr on 2026-10-14.
-- This patch is intentionally additive: it preserves all associations, subscriptions,
-- payment records, and storage objects.

create or replace function public.has_association_feature(_association_id uuid, _feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid()) and ur.role = 'platform_admin'
    )
    or (
      exists (
        select 1 from public.association_members m
        where m.association_id = _association_id and m.user_id = (select auth.uid())
      )
      and exists (
        select 1 from public.association_subscriptions s
        where s.association_id = _association_id
          and (
            (s.status = 'active' and s.current_period_end is not null and s.current_period_end > now())
            or (s.status = 'trialing' and s.trial_ends_at > now())
          )
          and case
            when lower(_feature) in ('documents', 'documentos', 'vendors', 'prestadores', 'notifications', 'notificacoes')
              then s.plan_code in ('gestao', 'profissional', 'premium')
            when lower(_feature) in ('chat', 'audit', 'auditoria', 'reports', 'relatorios')
              then s.plan_code in ('profissional', 'premium')
            when lower(_feature) in ('settings', 'configuracoes')
              then s.plan_code = 'premium'
            else false
          end
      )
    );
$function$;

revoke all on function public.has_association_feature(uuid, text) from public, anon;
grant execute on function public.has_association_feature(uuid, text) to authenticated, service_role;

create or replace function public.initialize_association_subscription(
  _association_id uuid,
  _plan_code text,
  _responsible_cpf text,
  _billing_email text
)
returns public.association_subscriptions
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_subscription public.association_subscriptions;
  v_price numeric(10,2);
  v_resident_count integer;
  v_email text := lower(trim(coalesce(_billing_email, '')));
  v_cpf text := regexp_replace(coalesce(_responsible_cpf, ''), '[^0-9]', '', 'g');
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id and ur.role = 'platform_admin'
  ) then
    raise exception 'Somente o administrador da plataforma pode configurar a primeira assinatura.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.associations a where a.id = _association_id) then
    raise exception 'Associação não encontrada.' using errcode = 'P0002';
  end if;
  select p.price_per_member_monthly into v_price
  from public.subscription_plans p
  where p.code = _plan_code and p.active = true;
  if v_price is null then
    raise exception 'Plano indisponível.' using errcode = '22023';
  end if;
  if not public.is_valid_cpf(v_cpf) then
    raise exception 'Informe um CPF válido do responsável financeiro.' using errcode = '22023';
  end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$' then
    raise exception 'Informe um e-mail válido para faturamento.' using errcode = '22023';
  end if;
  if exists (select 1 from public.association_subscriptions s where s.association_id = _association_id) then
    raise exception 'Esta associação já possui uma assinatura.' using errcode = '23505';
  end if;
  select count(*)::integer into v_resident_count
  from public.residents r
  where r.association_id = _association_id and r.is_active = true;
  insert into public.association_subscriptions (
    association_id, plan_code, responsible_cpf, billing_email, status,
    trial_started_at, trial_ends_at, member_count_at_last_billing,
    unit_price_at_last_billing, created_by, updated_at
  )
  values (
    _association_id, _plan_code, v_cpf, v_email, 'payment_required',
    now(), now(), coalesce(v_resident_count, 0), v_price, v_user_id, now()
  )
  returning * into v_subscription;
  return v_subscription;
end;
$function$;

revoke all on function public.initialize_association_subscription(uuid, text, text, text) from public, anon;
grant execute on function public.initialize_association_subscription(uuid, text, text, text) to authenticated, service_role;

create or replace function public.get_my_association_plan(_association_id uuid)
returns table(plan_code text, status text, trial_ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $function$
  select s.plan_code,
    case when s.status = 'active'
      and (s.current_period_end is null or s.current_period_end <= now())
      then 'past_due' else s.status end,
    s.trial_ends_at
  from public.association_subscriptions s
  where s.association_id = _association_id
    and exists (
      select 1 from public.association_members m
      where m.association_id = _association_id and m.user_id = (select auth.uid())
    )
  limit 1;
$function$;

create or replace function public.get_my_association_billing_status(_association_id uuid)
returns table(
  plan_code text, subscription_status text, trial_ends_at timestamptz,
  current_period_end timestamptz, latest_payment_status text,
  latest_payment_url text, latest_payment_period date,
  latest_payment_amount numeric, can_pay boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.association_members m
    where m.association_id = _association_id and m.user_id = auth.uid()
      and m.role in ('admin','presidente','tesoureiro')
  ) and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'platform_admin'
  ) then
    raise exception 'Você não tem permissão para consultar a cobrança desta associação.' using errcode = '42501';
  end if;
  return query
  select s.plan_code,
    case when s.status = 'active'
      and (s.current_period_end is null or s.current_period_end <= now())
      then 'past_due' else s.status end,
    s.trial_ends_at, s.current_period_end,
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
    order by mp.created_at desc limit 1
  ) p on true
  where s.association_id = _association_id;
end;
$function$;

revoke all on function public.get_my_association_plan(uuid) from public, anon;
grant execute on function public.get_my_association_plan(uuid) to authenticated, service_role;
revoke all on function public.get_my_association_billing_status(uuid) from public, anon;
grant execute on function public.get_my_association_billing_status(uuid) to authenticated, service_role;

alter policy "members read visible documents" on public.documents
using (
  deleted_at is null and public.has_association_feature(association_id, 'documents')
  and (
    private.has_role((select auth.uid()), 'platform_admin'::app_role)
    or (private.is_member(association_id, (select auth.uid()))
      and (visibility = 'associacao' or private.is_assoc_manager(association_id, (select auth.uid()))))
  )
);
alter policy "managers upload document metadata" on public.documents
with check (
  public.has_association_feature(association_id, 'documents')
  and private.is_assoc_manager(association_id, (select auth.uid()))
  and uploaded_by = (select auth.uid()) and deleted_at is null
  and file_path ~ ('^' || association_id::text || '/' || id::text || '/[A-Za-z0-9._-]+$')
);
alter policy "managers update document metadata" on public.documents
using (public.has_association_feature(association_id, 'documents')
  and private.is_assoc_manager(association_id, (select auth.uid())) and deleted_at is null)
with check (public.has_association_feature(association_id, 'documents')
  and private.is_assoc_manager(association_id, (select auth.uid())));

alter policy "financial roles read vendors" on public.vendors
using (public.has_association_feature(association_id, 'vendors')
  and (private.has_role((select auth.uid()), 'platform_admin'::app_role)
    or private.has_assoc_role(association_id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role, 'tesoureiro'::assoc_role])));
alter policy "financial roles create vendors" on public.vendors
with check (public.has_association_feature(association_id, 'vendors')
  and created_by = (select auth.uid())
  and private.has_assoc_role(association_id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role, 'tesoureiro'::assoc_role]));
alter policy "financial roles update vendors" on public.vendors
using (public.has_association_feature(association_id, 'vendors')
  and private.has_assoc_role(association_id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role, 'tesoureiro'::assoc_role]))
with check (public.has_association_feature(association_id, 'vendors')
  and private.has_assoc_role(association_id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role, 'tesoureiro'::assoc_role]));

alter policy "admins read audit" on public.audit_logs
using (public.has_association_feature(association_id, 'audit')
  and (private.has_assoc_role(association_id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role])
    or private.has_role((select auth.uid()), 'platform_admin'::app_role)));

alter policy "admins update association" on public.associations
using (public.has_association_feature(id, 'settings')
  and private.has_assoc_role(id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role]))
with check (public.has_association_feature(id, 'settings')
  and private.has_assoc_role(id, (select auth.uid()), array['admin'::assoc_role, 'presidente'::assoc_role]));

alter policy "members read visible association documents" on storage.objects
using (
  bucket_id = 'association-documents'
  and exists (
    select 1 from public.documents d
    where d.file_path = objects.name and d.deleted_at is null
      and public.has_association_feature(d.association_id, 'documents')
      and (private.has_role((select auth.uid()), 'platform_admin'::app_role)
        or (private.is_member(d.association_id, (select auth.uid()))
          and (d.visibility = 'associacao' or private.is_assoc_manager(d.association_id, (select auth.uid())))))
  )
);
alter policy "managers upload association documents" on storage.objects
with check (
  bucket_id = 'association-documents'
  and exists (
    select 1 from public.documents d
    where d.file_path = objects.name and d.deleted_at is null
      and d.uploaded_by = (select auth.uid())
      and d.association_id::text = (storage.foldername(objects.name))[1]
      and d.id::text = (storage.foldername(objects.name))[2]
      and public.has_association_feature(d.association_id, 'documents')
      and private.is_assoc_manager(d.association_id, (select auth.uid()))
  )
);
alter policy "managers delete association documents" on storage.objects
using (
  bucket_id = 'association-documents'
  and exists (
    select 1 from public.documents d
    where d.file_path = objects.name and d.deleted_at is null
      and public.has_association_feature(d.association_id, 'documents')
      and private.is_assoc_manager(d.association_id, (select auth.uid()))
  )
);
