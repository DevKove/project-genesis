-- List pending approvals through a narrowly scoped RPC so the workflow does
-- not depend on exposing the internal request table through the Data API.
CREATE OR REPLACE FUNCTION public.list_pending_account_access()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  requested_association_id uuid,
  status text,
  requested_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT r.id, r.user_id, r.email, r.full_name,
         r.requested_association_id, r.status, r.requested_at
  FROM public.account_access_requests r
  WHERE r.status = 'pending'
    AND private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
  ORDER BY r.requested_at ASC;
$function$;
REVOKE EXECUTE ON FUNCTION public.list_pending_account_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_account_access() TO authenticated;
