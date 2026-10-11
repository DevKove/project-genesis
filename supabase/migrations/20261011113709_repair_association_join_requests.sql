
create table if not exists public.association_join_requests (
  id uuid primary key default gen_random_uuid(),
  association_id uuid not null references public.associations(id) on delete cascade,
  association_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text,
  constraint association_join_requests_unique_pending unique (association_id, user_id, status)
);
create index if not exists association_join_requests_pending_idx
  on public.association_join_requests (association_id, requested_at)
  where status = 'pendente';

alter table public.association_join_requests enable row level security;
drop policy if exists "members admins read association join requests" on public.association_join_requests;
create policy "members admins read association join requests"
  on public.association_join_requests for select to authenticated
  using (private.has_assoc_role(association_id, (select auth.uid()), array['admin']::public.assoc_role[]));

drop policy if exists "users read own association join requests" on public.association_join_requests;
create policy "users read own association join requests"
  on public.association_join_requests for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.association_join_requests from anon, public;
grant select on public.association_join_requests to authenticated;

create or replace function public.request_association_membership(_association_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _user_id uuid := auth.uid();
  _name text;
  _email text;
  _association_name text;
  _request_id uuid;
begin
  if _user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = _user_id and p.account_status = 'approved') then
    raise exception 'Account must be approved before requesting association access' using errcode = '42501';
  end if;
  select a.name into _association_name from public.associations a where a.id = _association_id;
  if _association_name is null then raise exception 'Association not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.association_members m where m.association_id = _association_id and m.user_id = _user_id) then
    raise exception 'Already a member of this association' using errcode = '23505';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), nullif(btrim(u.raw_user_meta_data->>'name'), '')),
         lower(u.email)
    into _name, _email
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = _user_id;
  if _email is null then raise exception 'User email not found'; end if;

  select r.id into _request_id
  from public.association_join_requests r
  where r.association_id = _association_id and r.user_id = _user_id and r.status = 'pendente'
  limit 1;
  if _request_id is not null then return _request_id; end if;

  insert into public.association_join_requests(association_id, association_name, user_id, full_name, email)
  values (_association_id, _association_name, _user_id, _name, _email)
  returning id into _request_id;
  return _request_id;
end;
$function$;

create or replace function public.review_association_join_request(_request_id uuid, _decision text, _note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  _request public.association_join_requests%rowtype;
  _user_id uuid := auth.uid();
begin
  if _user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if _decision not in ('aprovado','rejeitado') then raise exception 'Invalid decision'; end if;
  select * into _request
  from public.association_join_requests r
  where r.id = _request_id
  for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if not private.has_assoc_role(_request.association_id, _user_id, array['admin']::public.assoc_role[]) then
    raise exception 'Only association administrators can review requests' using errcode = '42501';
  end if;
  if _request.status <> 'pendente' then raise exception 'Request already reviewed' using errcode = 'P0001'; end if;

  update public.association_join_requests
  set status = _decision,
      reviewed_at = now(),
      reviewed_by = _user_id,
      review_note = left(nullif(btrim(_note), ''), 500)
  where id = _request_id;

  if _decision = 'aprovado' then
    if not exists (select 1 from public.association_members m where m.association_id = _request.association_id and m.user_id = _request.user_id) then
      insert into public.association_members(association_id, user_id, role)
      values (_request.association_id, _request.user_id, 'morador'::public.assoc_role);
    end if;
  end if;
  return _decision;
end;
$function$;

revoke all on function public.request_association_membership(uuid) from public, anon;
grant execute on function public.request_association_membership(uuid) to authenticated;
revoke all on function public.review_association_join_request(uuid, text, text) from public, anon;
grant execute on function public.review_association_join_request(uuid, text, text) to authenticated;
