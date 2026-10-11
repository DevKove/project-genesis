
DROP POLICY IF EXISTS "platform admins update all profiles" ON public.profiles;

CREATE POLICY "platform admins update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
)
WITH CHECK (
  private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
);
