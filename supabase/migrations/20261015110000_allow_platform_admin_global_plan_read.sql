-- Allow the global platform administrator to inspect any association plan without membership.
-- Ordinary users still need an approved account and membership in the requested association.
-- Applied to the connected Supabase project as migration allow_platform_admin_global_plan_read.

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
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role = 'platform_admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.association_members m
        WHERE m.association_id = _association_id
          AND m.user_id = (SELECT auth.uid())
      )
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

REVOKE ALL ON FUNCTION public.get_my_association_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_association_plan(uuid) TO authenticated;
