-- Disable the free trial for existing and future subscription setup.
-- Existing trialing subscriptions become payment_required so the UI and payment API agree.
UPDATE public.association_subscriptions
SET status = 'payment_required',
    trial_ends_at = LEAST(trial_ends_at, now()),
    updated_at = now()
WHERE status = 'trialing';

-- Keep the legacy RPC callable for a clear user-facing error, but never start a new trial.
CREATE OR REPLACE FUNCTION public.start_association_trial(
  _association_id uuid,
  _plan_code text,
  _responsible_cpf text,
  _billing_email text
)
RETURNS public.association_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.' USING ERRCODE = '28000';
  END IF;
  RAISE EXCEPTION 'O período de avaliação gratuita foi desativado. Configure a assinatura e escolha um meio de pagamento.'
    USING ERRCODE = '22023';
END;
$function$;

REVOKE ALL ON FUNCTION public.start_association_trial(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_association_trial(uuid, text, text, text) TO authenticated;
