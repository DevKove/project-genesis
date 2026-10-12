-- Morada360 role permissions: least privilege.
-- Residents can only read their own unit and their own incident/service-request records.
-- Secretary manages resident/unit/communication workflows; treasurer manages vendors.
-- Platform administration remains separate from association-level roles.

-- Units
drop policy if exists "members read units" on public.units;
drop policy if exists "managers insert units" on public.units;
drop policy if exists "managers update units" on public.units;
drop policy if exists "managers delete units" on public.units;
create policy "authorized staff read units" on public.units for select to authenticated
using (
  private.has_role((select auth.uid()), 'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id, (select auth.uid()), array['admin','presidente','secretario','tesoureiro']::public.assoc_role[])
  or exists (select 1 from public.residents r where r.association_id=units.association_id and r.unit_id=units.id and r.user_id=(select auth.uid()))
);
create policy "association admins and secretaries insert units" on public.units for insert to authenticated
with check (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "association admins and secretaries update units" on public.units for update to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]))
with check (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "association admins and secretaries delete units" on public.units for delete to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));

-- Residents: records are visible to their subject or authorized administration/secretariat.
drop policy if exists "managers read residents" on public.residents;
drop policy if exists "managers insert residents" on public.residents;
drop policy if exists "managers update residents" on public.residents;
drop policy if exists "managers delete residents" on public.residents;
create policy "residents read own record or authorized management" on public.residents for select to authenticated
using (user_id=(select auth.uid()) or private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "association admins and secretaries insert residents" on public.residents for insert to authenticated
with check (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "association admins and secretaries update residents" on public.residents for update to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]))
with check (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "association admins and secretaries delete residents" on public.residents for delete to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));

-- Vendors: administration, president and treasurer only.
drop policy if exists "managers create vendors" on public.vendors;
drop policy if exists "managers read vendors" on public.vendors;
drop policy if exists "managers update vendors" on public.vendors;
create policy "financial roles create vendors" on public.vendors for insert to authenticated
with check (created_by=(select auth.uid()) and private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','tesoureiro']::public.assoc_role[]));
create policy "financial roles read vendors" on public.vendors for select to authenticated
using (private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','tesoureiro']::public.assoc_role[]));
create policy "financial roles update vendors" on public.vendors for update to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','tesoureiro']::public.assoc_role[]))
with check (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','tesoureiro']::public.assoc_role[]));

-- Announcements: administration, president and secretary manage; members read.
drop policy if exists "managers delete announcements" on public.announcements;
drop policy if exists "managers insert announcements" on public.announcements;
drop policy if exists "managers update announcements" on public.announcements;
create policy "communication roles insert announcements" on public.announcements for insert to authenticated
with check (created_by=(select auth.uid()) and private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "communication roles update announcements" on public.announcements for update to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]))
with check (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "communication roles delete announcements" on public.announcements for delete to authenticated
using (private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));

-- Incidents: own or assigned records; employee updates only incidents assigned to themselves.
drop policy if exists "managers update incidents" on public.incidents;
drop policy if exists "members read own incidents and managers read all" on public.incidents;
create policy "users read own or assigned incidents and managers read all" on public.incidents for select to authenticated
using (created_by=(select auth.uid()) or assigned_to=(select auth.uid())
  or private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "authorized managers update incidents" on public.incidents for update to authenticated
using (private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[])
  or (assigned_to=(select auth.uid()) and private.has_assoc_role(association_id,(select auth.uid()),array['funcionario']::public.assoc_role[])))
with check (private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[])
  or (assigned_to=(select auth.uid()) and private.has_assoc_role(association_id,(select auth.uid()),array['funcionario']::public.assoc_role[])));

-- Service requests: own requests or administration/secretariat; treasurer is not a workflow manager.
drop policy if exists "managers update service requests" on public.service_requests;
drop policy if exists "members read own service requests and managers read all" on public.service_requests;
create policy "users read own service requests and authorized management" on public.service_requests for select to authenticated
using (created_by=(select auth.uid()) or private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
create policy "authorized managers update service requests" on public.service_requests for update to authenticated
using (private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]))
with check (private.has_role((select auth.uid()),'platform_admin'::public.app_role)
  or private.has_assoc_role(association_id,(select auth.uid()),array['admin','presidente','secretario']::public.assoc_role[]));
