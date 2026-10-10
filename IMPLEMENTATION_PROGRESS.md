# MORADA360 — implementation progress

This file tracks delivery against `instrucoes.md`. A checkbox is marked complete only when the implementation and evidence exist; documentation alone does not count as functional acceptance.

## Current foundation

- [x] React + TypeScript + TanStack Start application and Supabase client are present.
- [x] Authenticated route guard validates the current user and fails closed on session errors.
- [x] Tenant membership is loaded from `association_members`; database RLS remains the security boundary.
- [x] Security/integrity migrations exist for tenant policies, invitations, audit minimization, and resident integrity (see `SECURITY_AUDIT.md`).
- [ ] Merge and verify PR #11: remove the stale tracked local `.env`, add `.env.example`, and document safe configuration.
- [ ] Enable leaked-password protection and complete the Supabase Auth configuration review.
- [ ] Complete end-to-end tests with two real authenticated users in separate associations.

## Delivery stages from `instrucoes.md`

| Stage | Scope | Status |
| --- | --- | --- |
| 1. Foundation | Auth, MFA, multi-tenancy, authorization, audit, design system, baseline tests | In progress; Auth dashboard settings and real-account tests remain blockers |
| 2. Association and users | Association profile, units, residents, invitations, roles, resident portal | Partial; current app includes association setup, units, residents, memberships and invitations |
| 3. Administrative operations | Documents, announcements, incidents, requests, vendors, contracts, assets, maintenance | Partial; announcements exist, other modules remain pending |
| 4. Finance | Accounts, income, expenses, charges, approvals, reconciliation and reporting | Pending |
| 5. Governance | Assemblies, minutes, elections, terms, reservations, staff and optional gatekeeping | Pending |
| 6. Monetization | SaaS plans, subscriptions, billing, limits and support | Pending |
| 7. Production | E2E/security tests, monitoring, backups/restore, deployment and acceptance | Pending |

## Next acceptance work

1. Finish the environment-config PR and verify its CI.
2. Keep Auth security settings as a release blocker until changed in Supabase Dashboard and verified.
3. Add automated tests for callback URL construction and run them in CI.
4. Continue with tenant isolation, invitations, roles, and existing modules before adding new high-risk finance features.
5. Add each new module with migrations, backend authorization, audit behavior, tests, and documented acceptance evidence.

## Evidence rules

- GitHub CI test/build results apply only to the exact commit reported by the workflow.
- Simulated RLS tests do not substitute for E2E tests using real Auth accounts.
- No remote Supabase Auth, Storage, or schema setting is changed by repository-only edits.
- The platform must not be described as production-ready until the acceptance criteria in `instrucoes.md` are demonstrated.
