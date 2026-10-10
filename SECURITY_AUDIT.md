# Morada360 — technical and security audit

Audit snapshot: 2026-10-10  
Repository: `DevKove/project-genesis`  
Supabase project: `ivajgtokxrzwnspihllr`

## Verified application and repository state

- The application uses TanStack Start, React/TypeScript, and Supabase.
- Authenticated routes validate the current user through Supabase Auth and fail closed when session validation fails.
- Redirect targets are restricted to internal paths by `src/lib/safe-redirect.ts`.
- GitHub Actions runs Vitest and a production build. The latest observed main quality/build run at this snapshot completed successfully on commit `fcd838d390af4adb4d0469fc4378e8b0002af7c0`; this does not prove the current feature branch is tested.
- `supabase/config.toml` references project `ivajgtokxrzwnspihllr`.
- The repository includes a Supabase migration baseline mirrored from `drizzle/migrations/0000_migration.sql` and subsequent security/integrity migrations.

## Database findings verified against the connected project

- The project is reachable through the connected Supabase account and reports `ACTIVE_HEALTHY`.
- RLS is enabled on the application tables `profiles`, `user_roles`, `associations`, `association_members`, `units`, `residents`, `invitations`, `announcements`, and `audit_logs`.
- RLS is enabled on the inspected Storage tables, but no Storage policies were present. Client uploads are not implemented and should remain denied until tenant-scoped policies are designed and tested.
- Applied migration versions recorded by the connected project: `20261010175741` (helper and invitation hardening), `20261010180237` (private helper schema), `20261010180557` (audit snapshot minimization and FK indexes), `20261010180851` (historical audit cleanup), `20261010181026` (RLS InitPlan optimization), `20261010181344` and `20261010181450` (exposed RPC hardening, idempotently retried), and `20261010182029` (resident integrity constraints).
- Trigger-only `SECURITY DEFINER` functions `audit_trigger()` and `handle_new_user()` no longer grant `EXECUTE` to `PUBLIC`, `anon`, or `authenticated`. Existing triggers remain present and were exercised by transactional tests.
- Membership/role helper functions live in the non-exposed `private` schema. They return a positive result only when the requested user ID matches `auth.uid()`. The `authenticated` role retains the schema/function grants required for RLS evaluation; `anon` does not.
- Invitation policies prevent presidents and secretaries from assigning administrator or other leadership roles. Invitation acceptance locks the invitation row, requires a non-null account email matching the invite, revalidates inviter authority and role hierarchy, rejects legacy leadership invitations from non-admins, and does not overwrite an existing membership role.
- The two authenticated RPCs `create_association` and `accept_invitation` now use an empty `search_path` and schema-qualified object references. Association creation validates name length, CNPJ shape, city length, and UF format. Transaction tests confirmed invalid inputs are rejected and valid association creation assigns the creator the admin role.
- The Supabase Security Advisor no longer reports the trigger functions or private helpers. It still reports the two intentional authenticated `SECURITY DEFINER` RPCs and leaked-password protection being disabled. Keep the RPC warnings documented and re-review their authorization whenever the implementation changes.
- RLS transaction simulations used two distinct JWT subject IDs and two synthetic associations. They verified isolation for associations, association members, units, residents, announcements, invitations, and audit logs; cross-tenant unit INSERT/UPDATE and membership UPDATE attempts were denied or affected zero rows. All test data was rolled back. These tests do not replace end-to-end testing with two real Supabase Auth accounts.
- New audit snapshots omit configured sensitive values (CPF, email, phone, birth date, notes, invitation token, address, CNPJ, full name, announcement body, and related fields) while retaining changed-field names. A transactional test confirmed sensitive test values were not copied into audit details.
- A one-time cleanup scrubbed historical audit snapshots. Verification found four audit rows total, two marked as historically redacted, and zero rows still containing the inspected CPF, email, phone, token, notes, or announcement-body keys.
- Four FK indexes were added for announcements, invitations, and resident association/unit lookups. The Performance Advisor no longer reports `auth_rls_initplan`; direct `auth.uid()` calls in public RLS policy expressions were rewritten to scalar subqueries. The newly added indexes currently appear unused until workload statistics accumulate; review real query plans before considering removal.
- The resident table now validates CPF checksums/format and enforces normalized CPF uniqueness per association. A composite foreign key prevents a resident from linking to a unit in a different association. A transaction test confirmed invalid/repeated-digit CPF and normalized duplicates are rejected, cross-association unit links fail, and deleting a unit clears only `unit_id`.
- Announcements now have database-enforced title/body length bounds and a tenant-feed index for association, pin state, and creation time.

