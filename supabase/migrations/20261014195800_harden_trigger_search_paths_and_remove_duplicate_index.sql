-- Remove a duplicate partial index while preserving the identical, more descriptive index.
drop index if exists public.user_notifications_unread_idx;

-- Trigger/RPC functions fully qualify application objects; pin their search_path to
-- the empty path so future objects in public cannot shadow built-ins or dependencies.
alter function public.notify_association_communication() set search_path = '';
alter function public.notify_chat_message() set search_path = '';
alter function public.request_account_reapproval() set search_path = '';
