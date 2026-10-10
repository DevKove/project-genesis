-- Make the public directory view security-invoker. A narrowly scoped private
-- SECURITY DEFINER helper returns only a member's display name after verifying
-- that the caller and target share the requested association.

CREATE OR REPLACE FUNCTION private.member_directory_name(
  _association_id uuid,
  _user_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p.full_name
  FROM public.profiles AS p
  WHERE p.id = _user_id
    AND EXISTS (
      SELECT 1
      FROM public.association_members AS viewer
      WHERE viewer.association_id = _association_id
        AND viewer.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.association_members AS target
      WHERE target.association_id = _association_id
        AND target.user_id = _user_id
    )
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION private.member_directory_name(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.member_directory_name(uuid, uuid) TO authenticated;

CREATE OR REPLACE VIEW public.association_member_directory
WITH (security_barrier = true, security_invoker = true)
AS
SELECT
  am.association_id,
  am.user_id,
  private.member_directory_name(am.association_id, am.user_id) AS full_name
FROM public.association_members AS am;
