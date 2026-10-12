create table if not exists public.association_chat_messages (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists association_chat_messages_association_created_idx
  on public.association_chat_messages (association_id, created_at desc);

alter table public.association_chat_messages enable row level security;

drop policy if exists "association members read chat messages" on public.association_chat_messages;
create policy "association members read chat messages"
on public.association_chat_messages for select to authenticated
using (private.is_member(association_id, (select auth.uid())));

drop policy if exists "association members send chat messages" on public.association_chat_messages;
create policy "association members send chat messages"
on public.association_chat_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and private.is_member(association_id, (select auth.uid()))
);

drop policy if exists "senders delete own chat messages" on public.association_chat_messages;
create policy "senders delete own chat messages"
on public.association_chat_messages for delete to authenticated
using (
  sender_id = (select auth.uid())
  and private.is_member(association_id, (select auth.uid()))
);

grant select, insert, delete on public.association_chat_messages to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'association_chat_messages'
  ) then
    alter publication supabase_realtime add table public.association_chat_messages;
  end if;
end $$;