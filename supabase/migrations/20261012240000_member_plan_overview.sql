
create or replace function public.get_my_association_plan(_association_id uuid)
returns table (
  plan_code text,
  status text,
  trial_ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan_code, s.status, s.trial_ends_at
  from public.association_subscriptions s
  where s.association_id = _association_id
    and exists (
      select 1 from public.association_members m
      where m.association_id = _association_id
        and m.user_id = (select auth.uid())
    )
  limit 1;
$$;
revoke all on function public.get_my_association_plan(uuid) from public, anon;
grant execute on function public.get_my_association_plan(uuid) to authenticated;
