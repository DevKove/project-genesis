-- Avoid multiple live invitation tokens for the same email in one association.
-- Expired pending invitations must be cancelled before a replacement is created.
CREATE UNIQUE INDEX invitations_one_pending_per_email_uidx
  ON public.invitations (association_id, pg_catalog.lower(email))
  WHERE status = 'pendente';