## Remaining security and release blockers

### 1. Local environment mismatch

The tracked local `.env` still references the older project `zuyeoozbdprcqwjzilgf` and an old Lovable proxy/key. The tracked `.env.production` URL and publishable key were checked against the selected project and match `ivajgtokxrzwnspihllr`. Local development will continue to use the wrong backend until `.env` is updated. Never commit a service-role/secret key or database password, and never put privileged credentials in `VITE_*` variables.

### 2. Authentication configuration

Supabase Auth leaked-password protection is disabled. It must be enabled in the Supabase Dashboard's Auth password-security settings; this connection does not expose the Auth configuration toggle. MFA policy, recovery flow, email verification, redirect allow-lists, and rate limits still need a documented end-to-end review.

### 3. Tenant isolation and role authorization — PARTIALLY VERIFIED

The SQL/RLS policy layer passed transaction-level isolation simulations with two distinct subject IDs. Before release, repeat adversarial tests using two real Supabase Auth accounts in separate associations, including SELECT, INSERT, UPDATE, DELETE, invitation role combinations, membership changes, profile visibility, and platform-admin access.

### 4. Audit and LGPD governance

New and historical audit snapshots have been redacted, but retention/deletion periods and the operational process for data-subject requests still need definition. Review the redaction list whenever new fields or modules are introduced.

### 5. Storage policies

No Storage policies were found. Keep uploads disabled until private buckets, tenant-scoped object paths, signed URL handling, and SELECT/INSERT/UPDATE/DELETE policies are designed and tested.

### 6. Product completeness

The current main branch includes initial units and residents management pages with association-scoped queries, pagination, create/edit forms, guarded unit deletion, resident deactivation, and masked CPF display. The current feature branch adds member-facing announcements with manager-only create/edit/pin/delete controls, association-scoped pagination/search, and database length bounds. CI and browser verification are still required for this announcements branch. Member/invitation administration screens, audit history UI, association settings, finance, governance, subscription/billing, support, and central SaaS administration remain incomplete compared with the product specification.

### 7. Delivery and operational checks

The current repository quality workflow tests and builds, but lint triage, dependency/secret scanning, backup-restore rehearsal, monitoring/alerting, production smoke tests, and real multi-user end-to-end tests remain open. The Cloudflare deployment workflow is currently skipped unless its documented enable flag and credentials are configured.

## Release acceptance checklist

- [x] Harden membership/role helper functions and move them out of the exposed API schema.
- [x] Harden invitation role policies and the authenticated invitation/association RPCs.
- [x] Redact sensitive fields from new audit snapshots and scrub historical audit details.
- [x] Optimize direct `auth.uid()` policy expressions to remove `auth_rls_initplan` findings.
- [x] Enforce CPF validation/normalized uniqueness and same-association resident-to-unit integrity.
- [x] Enforce server-side announcement title/body bounds.
- [ ] Update local `.env` to match the selected Supabase project without adding privileged secrets.
- [ ] Enable leaked-password protection and review Auth configuration.
- [ ] Repeat tenant-isolation and invitation tests with two real authenticated users.
- [ ] Design and test tenant-scoped Storage policies before enabling uploads.
- [ ] Complete browser/end-to-end tests for units and residents.
- [ ] Complete remaining product modules, lint triage, dependency/secret scans, backup/restore testing, and deployed smoke tests.

## Status

**Partially remediated; not certified production-ready.** Several high-priority database security issues are fixed and verified, but Auth configuration, the local environment mismatch, real-account isolation testing, Storage policy design, operational controls, and substantial product modules remain open.
