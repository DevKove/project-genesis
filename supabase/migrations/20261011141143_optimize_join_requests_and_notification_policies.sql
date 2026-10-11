CREATE INDEX IF NOT EXISTS association_join_requests_reviewed_by_idx
  ON public.association_join_requests (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS association_join_requests_user_id_idx
  ON public.association_join_requests (user_id);
CREATE INDEX IF NOT EXISTS user_notifications_association_id_idx
  ON public.user_notifications (association_id)
  WHERE association_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_notifications_request_id_idx
  ON public.user_notifications (request_id)
  WHERE request_id IS NOT NULL;

DROP POLICY IF EXISTS "members admins read association join requests" ON public.association_join_requests;
DROP POLICY IF EXISTS "users read own association join requests" ON public.association_join_requests;
DROP POLICY IF EXISTS "Applicants and association admins read join requests" ON public.association_join_requests;
CREATE POLICY "Applicants and association admins read join requests"
  ON public.association_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.has_assoc_role(
      association_id,
      (SELECT auth.uid()),
      ARRAY['admin']::public.assoc_role[]
    )
  );

DROP POLICY IF EXISTS "platform admins update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users update own profile or platform admin" ON public.profiles;
CREATE POLICY "users update own profile or platform admin"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
  );
