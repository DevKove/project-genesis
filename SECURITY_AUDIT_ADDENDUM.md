# Morada360 — security audit addendum

Snapshot: 2026-10-10  
Selected Supabase project: `ivajgtokxrzwnspihllr`

This addendum supersedes the earlier audit's statements about the units/residents modules, member and invitation management, audit UI, association settings, and document storage. The original audit remains useful for the earlier findings and history.

## Changes now present in the main branch

- Units and residents have association-scoped CRUD, pagination, resident deactivation, CPF validation/masking, and same-association unit integrity.
- Announcements have member-facing listing and manager-only create/edit/pin/delete controls, with database title/body bounds.
- Member/invitation management includes role changes, member removal, invite creation/cancellation, copyable links, and authenticated invite acceptance. Email delivery is not configured.
- Last-administrator protection is enforced by a database trigger with association-row locking; membership identity/association cannot be rewritten.
- Direct profile reads are restricted to the owner and platform administrators. A security-invoker member-directory view exposes only association ID, user ID, and display name to members of the same association.
- Audit history is available to association administrators and presidents, with association-scoped filtering and expandable redacted details.
- Association settings validate institutional fields. Numeric and alphanumeric CNPJ formats are accepted and check digits are validated.

## Document storage — current branch

The current feature branch adds a private Storage bucket named `association-documents` and a `documents` metadata table.

- Bucket visibility is private, the maximum object size is 20 MiB, and MIME types are allow-listed.
- Object paths are constrained to `association_id/document_id/safe_filename`.
- RLS scopes metadata and objects to the association. Members can read association-visible documents; manager-only documents require manager access. Only association managers can upload or remove files.
- File overwrite is not permitted by the upload flow, and Storage UPDATE policy is intentionally absent.
- Document removal deletes the object and soft-archives metadata, preserving audit history.
- Audit snapshots redact document title, description, file path, and uploader ID.
- Transaction tests verified metadata RLS, cross-association isolation, visibility rules, non-manager write denial, and audit redaction.

**Not yet verified:** a real browser upload/download/delete flow against Storage using two real authenticated accounts. Do not treat the document module as production-homologated until that test is completed.

## Current Supabase Advisor status

- Security findings: the two authenticated `SECURITY DEFINER` RPCs (`create_association` and `accept_invitation`) and leaked-password protection being disabled. The RPC findings remain documented for re-review; the password protection setting must be enabled in Supabase Auth.
- Performance findings: three indexes are reported unused because the current project has little workload data. There are no current unindexed-FK or RLS InitPlan findings in the returned Performance Advisor snapshot.

## Remaining production blockers

- The tracked local `.env` still references the old Supabase project; update it before local development. The production environment file matches the selected project. Never commit service-role keys or database passwords.
- Enable leaked-password protection in Supabase Auth and review MFA, email verification, recovery, redirect allow-lists, and rate limits.
- Run end-to-end tests with two real Auth accounts in separate associations for RLS, invitations, member roles, audit access, and document storage.
- Test the document upload/download/delete workflow in a browser; validate the Cloudflare deployment and production smoke tests.
- Finance, budgets, payments/reconciliation, governance, reservations, employees/access control, subscription billing, central SaaS administration, support, backups/restore drills, and monitoring remain incomplete.

## Status

**Partially remediated; not certified production-ready.** Database controls and several core management modules have been implemented, but browser-level verification, Auth configuration, the local environment mismatch, operational readiness, and the remaining product modules are still open.
