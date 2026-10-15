-- Require approved association accounts before exposing plan and billing details.
-- This migration was applied to the connected Supabase database as version 20261014195911.

CREATE OR REPLACE FUNCTION public.get_my_association_plan(_association_id uuid)
RETURNS TABLE(plan_code text, status text, trial_ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    s.plan_code,
    CASE
      WHEN s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end <= now())
        THEN 'past_due'
      ELSE s.status
    END,
    s.trial_ends_at
  FROM public.association_subscriptions s
  WHERE s.association_id = _association_id
    AND EXISTS (
      SELECT 1
      FROM public.association_members m
      WHERE m.association_id = _association_id
        AND m.user_id = (SELECT auth.uid())
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role = 'platform_admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.account_status = 'approved'
      )
    )
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_association_billing_status(_association_id uuid)
RETURNS TABLE(
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role = 'platform_admin'
  ) AND (
    NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_status = 'approved'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.association_members m
      WHERE m.association_id = _association_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('admin', 'presidente', 'tesoureiro')
    )
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para consultar a cobrança desta associação.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.plan_code,
    CASE
      WHEN s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end <= now())
        THEN 'past_due'
      ELSE s.status
    END,
    s.trial_ends_at,
    s.current_period_end,
    p.status,
    p.checkout_url,
    p.billing_period,
    p.amount,
    (
      EXISTS (
        SELECT 1 FROM public.association_members m
        WHERE m.association_id = s.association_id
          AND m.user_id = (SELECT auth.uid())
          AND m.role IN ('admin', 'presidente', 'tesoureiro')
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role = 'platform_admin'
      )
    )
  FROM public.association_subscriptions s
  LEFT JOIN LATERAL (
    SELECT mp.status, mp.checkout_url, mp.billing_period, mp.amount
    FROM public.mercadopago_subscription_payments mp
    WHERE mp.association_id = s.association_id
    ORDER BY mp.created_at DESC
    LIMIT 1
  ) p ON true
  WHERE s.association_id = _association_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_association_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_association_plan(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_association_billing_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_association_billing_status(uuid) TO authenticated;
