-- Private identity documents for resident and vendor records.
-- Repository migration only: apply to Supabase after review and deployment planning.

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS identity_document_path text,
  ADD COLUMN IF NOT EXISTS identity_document_name text,
  ADD COLUMN IF NOT EXISTS identity_document_mime_type text,
  ADD COLUMN IF NOT EXISTS identity_document_size_bytes bigint;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS identity_document_path text,
  ADD COLUMN IF NOT EXISTS identity_document_name text,
  ADD COLUMN IF NOT EXISTS identity_document_mime_type text,
  ADD COLUMN IF NOT EXISTS identity_document_size_bytes bigint;

ALTER TABLE public.residents
  ADD CONSTRAINT residents_identity_document_metadata_check CHECK (
    (identity_document_path IS NULL AND identity_document_name IS NULL
      AND identity_document_mime_type IS NULL AND identity_document_size_bytes IS NULL)
    OR
    (identity_document_path IS NOT NULL AND identity_document_name IS NOT NULL
      AND identity_document_mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      AND identity_document_size_bytes BETWEEN 1 AND 10485760)
  );

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_identity_document_metadata_check CHECK (
    (identity_document_path IS NULL AND identity_document_name IS NULL
      AND identity_document_mime_type IS NULL AND identity_document_size_bytes IS NULL)
    OR
    (identity_document_path IS NOT NULL AND identity_document_name IS NOT NULL
      AND identity_document_mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      AND identity_document_size_bytes BETWEEN 1 AND 10485760)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-documents',
  'identity-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Objects use {association_id}/{residents|vendors}/{record_id}/{random_filename}.
-- Only association managers can upload, view, or remove these sensitive documents.
CREATE POLICY "identity documents managers read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'identity-documents'
  AND (storage.foldername(name))[2] IN ('residents', 'vendors')
  AND private.is_assoc_manager(((storage.foldername(name))[1])::uuid, (SELECT auth.uid()))
);

CREATE POLICY "identity documents managers upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'identity-documents'
  AND (storage.foldername(name))[2] IN ('residents', 'vendors')
  AND private.is_assoc_manager(((storage.foldername(name))[1])::uuid, (SELECT auth.uid()))
);

CREATE POLICY "identity documents managers delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'identity-documents'
  AND (storage.foldername(name))[2] IN ('residents', 'vendors')
  AND private.is_assoc_manager(((storage.foldername(name))[1])::uuid, (SELECT auth.uid()))
);
