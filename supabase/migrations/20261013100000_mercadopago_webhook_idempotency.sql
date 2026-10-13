-- Make Mercado Pago approval application atomic and idempotent.
alter table public.mercadopago_subscription_payments
  add column if not exists billing_applied_at timestamptz,
  add column if not exists billing_period_start timestamptz,
  add column if not exists billing_period_end timestamptz;

create or replace function public.apply_mercadopago_payment_event(
  _payment_id uuid,
  _provider_payment_id text,
  _provider_status text,
  _paid_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.mercadopago_subscription_payments%rowtype;
  v_subscription public.association_subscriptions%rowtype;
  v_status text;
  v_now timestamptz := now();
  v_start timestamptz;
  v_end timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito ao serviço.' using errcode = '42501';
  end if;

  select * into v_payment
  from public.mercadopago_subscription_payments
  where id = _payment_id
  for update;

  if not found then
    raise exception 'Cobrança local não encontrada.' using errcode = 'P0002';
  end if;

  v_status := case _provider_status
    when 'approved' then 'APPROVED'
    when 'pending' then 'PENDING'
    when 'in_process' then 'PENDING'
    when 'rejected' then 'REJECTED'
    when 'cancelled' then 'CANCELLED'
    when 'refunded' then 'REFUNDED'
    when 'charged_back' then 'REFUNDED'
    else 'PENDING'
  end;

  select * into v_subscription
  from public.association_subscriptions
  where id = v_payment.subscription_id
  for update;

  if not found then
    raise exception 'Assinatura associada à cobrança não encontrada.' using errcode = 'P0002';
  end if;

  update public.mercadopago_subscription_payments
  set provider_payment_id = _provider_payment_id,
      provider_status = _provider_status,
      status = v_status,
      paid_at = case when _provider_status = 'approved' then coalesce(_paid_at, paid_at, v_now) else paid_at end,
      updated_at = v_now
  where id = v_payment.id;

  if _provider_status = 'approved'
     and v_payment.billing_applied_at is null
     and v_subscription.status not in ('cancelled', 'suspended') then
    v_start := case
      when v_subscription.current_period_end > v_now then v_subscription.current_period_end
      else v_now
    end;
    v_end := v_start + interval '1 month';

    update public.association_subscriptions
    set status = 'active',
        payment_provider = 'mercadopago',
        current_period_start = v_start,
        current_period_end = v_end,
        member_count_at_last_billing = v_payment.resident_count,
        unit_price_at_last_billing = v_payment.unit_price,
        updated_at = v_now
    where id = v_subscription.id;

    update public.mercadopago_subscription_payments
    set billing_applied_at = v_now,
        billing_period_start = v_start,
        billing_period_end = v_end,
        updated_at = v_now
    where id = v_payment.id;
  elsif _provider_status in ('refunded', 'charged_back')
        and v_payment.billing_applied_at is not null
        and v_payment.billing_period_end is not null
        and v_subscription.status = 'active'
        and v_subscription.current_period_end = v_payment.billing_period_end then
    update public.association_subscriptions
    set status = 'payment_required',
        current_period_end = v_now,
        updated_at = v_now
    where id = v_subscription.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'billing_applied', (
      select billing_applied_at is not null
      from public.mercadopago_subscription_payments
      where id = v_payment.id
    )
  );
end;
$$;

revoke all on function public.apply_mercadopago_payment_event(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_mercadopago_payment_event(uuid, text, text, timestamptz) to service_role;
