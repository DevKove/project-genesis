-- Move caller-bound membership/role helpers out of the exposed public API schema.
-- RLS policies retain their function dependencies when PostgreSQL moves the
-- functions between schemas. PostgREST should not expose the private schema.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

ALTER FUNCTION public.is_assoc_manager(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.has_assoc_role(uuid, uuid, public.assoc_role[]) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_member(uuid, uuid) SET SCHEMA private;

-- SQL-language function bodies are stored as source text. Update the manager
-- helper after the schema move so its nested call resolves to the private helper.
CREATE OR REPLACE FUNCTION private.is_assoc_manager(
  _assoc uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT private.has_assoc_role(
    _assoc,
    _user,
    ARRAY['admin', 'presidente', 'secretario', 'tesoureiro']::public.assoc_role[]
  );
$function$;

-- Keep execution for authenticated RLS evaluation, but remove inherited/public
-- execution and the anonymous grant. The schema is not intended for PostgREST.
REVOKE EXECUTE ON FUNCTION private.has_assoc_role(uuid, uuid, public.assoc_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_assoc_role(uuid, uuid, public.assoc_role[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION private.is_assoc_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_assoc_manager(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION private.is_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_member(uuid, uuid) TO authenticated;
