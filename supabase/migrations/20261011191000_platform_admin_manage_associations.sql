-- The associations table has no association_id column, so it needs an explicit global-admin policy.
CREATE POLICY platform_admin_manage_associations
ON public.associations
FOR ALL
TO authenticated
USING (public.has_role((select auth.uid()), 'platform_admin'::public.app_role))
WITH CHECK (public.has_role((select auth.uid()), 'platform_admin'::public.app_role));

COMMENT ON POLICY platform_admin_manage_associations ON public.associations IS
  'Global platform administration of association records. Tenant operational access is separately protected by association-scoped RLS policies.';
