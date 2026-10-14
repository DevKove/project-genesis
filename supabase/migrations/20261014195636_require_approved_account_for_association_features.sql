-- Prevent pending or rejected accounts from using association modules.
-- Platform administrators retain the intentional global bypass.
CREATE OR REPLACE FUNCTION public.has_association_feature(_association_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.account_status = 'approved'
      )
      AND EXISTS (
        SELECT 1
        FROM public.association_members m
        WHERE m.association_id = _association_id
          AND m.user_id = (SELECT auth.uid())
      )
      AND EXISTS (
        SELECT 1
        FROM public.association_subscriptions s
        WHERE s.association_id = _association_id
          AND (
            (s.status = 'active' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
            OR (s.status = 'trialing' AND s.trial_ends_at > now())
          )
          AND CASE
            WHEN lower(_feature) IN ('documents', 'documentos', 'vendors', 'prestadores', 'notifications', 'notificacoes')
              THEN s.plan_code IN ('gestao', 'profissional', 'premium')
            WHEN lower(_feature) IN ('chat', 'audit', 'auditoria', 'reports', 'relatorios')
              THEN s.plan_code IN ('profissional', 'premium')
            WHEN lower(_feature) IN ('settings', 'configuracoes')
              THEN s.plan_code = 'premium'
            ELSE false
          END
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.has_association_feature(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_association_feature(uuid, text) TO authenticated;
