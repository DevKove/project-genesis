-- Platform administrators may operate within any selected tenant.
-- This does not create fake association memberships. The global role is checked by RLS.
-- Audit logs remain append-only and are deliberately excluded from broad CRUD access.
DO $migration$
DECLARE
  t record;
  policy_name text := 'platform_admin_manage_tenant_rows';
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'association_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND c.relrowsecurity = true
      AND c.relname <> 'audit_logs'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policies p
      WHERE p.schemaname = t.schema_name
        AND p.tablename = t.table_name
        AND p.policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO authenticated USING (public.has_role((select auth.uid()), %L::public.app_role)) WITH CHECK (public.has_role((select auth.uid()), %L::public.app_role))',
        policy_name, t.schema_name, t.table_name, 'platform_admin', 'platform_admin'
      );
    END IF;
  END LOOP;
END
$migration$;

COMMENT ON POLICY platform_admin_manage_tenant_rows ON public.association_members IS
  'Allows authenticated platform_admin users to administer tenant-scoped rows across associations; membership rows remain distinct from global roles.';
