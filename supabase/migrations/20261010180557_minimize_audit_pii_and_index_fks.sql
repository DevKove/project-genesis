-- Reduce personal/sensitive data duplicated in audit snapshots.
-- Preserve non-sensitive values and the names of changed/redacted fields so
-- the audit trail remains useful without retaining CPF, contact data, tokens,
-- birth dates, addresses, or free-text notes/body content.

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'created_by',
    'invited_by'
  ];
  changed_keys jsonb := '[]'::jsonb;
  redacted_changed_keys jsonb := '[]'::jsonb;
  details_value jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_row := to_jsonb(NEW);
    old_row := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    new_row := to_jsonb(NEW);
    old_row := to_jsonb(OLD);
  ELSE
    old_row := to_jsonb(OLD);
    new_row := NULL;
  END IF;

  source_row := COALESCE(new_row, old_row);

  -- The target member UUID is useful for auditing access changes. For other
  -- entities, user_id is redacted along with other personal identifiers.
  IF TG_TABLE_NAME <> 'association_members' THEN
    redacted_keys := array_append(redacted_keys, 'user_id');
  END IF;

  IF TG_TABLE_NAME = 'associations' THEN
    association_id_value := (source_row ->> 'id')::uuid;
  ELSE
    association_id_value := (source_row ->> 'association_id')::uuid;
  END IF;

  sanitized_old := CASE WHEN old_row IS NULL THEN NULL ELSE old_row - redacted_keys END;
  sanitized_new := CASE WHEN new_row IS NULL THEN NULL ELSE new_row - redacted_keys END;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb)
    INTO changed_keys
    FROM jsonb_object_keys(old_row || new_row) AS k(key)
    WHERE old_row -> k.key IS DISTINCT FROM new_row -> k.key;

    SELECT COALESCE(jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb)
    INTO redacted_changed_keys
    FROM jsonb_object_keys(old_row || new_row) AS k(key)
    WHERE k.key = ANY(redacted_keys)
      AND old_row -> k.key IS DISTINCT FROM new_row -> k.key;

    details_value := jsonb_build_object(
      'antes', sanitized_old,
      'depois', sanitized_new,
      'campos_alterados', changed_keys,
      'campos_redigidos', redacted_changed_keys
    );
  ELSE
    SELECT COALESCE(jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb)
    INTO redacted_changed_keys
    FROM jsonb_object_keys(source_row) AS k(key)
    WHERE k.key = ANY(redacted_keys);

    details_value := jsonb_build_object(
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
    lower(TG_OP),
    TG_TABLE_NAME,
    source_row ->> 'id',
    details_value
  );

  RETURN NULL;
END;
$function$;

-- Cover the foreign-key access patterns identified by Supabase Performance Advisor.
CREATE INDEX IF NOT EXISTS announcements_association_id_idx
  ON public.announcements (association_id);

CREATE INDEX IF NOT EXISTS invitations_association_id_idx
  ON public.invitations (association_id);

CREATE INDEX IF NOT EXISTS residents_association_id_idx
  ON public.residents (association_id);

CREATE INDEX IF NOT EXISTS residents_unit_id_idx
  ON public.residents (unit_id);
