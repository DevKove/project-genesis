alter table public.association_chat_messages
  add column if not exists attachment_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat members upload images to their own folder" on storage.objects;
create policy "Chat members upload images to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and private.is_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists "Chat participants view message images" on storage.objects;
create policy "Chat participants view message images"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-images'
  and exists (
    select 1
    from public.association_chat_messages m
    where m.attachment_path = storage.objects.name
      and private.is_member(m.association_id, (select auth.uid()))
      and (
        m.recipient_id is null
        or m.sender_id = (select auth.uid())
        or m.recipient_id = (select auth.uid())
      )
  )
);

drop policy if exists "Chat image owners delete own uploads" on storage.objects;
create policy "Chat image owners delete own uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
