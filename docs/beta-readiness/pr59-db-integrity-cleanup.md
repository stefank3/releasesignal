# PR #59 DB Integrity Cleanup Readiness

This PR is audit/readiness-only for beta-blocking database integrity issues found after PR #58. It does not perform destructive cleanup and does not change runtime provisioning behavior.

## Problem summary

During QA validation, a normal Auth0 user with no Auth0 roles appeared in more than one `OrgMember` / `Organization` record.

Observed user:

- Email: `<REVIEWED_QA_USER_EMAIL>`
- Auth0 subject: `<REVIEWED_AUTH0_SUB>`
- Auth0 roles: none

Runtime `/api/me` returned the expected active account state:

- `isAdmin=false`
- active `organizationId=<REVIEWED_ACTIVE_ORGANIZATION_ID>`
- `planCode=trial_v1`
- `planStatus=trialing`
- wallet balance reflected trial grant and chat usage

Database inspection found duplicate provisioning records and stale `OrgMember.role = 'admin'` values for a user that is not an Auth0 app-admin.

The real QA identifiers observed during validation are intentionally sanitized in committed artifacts. Use locally reviewed values when running the audit against a target database.

## Risk classification

This is beta-blocking database hygiene risk, not confirmed backend data leakage.

The current backend history and session routes filter by `auth0Sub`, and `/api/me` uses Auth0 role claims for app-admin status. However, duplicate org membership records can make billing/trial/account state ambiguous because several server paths use `findFirst({ auth0Sub })` to choose an organization.

## Code inspection findings

Inspected files:

- `prisma/schema.prisma`
- `lib/billing/ensureOrgForUser.ts`
- `app/api/me/route.ts`
- `lib/billing/chargeCredits.ts`
- `lib/chat/sessionStore.ts`
- admin billing overview/top-up routes

Findings:

1. `OrgMember` is unique only on `(organizationId, auth0Sub)`.
   - This prevents duplicate membership in the same organization.
   - It does not prevent the same `auth0Sub` from belonging to multiple organizations.

2. `ensureOrgForUser` uses `findFirst({ auth0Sub })`, then creates a new organization if no member is found.
   - Concurrent first-login, retry, or timeout/replay can allow two requests to see no member and both create organizations.
   - There is no global uniqueness constraint or idempotent provisioning key for `auth0Sub`.

3. Non-admin trial provisioning currently creates `OrgMember.role = "admin"`.
   - Runtime app-admin access does not use this field; it uses Auth0 roles via `isAdminFromAccessToken`.
   - The stored org role is therefore stale/confusing for normal users and should be cleaned only after Auth0/runtime evidence confirms they are not app-admin.

4. Several operational paths resolve organization with `findFirst({ auth0Sub })`.
   - `/api/me`, credit charging, and admin billing helpers can select whichever row the database returns first.
   - Duplicate memberships make the active organization ambiguous until data is cleaned and provisioning is hardened.

## Audit artifact

Run:

```sql
\i scripts/audit-beta-db-integrity.sql
```

or paste `scripts/audit-beta-db-integrity.sql` into the SQL console for the target database.

The audit is read-only. It reports rows with:

- `category`
- `finding`
- `subject`
- `organization_id`
- `details`

The `expected_auth0_roles` CTE in the SQL file is a local/manual review input area. It is empty by default so committed repo artifacts do not contain real QA identifiers and unchanged audit runs do not emit placeholder evidence. When Auth0 role evidence has been reviewed, replace the empty CTE body locally with reviewed `VALUES` rows before running the audit.

### Categories

#### `safeToClean`

Likely cleanup candidates that still require human review before action.

Current example type:

- duplicate organization candidates with no chat sessions, no chat messages, no telemetry, no chat-usage ledger activity, and at most one trial grant.

#### `manualReviewRequired`

Records that need Auth0/runtime/DB comparison before cleanup.

Examples:

- same `auth0Sub` linked to multiple organizations
- all stored `OrgMember.role = 'admin'` rows, listed unconditionally for manual verification
- normal users stored as `OrgMember.role = 'admin'` when Auth0 evidence says no roles
- Auth0 admins with `trial_v1`
- duplicate trial subscriptions
- wallet balance not matching ledger sum
- duplicate trial grants
- orphan organizations with no members

#### `doNotTouch`

Records with user activity or operational evidence.

Examples:

- duplicate organizations that have chat sessions, chat messages, telemetry, or chat-usage ledger rows.

#### `futureHardeningNeeded`

Design risks to address after cleanup, not in this audit-only PR.

Examples:

- global uniqueness/idempotency protection for `auth0Sub`
- first-login/retry hardening in `ensureOrgForUser`

## Cleanup draft artifact

Manual-review-only cleanup templates live in:

```text
scripts/db-cleanup-pr59-draft.sql
```

Every destructive statement is commented out. The file uses transaction/rollback guidance and placeholder IDs. Do not replace `ROLLBACK` with `COMMIT` without explicit human approval after reviewing exact IDs.

Potential cleanup actions include:

- remove duplicate non-active trial orgs where no activity exists
- correct stale `OrgMember.role = 'admin'` only with Auth0/runtime evidence
- remove exact duplicate trial grants only when confirmed accidental
- reconcile wallet balance only when ledger sum is clearly authoritative
- remove duplicate trial subscriptions only after account-access impact is reviewed

## Do not touch

Do not delete or mutate records with:

- chat sessions
- chat messages
- chat usage ledger rows
- telemetry
- ambiguous Auth0/runtime evidence
- unclear active organization ownership

Do not clean production data from Codex. This PR only prepares the audit and cleanup plan.

## Explicitly not changed

- No destructive cleanup was performed.
- No Prisma schema changes were made.
- No Auth0 architecture was changed.
- No billing semantics were changed.
- No prompts, artifact contracts, workflow semantics, or UI were changed.
- No PR #60 automated regression work was implemented.
- Runtime app-admin access remains Auth0-claim based; the stored org-admin role audit is for DB hygiene/manual verification only.

## Recommended follow-ups

1. Run the PR #59 audit against production/preview and review the output.
2. Manually clean reviewed duplicate/stale rows using a transaction and `ROLLBACK` dry run first.
3. After data is clean, add hardening for global `auth0Sub` idempotency.
4. Consider schema constraints only after data cleanup and human approval.
5. Add automated regression coverage in PR #60 for:
   - user-switch/session state isolation
   - normal trial-user provisioning and credit charging
   - admin no-trial/no-credit-billing behavior
   - login/logout/Auth0 callback smoke
