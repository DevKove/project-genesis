-- Add indexes for foreign-key columns flagged by Supabase's performance advisor.
-- Additive only: no rows, payments, or subscriptions are changed.
create index if not exists association_subscriptions_created_by_idx
  on public.association_subscriptions (created_by);
create index if not exists association_subscriptions_plan_code_idx
  on public.association_subscriptions (plan_code);
create index if not exists mercadopago_subscription_payments_created_by_idx
  on public.mercadopago_subscription_payments (created_by);
create index if not exists mercadopago_subscription_payments_subscription_id_idx
  on public.mercadopago_subscription_payments (subscription_id);
create index if not exists asaas_subscription_payments_subscription_id_idx
  on public.asaas_subscription_payments (subscription_id);
create index if not exists association_chat_messages_sender_id_idx
  on public.association_chat_messages (sender_id);
