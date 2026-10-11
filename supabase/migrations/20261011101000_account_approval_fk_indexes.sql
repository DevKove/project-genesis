-- Cover foreign keys added by the account approval workflow.
CREATE INDEX IF NOT EXISTS account_access_requests_requested_association_idx
  ON public.account_access_requests (requested_association_id)
  WHERE requested_association_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS account_access_requests_reviewed_by_idx
  ON public.account_access_requests (reviewed_by)
  WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_approved_by_idx
  ON public.profiles (approved_by)
  WHERE approved_by IS NOT NULL;
