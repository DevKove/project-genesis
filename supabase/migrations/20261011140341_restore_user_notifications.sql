-- Restore the in-app notification table and event triggers used by NotificationCenter.
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  association_id uuid REFERENCES public.associations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.association_join_requests(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('solicitacao_membro', 'solicitacao_aprovada', 'solicitacao_recusada')),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_notifications_recipient_created_idx ON public.user_notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx ON public.user_notifications (recipient_id, created_at DESC) WHERE read_at IS NULL;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_notifications FROM anon, public;
GRANT SELECT ON public.user_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications" ON public.user_notifications FOR SELECT TO authenticated USING (recipient_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.user_notifications;
CREATE POLICY "Users mark own notifications read" ON public.user_notifications FOR UPDATE TO authenticated USING (recipient_id = (SELECT auth.uid())) WITH CHECK (recipient_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_admins_of_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  INSERT INTO public.user_notifications (recipient_id, association_id, request_id, notification_type, title, message)
  SELECT m.user_id, NEW.association_id, NEW.id, 'solicitacao_membro',
         'Novo pedido de acesso',
         COALESCE(NULLIF(pg_catalog.btrim(NEW.full_name), ''), 'Um usuário') || ' solicitou acesso à associação ' || NEW.association_name || '.'
  FROM public.association_members AS m
  WHERE m.association_id = NEW.association_id AND m.role = 'admin';
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.notify_admins_of_join_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_admins_after_join_request ON public.association_join_requests;
CREATE TRIGGER notify_admins_after_join_request AFTER INSERT ON public.association_join_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admins_of_join_request();

CREATE OR REPLACE FUNCTION public.notify_applicant_of_join_request_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovado', 'rejeitado') THEN
    INSERT INTO public.user_notifications (recipient_id, association_id, request_id, notification_type, title, message)
    VALUES (
      NEW.user_id, NEW.association_id, NEW.id,
      CASE WHEN NEW.status = 'aprovado' THEN 'solicitacao_aprovada' ELSE 'solicitacao_recusada' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Acesso aprovado' ELSE 'Solicitação recusada' END,
      CASE WHEN NEW.status = 'aprovado'
        THEN 'Seu acesso à associação ' || NEW.association_name || ' foi aprovado.'
        ELSE 'Sua solicitação de acesso à associação ' || NEW.association_name || ' não foi aprovada.'
      END
    );
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.notify_applicant_of_join_request_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_applicant_after_join_request_review ON public.association_join_requests;
CREATE TRIGGER notify_applicant_after_join_request_review AFTER UPDATE OF status ON public.association_join_requests FOR EACH ROW EXECUTE FUNCTION public.notify_applicant_of_join_request_review();
