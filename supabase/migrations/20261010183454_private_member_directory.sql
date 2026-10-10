-- Keep phone/avatar data private to each profile owner. Expose only the
-- minimum directory fields to members of the same association through a view.

DROP POLICY IF EXISTS "read own or co-members profile" ON public.profiles;

CREATE POLICY "read own profile or platform admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
);

CREATE VIEW public.association_member_directory
WITH (security_barrier = true)
AS
SELECT
  am.association_id,
  am.user_id,
  p.full_name
FROM public.association_members AS am
LEFT JOIN public.profiles AS p ON p.id = am.user_id
WHERE EXISTS (
  SELECT 1
  FROM public.association_members AS viewer
  WHERE viewer.association_id = am.association_id
    AND viewer.user_id = (SELECT auth.uid())
);

REVOKE ALL ON public.association_member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.association_member_directory TO authenticated;

COMMENT ON VIEW public.association_member_directory IS
  'Minimal member directory: only users in an association shared with auth.uid(), and no phone/avatar fields.';
