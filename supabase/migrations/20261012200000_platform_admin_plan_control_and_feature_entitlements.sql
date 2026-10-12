
-- Centralized feature entitlements. Only the platform administrator manages subscriptions.
drop policy if exists "Association managers can view their subscription" on public.association_subscriptions;
drop policy if exists "Platform administrators can view subscriptions" on public.association_subscriptions;
create policy "Platform administrators can view subscriptions"
on public.association_subscriptions for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'platform_admin'
  )
);

create or replace function public.has_association_feature(_association_id uuid, _feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid()) and ur.role = 'platform_admin'
    )
    or (
      _feature = 'chat'
      and exists (
        select 1
        from public.association_subscriptions s
        where s.association_id = _association_id
          and s.plan_code in ('profissional', 'premium')
          and (
            s.status = 'active'
            or (s.status = 'trialing' and s.trial_ends_at > now())
          )
      )
      and exists (
        select 1 from public.association_members m
        where m.association_id = _association_id and m.user_id = (select auth.uid())
      )
    );
$$;

revoke all on function public.has_association_feature(uuid,text) from public, anon;
grant execute on function public.has_association_feature(uuid,text) to authenticated;

-- The chat is an entitlement of Profissional and Premium only.
update public.subscription_plans
set features = '["Tudo do Gestão","Chat geral e mensagens privadas","Auditoria e histórico de atividades","Relatórios gerenciais avançados","Gestão ampliada de permissões","Atendimento prioritário"]'::jsonb
where code = 'profissional';
update public.subscription_plans
set features = '["Tudo do Profissional","Chat geral e mensagens privadas","Implantação assistida","Revisões periódicas de uso","Canal prioritário de suporte","Acesso antecipado a novidades"]'::jsonb
where code = 'premium';
update public.subscription_plans
set features = '["Tudo do Essencial","Documentos da associação","Gestão de prestadores","Alertas em tempo real"]'::jsonb
where code = 'gestao';

-- Restrict data access in the database, not only by hiding the chat button.
drop policy if exists "members read general and addressed chat messages" on public.association_chat_messages;
create policy "entitled members read general and addressed chat messages"
on public.association_chat_messages for select to authenticated
using (
  public.has_association_feature(association_id, 'chat')
  and private.is_member(association_id, (select auth.uid()))
  and (recipient_id is null or sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
);

drop policy if exists "members send general or private chat messages" on public.association_chat_messages;
create policy "entitled members send general or private chat messages"
on public.association_chat_messages for insert to authenticated
with check (
  public.has_association_feature(association_id, 'chat')
  and sender_id = (select auth.uid())
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

drop policy if exists "senders delete own chat messages" on public.association_chat_messages;
create policy "entitled senders delete own chat messages"
on public.association_chat_messages for delete to authenticated
using (
  public.has_association_feature(association_id, 'chat')
  and sender_id = (select auth.uid())
  and private.is_member(association_id, (select auth.uid()))
);

-- Image storage follows the same entitlement as chat messages.
drop policy if exists "Chat members upload images to their own folder" on storage.objects;
create policy "Entitled chat members upload images to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = ((select auth.uid()))::text
  and private.is_member(((storage.foldername(name))[1])::uuid, (select auth.uid()))
  and public.has_association_feature(((storage.foldername(name))[1])::uuid, 'chat')
  and storage.extension(name) = any (array['jpg','jpeg','png','webp','gif'])
);

drop policy if exists "Chat participants view message images" on storage.objects;
create policy "Entitled chat participants view message images"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-images'
  and exists (
    select 1 from public.association_chat_messages m
    where m.attachment_path = objects.name
      and public.has_association_feature(m.association_id, 'chat')
      and private.is_member(m.association_id, (select auth.uid()))
      and (m.recipient_id is null or m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
  )
);

drop policy if exists "Chat image owners delete own uploads" on storage.objects;
create policy "Entitled chat image owners delete own uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-images'
  and (storage.foldername(name))[2] = ((select auth.uid()))::text
  and public.has_association_feature(((storage.foldername(name))[1])::uuid, 'chat')
);
