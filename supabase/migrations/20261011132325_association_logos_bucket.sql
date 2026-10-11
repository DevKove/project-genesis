-- Public branding assets for association logos. Upload/delete remain manager-scoped.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'association-logos',
  'association-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "association managers upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'association-logos'
  AND EXISTS (
    SELECT 1
    FROM public.associations AS a
    WHERE a.id::text = (storage.foldername(storage.objects.name))[1]
      AND private.is_assoc_manager(a.id, (SELECT auth.uid()))
  )
);

CREATE POLICY "association managers delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'association-logos'
  AND EXISTS (
    SELECT 1
    FROM public.associations AS a
    WHERE a.id::text = (storage.foldername(storage.objects.name))[1]
      AND private.is_assoc_manager(a.id, (SELECT auth.uid()))
  )
);