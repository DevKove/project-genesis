-- Private, tenant-scoped document storage. Files are referenced by metadata
-- rows first so Storage RLS can validate association and visibility before access.

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'geral',
  visibility text NOT NULL DEFAULT 'associacao',
  file_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  deleted_at timestamptz,
  CONSTRAINT documents_title_length_check
    CHECK (pg_catalog.char_length(pg_catalog.btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT documents_description_length_check
    CHECK (description IS NULL OR pg_catalog.char_length(description) <= 2000),
  CONSTRAINT documents_category_check
    CHECK (category IN ('geral', 'atas', 'financeiro', 'contratos', 'regulamentos', 'manutencao', 'outros')),
  CONSTRAINT documents_visibility_check
    CHECK (visibility IN ('associacao', 'gestores')),
  CONSTRAINT documents_mime_type_check
    CHECK (mime_type IN (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )),
  CONSTRAINT documents_size_limit_check
    CHECK (size_bytes BETWEEN 1 AND 20971520),
  CONSTRAINT documents_file_path_check
    CHECK (file_path ~ ('^' || association_id::text || '/' || id::text || '/[A-Za-z0-9._-]+$'))
);

CREATE INDEX documents_association_created_idx
  ON public.documents (association_id, created_at DESC);

CREATE INDEX documents_association_visibility_idx
  ON public.documents (association_id, visibility)
  WHERE deleted_at IS NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
REVOKE ALL ON public.documents FROM anon;

CREATE POLICY "members read visible documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
    OR (
      private.is_member(association_id, (SELECT auth.uid()))
      AND (
        visibility = 'associacao'
        OR private.is_assoc_manager(association_id, (SELECT auth.uid()))
      )
    )
  )
);

CREATE POLICY "managers upload document metadata"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
  private.is_assoc_manager(association_id, (SELECT auth.uid()))
  AND uploaded_by = (SELECT auth.uid())
  AND deleted_at IS NULL
  AND file_path ~ ('^' || association_id::text || '/' || id::text || '/[A-Za-z0-9._-]+$')
);

CREATE POLICY "managers update document metadata"
ON public.documents
FOR UPDATE
TO authenticated
USING (
  private.is_assoc_manager(association_id, (SELECT auth.uid()))
  AND deleted_at IS NULL
)
WITH CHECK (
  private.is_assoc_manager(association_id, (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION private.guard_document_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.association_id IS DISTINCT FROM OLD.association_id
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.file_path IS DISTINCT FROM OLD.file_path
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A identidade, associação e caminho do documento não podem ser alterados'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION private.guard_document_identity() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_guard_identity
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION private.guard_document_identity();

CREATE OR REPLACE FUNCTION private.set_document_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION private.set_document_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_set_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION private.set_document_updated_at();

-- Redact document titles, descriptions, paths, and uploader IDs from snapshots.
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  old_row jsonb;
  new_row jsonb;
  source_row jsonb;
  sanitized_old jsonb;
  sanitized_new jsonb;
  association_id_value uuid;
  redacted_keys text[] := ARRAY[
    'cpf',
    'email',
    'phone',
    'birth_date',
    'notes',
    'token',
    'address',
    'zip_code',
    'cnpj',
    'avatar_url',
    'logo_url',
    'full_name',
    'body',
    'title',
    'description',
    'file_path',
    'uploaded_by',
    'created_by',
    'invited_by'
  ];
  changed_keys jsonb := '[]'::jsonb;
  redacted_changed_keys jsonb := '[]'::jsonb;
  details_value jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_row := pg_catalog.to_jsonb(NEW);
    old_row := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    new_row := pg_catalog.to_jsonb(NEW);
    old_row := pg_catalog.to_jsonb(OLD);
  ELSE
    old_row := pg_catalog.to_jsonb(OLD);
    new_row := NULL;
  END IF;

  source_row := COALESCE(new_row, old_row);

  IF TG_TABLE_NAME <> 'association_members' THEN
    redacted_keys := pg_catalog.array_append(redacted_keys, 'user_id');
  END IF;

  IF TG_TABLE_NAME = 'associations' THEN
    association_id_value := (source_row ->> 'id')::uuid;
  ELSE
    association_id_value := (source_row ->> 'association_id')::uuid;
  END IF;

  sanitized_old := CASE WHEN old_row IS NULL THEN NULL ELSE old_row - redacted_keys END;
  sanitized_new := CASE WHEN new_row IS NULL THEN NULL ELSE new_row - redacted_keys END;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb)
    INTO changed_keys
    FROM pg_catalog.jsonb_object_keys(old_row || new_row) AS k(key)
    WHERE old_row -> k.key IS DISTINCT FROM new_row -> k.key;

    SELECT COALESCE(pg_catalog.jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb)
    INTO redacted_changed_keys
    FROM pg_catalog.jsonb_object_keys(old_row || new_row) AS k(key)
    WHERE k.key = ANY(redacted_keys)
      AND old_row -> k.key IS DISTINCT FROM new_row -> k.key;

    details_value := pg_catalog.jsonb_build_object(
      'antes', sanitized_old,
      'depois', sanitized_new,
      'campos_alterados', changed_keys,
      'campos_redigidos', redacted_changed_keys
    );
  ELSE
    SELECT COALESCE(pg_catalog.jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb)
    INTO redacted_changed_keys
    FROM pg_catalog.jsonb_object_keys(source_row) AS k(key)
    WHERE k.key = ANY(redacted_keys);

    details_value := pg_catalog.jsonb_build_object(
      'registro', COALESCE(sanitized_new, sanitized_old),
      'campos_redigidos', redacted_changed_keys
    );
  END IF;

  INSERT INTO public.audit_logs (
    association_id,
    user_id,
    action,
    entity,
    entity_id,
    details
  )
  VALUES (
    association_id_value,
    auth.uid(),
    pg_catalog.lower(TG_OP),
    TG_TABLE_NAME,
    source_row ->> 'id',
    details_value
  );

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER documents_audit
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'association-documents',
  'association-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "members read visible association documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'association-documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents AS d
    WHERE d.file_path = storage.objects.name
      AND d.deleted_at IS NULL
      AND (
        private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
        OR (
          private.is_member(d.association_id, (SELECT auth.uid()))
          AND (
            d.visibility = 'associacao'
            OR private.is_assoc_manager(d.association_id, (SELECT auth.uid()))
          )
        )
      )
  )
);

CREATE POLICY "managers upload association documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'association-documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents AS d
    WHERE d.file_path = storage.objects.name
      AND d.deleted_at IS NULL
      AND d.uploaded_by = (SELECT auth.uid())
      AND d.association_id::text = (storage.foldername(storage.objects.name))[1]
      AND d.id::text = (storage.foldername(storage.objects.name))[2]
      AND private.is_assoc_manager(d.association_id, (SELECT auth.uid()))
  )
);

CREATE POLICY "managers delete association documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'association-documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents AS d
    WHERE d.file_path = storage.objects.name
      AND d.deleted_at IS NULL
      AND private.is_assoc_manager(d.association_id, (SELECT auth.uid()))
  )
);
