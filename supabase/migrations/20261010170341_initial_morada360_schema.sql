-- Baseline Supabase migration mirrored from the original Drizzle schema migration.
-- Existing Supabase project records version 20261010170341 as applied.
-- Keep this historical baseline unchanged; subsequent fixes belong in new migrations.

-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('platform_admin', 'platform_staff');
CREATE TYPE public.assoc_role AS ENUM ('admin', 'presidente', 'tesoureiro', 'secretario', 'conselheiro', 'funcionario', 'morador');
CREATE TYPE public.resident_relation AS ENUM ('proprietario', 'inquilino', 'dependente', 'ocupante');

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== Global roles =====
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'));

-- ===== Associations (tenants) =====
CREATE TABLE public.associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trade_name text,
  cnpj text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  logo_url text,
  status text NOT NULL DEFAULT 'ativa',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.associations TO authenticated;
GRANT ALL ON public.associations TO service_role;
ALTER TABLE public.associations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.association_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.assoc_role NOT NULL DEFAULT 'morador',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.association_members TO authenticated;
GRANT ALL ON public.association_members TO service_role;
ALTER TABLE public.association_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member(_assoc uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.association_members WHERE association_id = _assoc AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.has_assoc_role(_assoc uuid, _user uuid, _roles public.assoc_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.association_members WHERE association_id = _assoc AND user_id = _user AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.is_assoc_manager(_assoc uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_assoc_role(_assoc, _user, ARRAY['admin','presidente','secretario','tesoureiro']::public.assoc_role[])
$$;

CREATE POLICY "members read association" ON public.associations FOR SELECT TO authenticated
  USING (public.is_member(id, auth.uid()) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "admins update association" ON public.associations FOR UPDATE TO authenticated
  USING (public.has_assoc_role(id, auth.uid(), ARRAY['admin','presidente']::public.assoc_role[]))
  WITH CHECK (public.has_assoc_role(id, auth.uid(), ARRAY['admin','presidente']::public.assoc_role[]));

CREATE POLICY "members read members" ON public.association_members FOR SELECT TO authenticated
  USING (public.is_member(association_id, auth.uid()) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "admins manage members insert" ON public.association_members FOR INSERT TO authenticated
  WITH CHECK (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin']::public.assoc_role[]));
CREATE POLICY "admins manage members update" ON public.association_members FOR UPDATE TO authenticated
  USING (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin']::public.assoc_role[]));
CREATE POLICY "admins manage members delete" ON public.association_members FOR DELETE TO authenticated
  USING (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin']::public.assoc_role[]) AND user_id <> auth.uid());

-- profiles policies (need is_member defined)
CREATE POLICY "read own or co-members profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.association_members m1 JOIN public.association_members m2 ON m1.association_id = m2.association_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ===== Units =====
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  identifier text NOT NULL,
  block text,
  street text,
  number text,
  unit_type text NOT NULL DEFAULT 'casa',
  status text NOT NULL DEFAULT 'ocupada',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id, identifier)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read units" ON public.units FOR SELECT TO authenticated USING (public.is_member(association_id, auth.uid()));
CREATE POLICY "managers insert units" ON public.units FOR INSERT TO authenticated WITH CHECK (public.is_assoc_manager(association_id, auth.uid()));
CREATE POLICY "managers update units" ON public.units FOR UPDATE TO authenticated USING (public.is_assoc_manager(association_id, auth.uid()));
CREATE POLICY "managers delete units" ON public.units FOR DELETE TO authenticated USING (public.is_assoc_manager(association_id, auth.uid()));

-- ===== Residents =====
CREATE TABLE public.residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  user_id uuid,
  full_name text NOT NULL,
  cpf text,
  email text,
  phone text,
  birth_date date,
  relation public.resident_relation NOT NULL DEFAULT 'proprietario',
  is_active boolean NOT NULL DEFAULT true,
  lgpd_consent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residents TO authenticated;
GRANT ALL ON public.residents TO service_role;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers read residents" ON public.residents FOR SELECT TO authenticated
  USING (public.is_assoc_manager(association_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "managers insert residents" ON public.residents FOR INSERT TO authenticated WITH CHECK (public.is_assoc_manager(association_id, auth.uid()));
CREATE POLICY "managers update residents" ON public.residents FOR UPDATE TO authenticated USING (public.is_assoc_manager(association_id, auth.uid()));
CREATE POLICY "managers delete residents" ON public.residents FOR DELETE TO authenticated USING (public.is_assoc_manager(association_id, auth.uid()));

-- ===== Invitations =====
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.assoc_role NOT NULL DEFAULT 'morador',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pendente',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read invitations" ON public.invitations FOR SELECT TO authenticated
  USING (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin','presidente','secretario']::public.assoc_role[]));
CREATE POLICY "admins create invitations" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid() AND public.has_assoc_role(association_id, auth.uid(), ARRAY['admin','presidente','secretario']::public.assoc_role[]));
CREATE POLICY "admins update invitations" ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin','presidente','secretario']::public.assoc_role[]));
CREATE POLICY "admins delete invitations" ON public.invitations FOR DELETE TO authenticated
  USING (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin','presidente','secretario']::public.assoc_role[]));

-- ===== Announcements =====
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read announcements" ON public.announcements FOR SELECT TO authenticated USING (public.is_member(association_id, auth.uid()));
CREATE POLICY "managers insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.is_assoc_manager(association_id, auth.uid()));
CREATE POLICY "managers update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.is_assoc_manager(association_id, auth.uid()));
CREATE POLICY "managers delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_assoc_manager(association_id, auth.uid()));

-- ===== Audit logs (append-only) =====
CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  association_id uuid,
  user_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_assoc_role(association_id, auth.uid(), ARRAY['admin','presidente']::public.assoc_role[]) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec jsonb; assoc uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := to_jsonb(OLD); ELSE rec := to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'associations' THEN assoc := (rec->>'id')::uuid; ELSE assoc := (rec->>'association_id')::uuid; END IF;
  INSERT INTO public.audit_logs (association_id, user_id, action, entity, entity_id, details)
  VALUES (assoc, auth.uid(), lower(TG_OP), TG_TABLE_NAME, rec->>'id',
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW)) ELSE rec END);
  RETURN NULL;
END $$;

CREATE TRIGGER audit_associations AFTER INSERT OR UPDATE OR DELETE ON public.associations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON public.association_members FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_units AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_residents AFTER INSERT OR UPDATE OR DELETE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_invitations AFTER INSERT OR UPDATE OR DELETE ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_announcements AFTER INSERT OR UPDATE OR DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER t_assoc BEFORE UPDATE ON public.associations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_units BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_res BEFORE UPDATE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_prof BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Signup -> profile =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RPC: create association =====
CREATE OR REPLACE FUNCTION public.create_association(_name text, _cnpj text DEFAULT NULL, _city text DEFAULT NULL, _state text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF length(trim(coalesce(_name,''))) < 3 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  INSERT INTO public.associations (name, cnpj, city, state, created_by) VALUES (trim(_name), _cnpj, _city, _state, auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.association_members (association_id, user_id, role) VALUES (new_id, auth.uid(), 'admin');
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_association(text,text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_association(text,text,text,text) TO authenticated;

-- ===== RPC: accept invitation =====
CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations; user_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  SELECT * INTO inv FROM public.invitations WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  IF inv.status <> 'pendente' THEN RAISE EXCEPTION 'Convite já utilizado ou cancelado'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Convite expirado'; END IF;
  IF lower(inv.email) <> lower(user_email) THEN RAISE EXCEPTION 'Este convite foi enviado para outro e-mail'; END IF;
  INSERT INTO public.association_members (association_id, user_id, role) VALUES (inv.association_id, auth.uid(), inv.role)
    ON CONFLICT (association_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.invitations SET status = 'aceito' WHERE id = inv.id;
  UPDATE public.residents SET user_id = auth.uid() WHERE association_id = inv.association_id AND lower(email) = lower(user_email) AND user_id IS NULL;
  RETURN inv.association_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
