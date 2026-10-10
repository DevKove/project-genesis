-- Public association logos are intentionally readable by URL, but only association
-- administrators and presidents may upload, replace, or remove them.
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
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "association admins upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'association-logos'
  AND EXISTS (
    SELECT 1
    FROM public.associations AS a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND private.has_assoc_role(
        a.id,
        (SELECT auth.uid()),
        ARRAY['admin', 'presidente']::public.assoc_role[]
      )
  )
);

CREATE POLICY "association admins update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'association-logos'
  AND EXISTS (
    SELECT 1
    FROM public.associations AS a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND private.has_assoc_role(
        a.id,
        (SELECT auth.uid()),
        ARRAY['admin', 'presidente']::public.assoc_role[]
      )
  )
)
WITH CHECK (
  bucket_id = 'association-logos'
  AND EXISTS (
    SELECT 1
    FROM public.associations AS a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND private.has_assoc_role(
        a.id,
        (SELECT auth.uid()),
        ARRAY['admin', 'presidente']::public.assoc_role[]
      )
  )
);

CREATE POLICY "association admins delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'association-logos'
  AND EXISTS (
    SELECT 1
    FROM public.associations AS a
    WHERE a.id::text = (storage.foldername(name))[1]
      AND private.has_assoc_role(
        a.id,
        (SELECT auth.uid()),
        ARRAY['admin', 'presidente']::public.assoc_role[]
      )
  )
);
