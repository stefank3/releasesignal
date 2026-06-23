# V1 Beta Auth0, Admin Account, And DB Cleanup Checklist

## Purpose

This checklist prepares Release Signal beta authentication without replacing Auth0 or creating app-owned login behavior.

Repository inspection for PR 56 found:

- Auth0 remains centralized in `lib/auth0.ts`.
- Public app login links use `/auth/login`.
- Protected app routes redirect unauthenticated users to `/auth/login?returnTo=<path>` from `middleware.ts`.
- Logout uses `/auth/logout`.
- Auth0 callback/logout route handling is provided by the Auth0 Next.js SDK middleware under `/auth/*`.
- No app-rendered Google or social-login button was found in repository UI code.

Therefore, beta removal of Google/social login is primarily Auth0 dashboard configuration, not repository-enforced UI code.

## Auth0 Social Login Disablement

Manual Auth0 dashboard checklist:

1. Open the production or beta Auth0 tenant/application used by Release Signal.
2. Confirm the configured Application is the same one referenced by production `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `APP_BASE_URL`.
3. In Authentication > Database, keep the intended email/password database connection enabled for the Release Signal application.
4. In Authentication > Social, disable Google and any other social connections for the Release Signal beta application.
5. In Applications > Release Signal application > Connections, confirm only the approved database connection is enabled.
6. Confirm the Universal Login page no longer shows Google/social login for the beta application.
7. Verify `/auth/login?returnTo=%2Fchat` still opens Auth0 Universal Login.
8. Verify login returns to `/chat` or the requested `returnTo` route.
9. Verify `/auth/logout` signs out and returns to the configured allowed logout URL.

Do not claim Google/social login is removed until the Auth0-hosted login page is checked after dashboard changes.

## Admin Role Setup

The app reads admin access from the Auth0 access token, not from a hardcoded email.

Current app expectations:

- Role claim namespace: `https://stefans-mvp/claims/roles`
- Expected admin role value: `admin`
- Role reader: `lib/auth/rbac.ts`
- Admin checks call `isAdminFromAccessToken()`.
- Admin-protected API routes include `/api/admin/metrics`, `/api/admin/billing/overview`, and `/api/admin/billing/topup`.

Manual Auth0 dashboard checklist:

1. Create Stefan's Auth0 user in the beta/production tenant using the approved database connection.
2. Create or confirm an Auth0 role named `admin`.
3. Assign the `admin` role to Stefan's Auth0 user.
4. Ensure RBAC is enabled for the Auth0 API used by Release Signal.
5. Ensure roles are included in access tokens.
6. Ensure the access token includes the custom claim `https://stefans-mvp/claims/roles` with value `["admin"]`.
7. Confirm the Auth0 API identifier matches the app audience configured in `lib/auth0.ts`: `https://stefans-mvp-api`.
8. Log in as Stefan and verify `/api/me` returns `isAdmin: true`.
9. Verify admin-only routes return 200 for Stefan and 403 for a normal non-admin user.

Do not hardcode Stefan's email into app logic. Do not grant admin to all logged-in users. Do not bypass Auth0 RBAC.

## Admin Account Trial Avoidance

Current provisioning behavior:

- `/api/me` calls `ensureOrgForUser`.
- If the Auth0 subject has no `OrgMember`, `ensureOrgForUser` creates a new organization, `trial_v1` subscription, 100-credit wallet, and `trial_grant` ledger entry.

Because Stefan's admin account must not be treated as a normal trial user or count toward future beta capacity, complete a reviewed admin setup before first production smoke login if that distinction matters for beta metrics.

Recommended safe setup path:

1. Create the Auth0 admin user and record only the Auth0 subject identifier in a private operations note, not in Git.
2. Before first `/api/me` access, use a reviewed setup script or SQL checklist to create:
   - an internal/admin `Organization`,
   - an `OrgMember` row for Stefan's Auth0 subject with role `admin`,
   - a `CreditWallet` row if admin smoke checks need credits,
   - a clearly non-trial `Subscription` row if product UI requires a plan display.
3. Avoid creating `trial_grant` ledger rows for the admin account unless explicitly intended.
4. After login, verify `/api/me` shows admin access and does not show unintended trial state.

If this cannot be done safely by operations checklist, create a later scoped PR for deterministic admin/bootstrap provisioning.

## Safe Beta DB Cleanup Plan

Do not wipe production data from the repository or by ad-hoc manual deletes.

Separate cleanup work into three categories:

### Production Data Cleanup

Required before destructive production cleanup:

1. Export or snapshot the production database.
2. Review row counts and representative rows for:
   - `Organization`
   - `OrgMember`
   - `Subscription`
   - `CreditWallet`
   - `CreditLedger`
   - `ChatSession`
   - `ChatMessage`
   - `TelemetryEventLog`
3. Prepare a reviewed SQL/scripted cleanup plan.
4. Confirm which Auth0 subjects and organizations must be preserved.
5. Preserve billing, credit ledger, admin, and audit-relevant rows unless explicitly approved for deletion.
6. Run cleanup first against a restored/staging copy if available.
7. Validate the app after cleanup.

### Development Or Local Reset

Local/dev reset may be more aggressive, but should still be scripted and environment-checked:

1. Confirm the target database is not production.
2. Run Prisma migrations from a clean state.
3. Seed only approved local/dev data.
4. Verify local login with the dev Auth0 application.

### Beta Seed And Setup Data

Beta setup data should be intentional and reviewable:

1. Create or preserve the admin organization/account separately from normal trial users.
2. Seed only required lookup/config data.
3. Keep future first-20-user beta cap data separate until that feature is implemented.
4. Do not assume 21st-user/waitlist behavior exists until a scoped PR implements it.

## Post-Cleanup Validation Checklist

After any approved DB cleanup or beta seed/setup:

- App starts normally.
- `/auth/login` redirects to Auth0.
- Auth0 callback returns to the app.
- `/auth/logout` works.
- Stefan admin account works and returns `isAdmin: true`.
- Normal user login works.
- Trial provisioning works for a normal beta user.
- Credit wallet and ledger creation work for normal trial provisioning.
- First beta user path works.
- 21st-user/waitlist behavior works once implemented.
- Required lookup/config data still exists.

## PR 56 Boundary

This PR does not:

- change Auth0 provider implementation,
- create custom login UI,
- implement the 20-user beta cap,
- change trial or credit logic,
- alter Prisma schema,
- run production cleanup,
- create or modify Auth0 dashboard users, roles, connections, or secrets.
