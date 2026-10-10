-- Server-side bounds for announcement input and an index for the tenant feed.
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_title_length_check
  CHECK (pg_catalog.char_length(pg_catalog.btrim(title)) BETWEEN 1 AND 160);

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_body_length_check
  CHECK (pg_catalog.char_length(pg_catalog.btrim(body)) BETWEEN 1 AND 10000);

CREATE INDEX announcements_association_pinned_created_idx
  ON public.announcements (association_id, pinned DESC, created_at DESC);
