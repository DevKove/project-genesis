-- Allow chat notifications and create them atomically when a chat message is sent.
-- Private messages notify only their recipient; general messages notify other members
-- of the same association. No payment tables or billing behavior are touched.

ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_notification_type_check;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_notification_type_check
  CHECK (notification_type IN (
    'solicitacao_membro',
    'solicitacao_aprovada',
    'solicitacao_recusada',
    'chat_general',
    'chat_private'
  ));

CREATE OR REPLACE FUNCTION public.notify_chat_message_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  message_preview text;
BEGIN
  message_preview := pg_catalog.left(
    COALESCE(NULLIF(pg_catalog.btrim(NEW.body), ''), 'Enviou uma imagem'),
    180
  );

  IF NEW.recipient_id IS NOT NULL THEN
    INSERT INTO public.user_notifications (
      recipient_id, association_id, notification_type, title, message
    )
    SELECT
      NEW.recipient_id,
      NEW.association_id,
      'chat_private',
      'Nova mensagem privada',
      message_preview
    WHERE NEW.recipient_id <> NEW.sender_id
      AND EXISTS (
        SELECT 1
        FROM public.association_members AS m
        WHERE m.association_id = NEW.association_id
          AND m.user_id = NEW.recipient_id
      );
  ELSE
    INSERT INTO public.user_notifications (
      recipient_id, association_id, notification_type, title, message
    )
    SELECT
      m.user_id,
      NEW.association_id,
      'chat_general',
      'Nova mensagem no chat geral',
      message_preview
    FROM public.association_members AS m
    WHERE m.association_id = NEW.association_id
      AND m.user_id <> NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_chat_message_recipients() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_chat_message_recipients_after_insert
  ON public.association_chat_messages;

CREATE TRIGGER notify_chat_message_recipients_after_insert
AFTER INSERT ON public.association_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_message_recipients();
