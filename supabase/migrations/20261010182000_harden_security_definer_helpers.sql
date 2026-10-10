-- Phase 1 security hardening for exposed SECURITY DEFINER helpers.
-- Keep helper functions usable by authenticated RLS policies, but prevent
-- callers from probing membership/role state for arbitrary user IDs.
-- Trigger functions are invoked by PostgreSQL triggers, not as RPC endpoints.

CREATE OR REPLACE FUNCTION public.has_assoc_role(
  _assoc uuid,
  _user uuid,
  _roles public.assoc_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.association_members
      WHERE association_id = _assoc
        AND user_id = _user
        AND role = ANY(_roles)
    );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user_id = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_assoc_manager(
  _assoc uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_assoc_role(
    _assoc,
    _user,
    ARRAY['admin', 'presidente', 'secretario', 'tesoureiro']::public.assoc_role[]
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_member(
  _assoc uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.association_members
      WHERE association_id = _assoc
        AND user_id = _user
    );
$function$;

-- SECURITY DEFINER trigger functions are not public RPCs. PostgreSQL checks
-- function execution privileges when a trigger is created; existing triggers
-- continue to execute after these grants are removed.
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- These helpers are referenced by RLS policies, so authenticated must retain
-- EXECUTE. They now return no positive result for another user's ID.
REVOKE EXECUTE ON FUNCTION public.has_assoc_role(uuid, uuid, public.assoc_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_assoc_role(uuid, uuid, public.assoc_role[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_assoc_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assoc_manager(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
