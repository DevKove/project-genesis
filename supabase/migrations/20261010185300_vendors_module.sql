-- Association-scoped vendor directory; only managers can access it.
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_category text NOT NULL DEFAULT 'outros',
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendors_name_length_check CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  CONSTRAINT vendors_category_check CHECK (service_category IN ('manutencao','limpeza','seguranca','jardinagem','eletrica','hidraulica','tecnologia','outros')),
  CONSTRAINT vendors_contact_name_length_check CHECK (contact_name IS NULL OR char_length(contact_name) <= 160),
  CONSTRAINT vendors_phone_length_check CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT vendors_email_length_check CHECK (email IS NULL OR char_length(email) <= 254),
  CONSTRAINT vendors_notes_length_check CHECK (notes IS NULL OR char_length(notes) <= 3000)
);

CREATE INDEX vendors_association_active_name_idx
  ON public.vendors (association_id, is_active, name);

GRANT SELECT, INSERT, UPDATE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers read vendors"
  ON public.vendors FOR SELECT TO authenticated
  USING (private.is_assoc_manager(association_id, (SELECT auth.uid())));

CREATE POLICY "managers create vendors"
  ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_assoc_manager(association_id, (SELECT auth.uid()))
  );

CREATE POLICY "managers update vendors"
  ON public.vendors FOR UPDATE TO authenticated
  USING (private.is_assoc_manager(association_id, (SELECT auth.uid())))
  WITH CHECK (private.is_assoc_manager(association_id, (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.guard_vendor_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.association_id IS DISTINCT FROM OLD.association_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A identidade e a associação do prestador não podem ser alteradas'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_vendor_identity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_vendor_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  vendor_id text;
  association_id_value uuid;
  operation_name text;
  safe_details jsonb;
BEGIN
  operation_name := pg_catalog.lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    vendor_id := OLD.id::text;
    association_id_value := OLD.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'service_category', OLD.service_category, 'is_active', OLD.is_active,
      'campos_redigidos', pg_catalog.jsonb_build_array('name','contact_name','phone','email','notes')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    vendor_id := NEW.id::text;
    association_id_value := NEW.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'categoria_antes', OLD.service_category, 'categoria_depois', NEW.service_category,
      'ativo_antes', OLD.is_active, 'ativo_depois', NEW.is_active,
      'campos_redigidos', pg_catalog.jsonb_build_array('name','contact_name','phone','email','notes')
    );
  ELSE
    vendor_id := NEW.id::text;
    association_id_value := NEW.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'service_category', NEW.service_category, 'is_active', NEW.is_active,
      'campos_redigidos', pg_catalog.jsonb_build_array('name','contact_name','phone','email','notes')
    );
  END IF;

  INSERT INTO public.audit_logs (association_id, user_id, action, entity, entity_id, details)
  VALUES (association_id_value, auth.uid(), operation_name, 'vendors', vendor_id, safe_details);
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.audit_vendor_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER vendors_touch_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER vendors_guard_identity
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_identity();
CREATE TRIGGER vendors_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.audit_vendor_change();
