# Morada360 — technical and security audit

Audit snapshot: 2026-10-10  
Repository: `DevKove/project-genesis`  
Supabase project: `ivajgtokxrzwnspihllr`

## Verified application and repository state

- The application uses TanStack Start, React/TypeScript, and Supabase.
- Authenticated routes validate the current user through Supabase Auth and fail closed when session validation fails.
- Redirect targets are restricted to internal paths by `src/lib/safe-redirect.ts`.
- Vitest tests and a production build are configured in GitHub Actions.
- The latest observed `main` quality workflow run for commit `8f7c2daaf91e4c3cd25ddf06cd5b99940888344f` completed successfully. This does not prove the current pull request or database is fully tested.
- The current `supabase/config.toml` references project `ivajgtokxrzwnspihllr`.
- The repository now has a Supabase migration baseline mirrored from `drizzle/migrations/0000_migration.sql`, plus a security migration matching the version applied to the connected database.

## Database findings verified against the connected project

- The project is reachable through the connected Supabase account and reports `ACTIVE_HEALTHY`.
- RLS is enabled on the application tables `profiles`, `user_roles`, `associations`, `association_members`, `units`, `residents`, `invitations`, `announcements`, and `audit_logs`.
- RLS is also enabled on the inspected Storage tables. No Storage policies were present in the inspected schema; uploads are therefore not configured for ordinary client access and must not be considered implemented.
- The initial security migration was applied to the connected project as version `20261010175741`; the private-schema migration was applied as version `20261010180237`; the audit-data minimization/index migration was applied as version `20261010180557`; historical audit cleanup was applied as version `20261010180851`.
- Trigger-only `SECURITY DEFINER` functions `audit_trigger()` and `handle_new_user()` no longer grant `EXECUTE` to `PUBLIC`, `anon`, or `authenticated`. Existing database triggers remain present.
- Membership/role helper functions now live in the non-exposed `private` schema. They return a positive result only when the requested user ID matches `auth.uid()`. The schema is not exposed through PostgREST; authenticated retains schema usage and function execution for RLS policy evaluation, while `anon` does not.
- Invitation creation/update policies now prevent presidents and secretaries from assigning the administrator role or other leadership roles. Invitation acceptance locks the invitation row and checks that the inviter still has the required role.
- Post-migration verification confirmed there are zero copies of the four helpers in `public`, all four are in `private`, the authenticated caller's own membership helper result remained true, a lookup using an unrelated user ID returned false, anonymous helper execution is denied, and 24 RLS policies reference the private helpers.
- The audit trigger now records sanitized snapshots: CPF, email, phone, birth date, notes, invitation token, address, CNPJ, full name, announcement body, and other configured sensitive keys are omitted from snapshot values; changed/redacted field names are retained for accountability. A transaction test through the authenticated RLS path verified sensitive test values were not copied into audit details and that the trigger still executes.
- Indexes were added for the four foreign-key patterns previously reported by the Performance Advisor: announcements.association_id, invitations.association_id, residents.association_id, and residents.unit_id.
- The Supabase Security Advisor no longer reports the two trigger functions, but it still reports authenticated-executable `SECURITY DEFINER` functions. Current findings include `accept_invitation`, `create_association`, and the four helper functions. The helper functions now validate caller identity, but moving them to a non-exposed schema and updating policy references remains a stronger follow-up.
- Supabase Auth's leaked-password protection is disabled and still requires configuration.

## Remaining security and release blockers

### 1. Environment configuration mismatch

The tracked local `.env` file still references the older project `zuyeoozbdprcqwjzilgf` and an old Lovable proxy URL/key. The tracked `.env.production` URL and publishable key were checked against the selected project and match `ivajgtokxrzwnspihllr`. Local development will continue to use the wrong backend until `.env` is updated. The publishable key is designed for browser use; never commit a service-role/secret key or database password, and never put privileged credentials in `VITE_*` variables.

### 2. Tenant isolation and role authorization — PARTIALLY VERIFIED

RLS is enabled and the policy definitions were inspected, but cross-tenant isolation has not yet been proven with two distinct authenticated users in separate associations. Complete adversarial tests for SELECT, INSERT, UPDATE, DELETE, invitation role combinations, membership changes, and platform-admin access before release.

### 3. Security-definer RPC surface — FOLLOW-UP REQUIRED

`create_association` and `accept_invitation` are intentionally used as authenticated RPCs and must retain their server-side checks. The four membership/role helper functions are caller-bound, but remain in the exposed `public` schema and are still callable as RPCs by authenticated users. Consider moving them to a non-exposed schema and updating all RLS policy references. Re-run Supabase Security Advisors after any change.

### 4. Audit-log data minimization — IMPROVED, RETENTION STILL OPEN

`audit_trigger()` now omits configured personal/sensitive values from new audit snapshots while retaining changed-field names. A transactional test confirmed CPF, email, phone, and free-text note values were not stored in the audit details. Historical audit rows were scrubbed by a one-time migration. Continue checking the redaction list whenever new fields are introduced and define audit-log retention/deletion requirements under LGPD. Review the redaction list as new columns/modules are introduced, and define audit-log retention/deletion requirements under LGPD.

### 5. Storage policies

No Storage policies were found in the inspected schema. Keep client access denied until private buckets, tenant-scoped object paths, and SELECT/INSERT/UPDATE/DELETE policies are designed and tested.

### 6. Functional completeness and verification

The authenticated route tree remains incomplete compared with the product specification. Resident/unit CRUD, announcement management, member/invitation administration, audit history, association settings, finance, governance, and subscription/billing flows need implementation and end-to-end verification. The current security PR's quality workflow must complete successfully before merge. Lint, dependency scanning, secret scanning, and deployed smoke tests remain separate checks.

## Release acceptance checklist

- [ ] Align `.env` and deployment configuration with the selected Supabase project without committing privileged secrets.
- [ ] Enable leaked-password protection in Supabase Auth.
- [ ] Move caller-bound helper functions out of exposed API schemas or otherwise remove unnecessary RPC exposure.
- [ ] Test cross-tenant reads/writes with two distinct users and associations.
- [ ] Test invitation role authorization, expiry, email matching, and replay/concurrent acceptance.
- [x] Redact configured PII and invitation tokens from new audit snapshots; review the redaction list when new fields are added.
- [x] Sanitize historical audit-log snapshots created before the redaction migration.
- [ ] Design and test tenant-scoped Storage policies before implementing uploads.
- [ ] Obtain successful CI test/build results for the security pull request.
- [ ] Complete required product modules, dependency/secret scans, lint triage, and deployed smoke tests.

## Status

**Partially remediated; not certified production-ready.** A targeted database security migration has been applied and verified, but the environment mismatch, remaining RPC advisory findings, Auth configuration, audit-log minimization, cross-tenant testing, Storage policy design, and missing product modules remain open.
