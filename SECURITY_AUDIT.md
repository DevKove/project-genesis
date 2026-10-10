# Morada360 — technical and security audit

Audit snapshot: 2026-10-10  
Repository: `DevKove/project-genesis`

## Changes recorded in the repository

- Authentication and account recovery flows were hardened with error handling and guaranteed loading-state cleanup.
- Association creation and association loading now surface failures rather than silently proceeding.
- The authenticated route guard rejects missing/failed user sessions and redirects to authentication.
- Redirect destinations are restricted to same-origin internal paths by `src/lib/safe-redirect.ts`.
- Unit tests were added for valid internal redirects and common open-redirect bypasses.
- A GitHub Actions workflow was added to run the Vitest suite and production build on pushes to `main`, pull requests, and manual dispatches.

## Findings and release blockers

### 1. Supabase project access / tenant isolation — NOT VERIFIED

The repository's `supabase/config.toml` declares project ref `zuyeoozbdprcqwjzilgf`. The connected Supabase account available during this audit exposed different projects, and attempts to inspect the configured project's schema and policies were denied. Consequently, this audit could not verify:

- Row Level Security (RLS) is enabled on every table containing association, resident, unit, invitation, or audit data.
- Policies consistently constrain reads and writes to associations in which the authenticated user is a member.
- Role changes and privileged operations are enforced in the database rather than only in the UI.
- Storage policies prevent cross-association access to documents and uploads.
- Security-definer functions, triggers, and RPCs validate the caller and tenant scope.

Do not treat frontend role helpers as a security boundary. Before release, inspect and test database policies using separate users belonging to separate associations.

### 2. Missing functional modules — NOT COMPLETE

The authenticated route tree currently exposes the dashboard and association creation route. Navigation was intentionally restricted to existing routes rather than linking to non-existent screens. Resident/unit CRUD, announcements, member/invitation administration, audit history, and association settings require implementation and end-to-end verification before the product can be considered feature-complete.

### 3. Automated verification — PENDING

The repository has no committed npm lockfile at the time of this snapshot. The workflow uses `npm install` and then runs tests and the production build. A green result has not yet been observed in this audit. The environment used for the review could not clone GitHub due to DNS/network resolution failure, so tests, lint, and build were not run locally.

The existing lint command should be treated as a separate remediation item; previous checks reported a substantial existing lint backlog. Do not claim a clean lint run without reviewing the actual CI output.

### 4. Environment configuration

The Supabase browser client must use only the publishable/anonymous key. Never place a service-role key, database password, or privileged secret in `VITE_*` variables or browser-delivered code. Configure public URL/key in the deployment environment and keep server-only credentials in protected server secrets.

## Release acceptance checklist

- [ ] Grant access to the exact Supabase project referenced by `supabase/config.toml`.
- [ ] Review all migrations, RLS policies, storage policies, triggers, and RPCs.
- [ ] Run cross-tenant tests with two unrelated associations and verify that neither can read or modify the other's data.
- [ ] Implement and authorize all required CRUD pages; do not expose links to unfinished pages.
- [ ] Confirm sign-up, email confirmation, sign-in, sign-out, password recovery, invitation acceptance, and first-association onboarding end to end.
- [ ] Obtain successful GitHub Actions test and production-build runs.
- [ ] Triage and resolve lint findings; review dependency and secret scanning results.
- [ ] Perform manual smoke tests in the deployed environment before declaring production readiness.

## Status

**Partially remediated; not yet certified production-ready.** The code-level fixes above are committed, but the Supabase authorization layer and missing application modules are hard blockers that cannot responsibly be marked complete without database access and end-to-end validation.
