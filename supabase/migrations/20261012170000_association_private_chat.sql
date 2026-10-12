alter table public.association_chat_messages
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade;

create index if not exists association_chat_messages_recipient_created_idx
  on public.association_chat_messages (recipient_id, created_at desc)
  where recipient_id is not null;

drop policy if exists "association members read chat messages" on public.association_chat_messages;
drop policy if exists "members read general and addressed chat messages" on public.association_chat_messages;
create policy "members read general and addressed chat messages"
on public.association_chat_messages for select to authenticated
using (
  private.is_member(association_id, (select auth.uid()))
  and (
    recipient_id is null
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  )
);

drop policy if exists "association members send chat messages" on public.association_chat_messages;
drop policy if exists "members send general or private chat messages" on public.association_chat_messages;
create policy "members send general or private chat messages"
on public.association_chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and private.is_member(association_id, (select auth.uid()))
  and (
    recipient_id is null
    or (
      recipient_id <> (select auth.uid())
      and exists (
        select 1 from public.association_members target
        where target.association_id = association_chat_messages.association_id
          and target.user_id = association_chat_messages.recipient_id
      )
    )
  )
);
