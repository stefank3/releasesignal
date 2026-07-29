# Auth0 Branding and Commercial Authority Runbook

## 1. Purpose and status

This document is the Phase A operational and architectural baseline for PR #78.
It defines the decisions, evidence, and external Auth0 work required before
Release Signal introduces commercial-owner authority.

Phase A is documentation only. It does not change Auth0 runtime configuration,
authentication, provisioning, billing, credits, organization membership, or UI
behavior.

Phase B is blocked until every prerequisite in this runbook is approved and the
required external configuration values and owners are known.

The governing authority flow remains:

```text
Auth0 establishes identity and emits reviewed claims
-> the server retrieves and validates authority
-> deterministic application logic enforces access
-> UI displays only the actions and state returned by the server
```

UI state, email addresses, organization roles, request fields, and free-form
text are never commercial authority.

## 2. Current Auth0 implementation

### 2.1 SDK and client

Release Signal uses:

```text
Package: @auth0/nextjs-auth0
Resolved version: 4.15.0
```

`lib/auth0.ts` owns the server-only `Auth0Client`.

Current client configuration:

- `APP_BASE_URL` comes from centrally validated environment state.
- Standard Auth0 environment variables provide the domain, client ID, client
  secret, and session secret.
- The API audience is hardcoded as `https://stefans-mvp-api`.
- Requested scopes are `openid profile email`.

The hardcoded audience is an externally coupled compatibility contract. It must
not be renamed in Phase A. Any later change must be coordinated with the
matching Auth0 API identifier in each environment.

### 2.2 Middleware, sessions, and Auth0 routes

`middleware.ts`:

- calls `auth0.middleware(request)`;
- allows the explicitly public and static routes;
- calls `auth0.getSession(request)` for protected routes; and
- redirects unauthenticated users to `/auth/login`.

Server routes identify authenticated users through `session.user.sub`.

The authentication entry points are:

```text
Login:    /auth/login
Callback: /auth/callback
Logout:   /auth/logout
```

The Auth0 SDK middleware owns callback and logout handling. The application
does not implement a separate password form, callback route, or logout route.

### 2.3 Deterministic provisioning

`lib/billing/ensureOrgForUser.ts` owns current user-to-organization
provisioning. Its behavior must remain unchanged by both phases of PR #78.

For a normal new user, current provisioning creates:

- an organization;
- an `OrgMember` with role `admin`;
- a 15-day `trial_v1` subscription;
- a 100-credit wallet; and
- a `trial_grant` credit-ledger entry.

Auth0 application admins follow the existing special admin provisioning path.
That path creates the current admin workspace and wallet behavior without
silently converting the account into a normal trial.

Provisioning is protected by a PostgreSQL advisory transaction lock keyed by
`auth0Sub`. PR #78 must not change the lock, idempotency, subscription, wallet,
ledger, or membership behavior.

### 2.4 Organization membership

`OrgMember.role` is database-owned organization membership state. Its current
documented values include `admin` and `member`.

An organization `admin`:

- is not automatically an Auth0 application admin;
- is not automatically a commercial owner; and
- must not gain application-wide or commercial authority through the database
  role alone.

Every newly provisioned normal user currently becomes
`OrgMember.role = "admin"` of their own organization. Any future inheritance
from organization-admin status to commercial-owner authority would therefore
grant owner authority far too broadly. This separation is load-bearing and must
remain explicit. PR #78 does not change provisioning.

## 3. Current application-admin authority

### 3.1 Source and enforcement

Current global application-admin authority comes from this Auth0 access-token
claim:

```text
Claim namespace: https://stefans-mvp/claims/roles
Required role:   admin
Server helper:   isAdminFromAccessToken()
```

`lib/auth/rbac.ts` retrieves the access token through the server-side Auth0 SDK
session. The helper reads the namespaced roles array and requires the `admin`
value.

Current admin checks fail closed when the token is missing, unavailable,
expired, malformed, cannot be refreshed, or cannot be read. These failures
produce no admin roles rather than granting access.

The existing claim namespace is an external compatibility contract. Phase A
does not rename it. Phase B must preserve existing admin claim semantics
exactly.

### 3.2 Current admin capabilities

The current Auth0 application-admin role is not read-only telemetry access. It
currently controls:

- operational metrics;
- billing overview;
- positive credit top-ups;
- review-mode access;
- the special admin provisioning path; and
- admin account presentation in the application shell.

The current positive credit top-up capability is an existing admin mutation.
PR #78 does not transfer it to commercial owners, remove it from admins, or
change its billing and ledger semantics.

### 3.3 Presentation versus authority

`/api/me` returns the current `isAdmin` result. `app/chat/UserBar.tsx` uses that
result to display the Admin entry point and admin account label.

That UI check is presentation only. Server-side access-token checks remain the
authority for protected admin API behavior.

There is no email-based admin fallback. An email address, including a
particular individual or domain, must not grant application-admin or
commercial-owner authority.

### 3.4 Separate authorization finding

Symptom:

- `app/admin/telemetry/page.tsx` directly queries internal telemetry without an
  explicit application-admin check.

Structural cause:

- the `app/admin` route segment has no segment-level application-admin
  authorization guard; and
- middleware authenticates the user but does not authorize the user as an
  application admin.

Classification:

```text
Separate bounded high-risk authorization fix required
```

This finding is outside PR #78 Phase A. The separate bounded fix should
evaluate a segment-level server-side admin guard rather than only patching the
telemetry page. The implementation remains undecided. No admin page may be
modified or bundled into commercial-owner work without separate approval,
scope, validation, and high-risk review.

## 4. Token-verification boundary decision

The current role helper decodes the access-token payload without independent
JWKS signature verification. The token originates from the server-side Auth0
SDK session, but that provenance and local decoding behavior must not be
silently reinterpreted as a newly approved owner-verification design.

Phase B requires one explicit human-approved decision:

1. Treat Auth0 SDK session and access-token provenance as the accepted
   verification boundary. Under this option, staging-versus-production
   separation is enforced by Auth0 tenant/application credentials and
   deployment configuration. The current RBAC helper performs no independent
   in-code issuer or audience assertion. The "staging identity in production"
   validation is therefore configuration-verified, not code-verified.
2. Use a stronger Auth0 SDK-supported verified-claims path. The selected SDK
   contract must document which layer validates issuer, audience, token type,
   and environment separation. Explicit issuer and audience validation may
   become part of the implementation contract if the SDK path supports it.
3. Introduce a dedicated verified-token/JWKS path through a separately approved
   dependency and implementation change. That implementation contract must
   explicitly validate issuer and audience and define how environment-specific
   issuers, audiences, keys, caching, and verification failures are handled.

Phase A does not select or implement one of these options.

If option 3 requires a direct dependency, that dependency change must have
separate approval, lockfile review, validation, and rollback planning. A
transitive dependency must not be imported as though it were an approved direct
application contract.

No commercial-owner runtime helper or owner route may be implemented until the
verification boundary is approved.

## 5. Commercial-owner authority contract

### 5.1 Claim design

The proposed commercial-owner claim is:

```text
Namespace:      https://releasesignal.io/claims/commercial_owner
Expected value: true
JSON type:      boolean
```

The namespace is an identifier. It does not require the URL to resolve to a
public endpoint.

The commercial-owner claim must be present in the Auth0 access token. The
application must retrieve that token server-side through:

```ts
auth0.getAccessToken()
```

The future owner helper must read the claim from the access-token payload. The
Auth0 Post Login Action must emit it through:

```ts
api.accessToken.setCustomClaim(...)
```

The helper must not rely on `session.user`, an ID-token-only claim,
browser-provided claims, or an application-admin fallback. This mirrors the
existing application-admin access-token pattern without selecting the still
unresolved verification-boundary option.

The server must require strict boolean equality:

```text
claimValue === true
```

The following values and conditions must deny owner authority:

- a missing claim;
- boolean `false`;
- string `"true"`;
- a number;
- an array;
- an object;
- a malformed token;
- an unavailable or expired token;
- a token retrieval or refresh error;
- a claim under the wrong namespace;
- a claim present only in the ID token;
- a claim present only in `session.user`; and
- a staging identity or assignment presented to production.

### 5.2 Authority separation

Commercial-owner authority must obey all of these rules:

- Auth0 application admin does not imply commercial owner.
- `OrgMember.role = "admin"` does not imply commercial owner.
- Email address or email domain does not imply commercial owner.
- UI state does not imply commercial owner.
- Client-supplied headers do not imply commercial owner.
- Client-supplied body fields do not imply commercial owner.
- Query parameters do not imply commercial owner.
- Cookies or browser storage outside the Auth0 SDK session do not imply owner.
- Staging owner assignment does not grant production authority.
- Future owner routes enforce the owner claim independently on the server.
- The future owner helper must never fall back to
  `isAdminFromAccessToken()`.

The claim establishes access authority only. It must not change subscriptions,
wallets, ledger history, organization membership, provisioning, or product
entitlements.

### 5.3 PR #84 owner-route contract

PR #84 may consume commercial-owner authority only after PR #78 Phase B is
approved and validated.

Future owner routes must:

- retrieve the Auth0 access token server-side through
  `auth0.getAccessToken()`;
- read the owner claim from the access-token payload;
- reject an ID-token-only or `session.user`-only owner claim;
- enforce the dedicated owner claim independently;
- fail closed for all invalid or unavailable claim states;
- obtain commercial data from deterministic server/database sources;
- expose only the explicitly approved read-only commercial view;
- avoid admin-to-owner inheritance;
- avoid organization-role-to-owner inheritance;
- avoid browser-supplied organization or user expansion;
- avoid payment, subscription, wallet, ledger, or user mutation unless a later
  separately approved scope explicitly permits it; and
- return forbidden for non-owners even if the UI hides the route.

PR #84 must not redefine the claim namespace, accepted type, verification
boundary, assignment process, or break-glass model.

## 6. Owner assignment

The approved target assignment process is:

1. Create an Auth0 role named `commercial_owner`.
2. Assign it only to explicitly approved owner identities.
3. Use a reviewed Auth0 Post Login Action to emit the strict namespaced boolean
   claim through `api.accessToken.setCustomClaim(...)` when the role is
   present.
4. Keep staging and production roles, identities, and assignments separate.
5. Require reauthentication and new token issuance after assignment.
6. Prohibit automatic assignment based on email, email domain, organization
   membership, database role, or application-admin status.
7. Keep the number of production owners to the smallest practical number.
8. Record the assignment in an approved private operational record.

Routine assignment must be performed by a named, approved non-break-glass
Auth0 operator or tenant role with only the minimum Auth0 management authority
required. The break-glass tenant administrator account must not be used for
routine assignment. Assignment and revocation owners must be recorded before
Phase B begins.

The private assignment record must include:

- environment;
- approver;
- redacted or privately stored user reference;
- assignment timestamp;
- Post Login Action version;
- new-token validation result; and
- any expiry or review date.

Real Auth0 user subjects, full access tokens, and private identity details must
not be stored in Git.

## 7. Owner revocation and session handling

### 7.1 Planned revocation

Planned, non-compromise revocation must:

1. Remove the `commercial_owner` role.
2. Revoke sessions and refresh tokens according to the approved operational
   window.
3. Require fresh authentication.
4. Verify future owner endpoints return forbidden.
5. Confirm subscriptions, wallets, ledger history, and organization membership
   remain unchanged.
6. Record the revocation privately.

### 7.2 Emergency or compromise revocation

Emergency revocation must:

1. Remove the `commercial_owner` role immediately.
2. Block the Auth0 identity immediately where appropriate.
3. Revoke active sessions.
4. Revoke refresh tokens.
5. Rotate affected credentials or Post Login Action secrets.
6. Verify owner-only routes deny access.
7. Confirm subscriptions, wallets, ledger history, and organization membership
   remain unchanged.
8. Record the incident privately.

For emergency revocation, session and refresh-token revocation are mandatory.
Waiting for an access token to expire is not an acceptable emergency control.

Removing a role alone may leave an already issued access token valid until its
expiration unless sessions or tokens are revoked. The configured access-token
TTL determines the worst-case residual-authority window. Production and staging
TTLs must be recorded before Phase B approval, and emergency revocation must
not rely only on waiting for TTL expiry.

### 7.3 Assignment refresh validation

After assignment:

- end the previous application session;
- authenticate again;
- obtain a newly issued access token;
- verify the exact boolean owner claim;
- verify the expected owner-positive route result when such a route exists; and
- verify existing admin status independently.

### 7.4 Revocation validation

After revocation:

- revoke sessions and refresh tokens;
- force a new authentication;
- verify the new token lacks the owner claim;
- verify owner-only access is forbidden;
- verify normal application access matches the user's remaining roles and
  entitlements; and
- confirm no commercial or product state was mutated by revocation.

## 8. Break-glass recovery

Production Auth0 must have a dedicated tenant-administrator recovery account.

The recovery account must:

- use strong MFA;
- keep recovery codes outside Git in an approved private offline location;
- have no normal application commercial-owner authority;
- be used only for tenant recovery, Post Login Action rollback,
  emergency compromised-owner revocation, or replacement-owner recovery; and
- have clearly assigned human custody and review responsibility.

When claim emission breaks, recovery restores the last reviewed Auth0 Post Login
Action version. It must not introduce a temporary permissive Action or bypass
server enforcement.

The following break-glass mechanisms are prohibited:

- email allowlist;
- database owner flag;
- environment-variable owner bypass;
- application bypass route;
- client-side owner switch;
- emergency source-code owner grant; and
- automatic admin-to-owner inheritance.

After break-glass use:

1. Review Auth0 tenant and application logs.
2. Remove all temporary role assignments.
3. Revoke recovery and affected user sessions.
4. Rotate recovery material or affected credentials where needed.
5. Verify the server-side owner authority contract.
6. Verify normal admin and provisioning behavior.
7. Record the incident and remediation privately.

No recovery code, tenant-administrator credential, token, or real user subject
may be included in this repository.

## 9. Target environment topology

### 9.1 Environment matrix

| Control | Staging | Production |
|---|---|---|
| Auth0 application or tenant | Staging-only application or tenant | Production-only application or tenant |
| Client credentials | Staging client ID and secret | Production client ID and secret |
| Session secret | Staging-only | Production-only |
| API audience | Staging API audience | Production API audience |
| Callback URLs | Exact approved staging URLs | Exact `releasesignal.io` URLs |
| Logout URLs | Exact approved staging URLs | Exact `releasesignal.io` URLs |
| Allowed origins | Exact approved staging origins | Exact `releasesignal.io` origins |
| Users | Synthetic test users | Real production users |
| Owner assignment | Staging-only owner identity | Explicitly approved production owner |
| Branding | Clearly test-labelled | Production Release Signal branding |
| Evidence | Redacted staging evidence | Redacted production evidence |

Preview deployments must not inherit production Auth0 secrets or production
owner authority.

`VERCEL_ENV` alone does not prove that a deployment is trusted staging. Trusted
staging requires explicitly separated resources, credentials, URLs, access
controls, and evidence.

Release Signal does not currently have a distinct runtime staging identity in
`lib/env.ts`. Current runtime stages resolve to production, preview, or
development. A deployment described operationally as "staging" may therefore
currently run under preview treatment. Establishing a first-class staging
runtime identity is outside the four-file Phase B scope unless separately
approved. See `docs/beta/environment-and-deployment-safety.md` for the broader
environment-isolation baseline.

Broad wildcard preview callback URLs must not be used without explicit risk
approval and a documented reason.

Vercel still requires manual confirmation that the production project is
connected to:

```text
stefank3/releasesignal
```

### 9.2 Environment authority isolation

- A staging role assignment is valid only in staging.
- A production role assignment is valid only in production.
- Staging must not use production client credentials, session secrets, API
  audience, Action deployment, or real production users.
- Preview must not be treated as staging merely because authentication
  succeeds.
- Successful callback completion establishes an Auth0 session; it does not by
  itself prove commercial-owner authority.

## 10. Branding and identity-provider review

Auth0 Universal Login branding and enabled connections are external dashboard
state. No item in this section is complete until evidence is recorded.

### 10.1 Branding checklist

- [ ] Auth0 application name reviewed.
- [ ] Universal Login logo reviewed.
- [ ] Brand colors reviewed.
- [ ] Favicon reviewed where supported.
- [ ] Support information reviewed.
- [ ] Privacy link reviewed and approved.
- [ ] Terms link reviewed and approved.
- [ ] Development-tenant wording removed from production.
- [ ] Staging branding is clearly test-labelled.
- [ ] Production branding consistently uses Release Signal.

### 10.2 Connection and provider checklist

- [ ] Enabled database connections recorded.
- [ ] Enabled social connections recorded.
- [ ] Google connection status recorded explicitly.
- [ ] Enabled enterprise connections recorded.
- [ ] Enabled passwordless connections recorded.
- [ ] Each enabled provider has an approved product and security reason.
- [ ] Staging and production connection assignments are reviewed separately.
- [ ] Universal Login is manually tested after any connection change.

Phase A does not enable or disable any provider. Provider changes require
external approval, execution, evidence, and login regression.

## 11. Callback, logout, and origin policy

### 11.1 Production

The production Auth0 application must use exact approved production URLs.
Expected primary entries are:

```text
Callback:       https://releasesignal.io/auth/callback
Logout:         https://releasesignal.io
Allowed origin: https://releasesignal.io
```

Any additional production hostname, such as an approved `www` redirect or
application subdomain, must be explicitly listed and validated. It must not be
assumed by this runbook.

Production must not use a broad preview wildcard.

### 11.2 Staging

Staging must use exact URLs for the selected stable staging deployment:

```text
Callback:       https://<approved-staging-domain>/auth/callback
Logout:         https://<approved-staging-domain>
Allowed origin: https://<approved-staging-domain>
```

The exact staging domain remains an external decision and must be recorded
before Phase B.

### 11.3 Local development

Only explicitly approved localhost entries may be used:

```text
Callback:       http://localhost:3000/auth/callback
Logout:         http://localhost:3000
Allowed origin: http://localhost:3000
```

Localhost entries should belong to the approved development or staging
application strategy, not be added casually to production.

### 11.4 Preview

Preview rules:

- no production Auth0 secrets;
- no production owner assignment;
- no production API audience;
- no assumption that a successful callback proves trusted authority;
- no broad wildcard callback without explicit risk approval; and
- selected preview authentication, if enabled, must use isolated
  non-production resources.

## 12. Evidence record

Each evidence record must contain:

| Field | Required content |
|---|---|
| Control | The setting or behavior being verified |
| Environment | Local, preview, staging, or production |
| Owner | Human or team responsible for the control |
| Date | Verification date |
| Result | Pass, fail, blocked, or not configured |
| Redacted evidence location | Approved private evidence reference |
| Remediation | Required correction and owner |
| Status | Open, accepted, remediated, or explicitly deferred |

Required evidence categories:

- application settings;
- Universal Login branding;
- enabled connections;
- callback URLs;
- logout URLs;
- allowed origins;
- API audience;
- access-token lifetime or TTL for each environment;
- Auth0 role configuration;
- Post Login Action version;
- normal-user token behavior;
- application-admin token behavior;
- commercial-owner token behavior;
- application-admin-without-owner denial;
- owner-without-admin result, if that combination is supported;
- assignment;
- revocation;
- session invalidation;
- break-glass readiness; and
- Vercel production repository connection.

Evidence must never include:

- full access, ID, or refresh tokens;
- client secrets;
- session secrets;
- recovery codes;
- real Auth0 user subjects;
- tenant-administrator credentials;
- unredacted sensitive screenshots; or
- private identity data.

## 13. External Auth0 action checklist

The following work is manual and external to Phase A:

- [ ] Create or confirm the staging Auth0 application or tenant.
- [ ] Create or confirm the production Auth0 application or tenant.
- [ ] Confirm each application maps to its intended Vercel environment.
- [ ] Set reviewed staging and production application names.
- [ ] Configure Universal Login branding.
- [ ] Review and record enabled connections.
- [ ] Configure exact callback URLs.
- [ ] Configure exact logout URLs.
- [ ] Configure exact allowed origins.
- [ ] Create or confirm environment-specific APIs and audiences.
- [ ] Record the access-token lifetime or TTL for staging and production.
- [ ] Confirm existing RBAC settings and admin claim behavior.
- [ ] Create the `commercial_owner` role.
- [ ] Deploy a reviewed and versioned Post Login Action.
- [ ] Assign the staging owner.
- [ ] Assign the production owner.
- [ ] Test assignment and new-token issuance.
- [ ] Test revocation.
- [ ] Test session and refresh-token invalidation.
- [ ] Configure tenant-administrator MFA.
- [ ] Establish break-glass ownership and private recovery storage.
- [ ] Preserve redacted evidence.
- [ ] Confirm the Vercel production project is connected to
      `stefank3/releasesignal`.

No dashboard control should be marked complete without its evidence record.

## 14. Phase B bounded runtime contract

Phase B is limited to:

```text
.env.example
lib/env.ts
lib/auth0.ts
lib/auth/rbac.ts
```

Planned changes:

1. Add an `AUTH0_AUDIENCE` placeholder to `.env.example`.
2. Add required `AUTH0_AUDIENCE` validation to `lib/env.ts`.
3. Replace the hardcoded audience in `lib/auth0.ts` with
   `env.AUTH0_AUDIENCE`.
4. Add a strict commercial-owner helper to `lib/auth/rbac.ts`.
5. Preserve the existing admin claim and semantics exactly.
6. Preserve all provisioning behavior.
7. Do not add owner routes or owner UI.
8. Do not change billing, credits, Prisma schema, or organization roles.
9. Do not add a dependency without a separately approved scope amendment.

### 14.1 Required audience rollout order

`lib/env.ts` evaluates required variables at module load, and `lib/auth0.ts` is
imported by middleware. Adding a required `AUTH0_AUDIENCE` without
preconfiguring it can therefore cause an application-wide startup or runtime
failure, not merely an admin-feature failure.

Required rollout order:

1. Configure `AUTH0_AUDIENCE` in all applicable environments.
2. Verify the configured values and deployment access.
3. Merge and deploy the bounded runtime change.
4. Validate login, callback, token issuance, the existing admin claim, and the
   commercial-owner claim.
5. Roll back if any authentication or authority regression occurs.

Applicable environments:

- local development;
- Preview;
- dedicated staging when it exists;
- production; and
- CI or build environments that evaluate required configuration.

One lower-risk compatibility option for Phase B review is temporarily
defaulting to the current audience:

```text
https://stefans-mvp-api
```

This is an option to evaluate, not an approved implementation decision.

### 14.2 Audience-to-admin-claim regression risk

Changing the Auth0 audience may silently suppress the existing
application-admin claim if that claim is tied to the currently configured
Auth0 API, RBAC settings, permissions configuration, or Post Login Action
behavior.

Potential impact:

- `isAdminFromAccessToken()` fails closed;
- all application-admin capabilities disappear;
- admin provisioning may follow the non-admin path; and
- operational and billing administration becomes unavailable.

Before promotion, validation must:

- confirm the existing roles claim is emitted for the new audience;
- verify an Auth0 application admin remains an application admin;
- verify a normal user remains a non-admin;
- verify normal and admin provisioning behavior remain unchanged; and
- verify metrics, billing overview, positive credit top-up, review-mode access,
  and admin presentation remain available to the intended admin identity.

### 14.3 Phase B prerequisites

Phase B cannot start until:

- the commercial-owner claim namespace and boolean type are approved;
- the token-verification boundary is approved;
- staging and production audience values are available;
- the intended Auth0 applications, tenants, and APIs are identified;
- the rollback plan is approved;
- the admin regression matrix is approved;
- external dashboard responsibilities are assigned;
- staging and production secret scope is confirmed;
- the owner assignment and revocation owners are identified; and
- break-glass custody is established.

Production and staging access-token TTLs must also be recorded so the
worst-case residual-authority window is known before approval.

### 14.4 Rollback baseline

The Phase B rollback plan must:

- restore the last reviewed runtime audience configuration;
- restore the last reviewed Auth0 API and Action configuration;
- revoke unintended owner assignments and sessions;
- avoid changing application user, organization, subscription, wallet, ledger,
  session-artifact, or provisioning state; and
- include positive login and existing-admin regression after rollback.

## 15. Phase B validation matrix

Required future validation:

| Scenario | Application admin | Commercial owner | Required result |
|---|---:|---:|---|
| Normal user | No | No | Normal authenticated access only |
| Organization admin only | No | No | No application-admin or owner access |
| Auth0 application admin | Yes | No | Existing admin behavior; owner denied |
| Commercial owner | Per approved assignment matrix | Yes | Owner helper succeeds |
| Missing owner claim | Unchanged | No | Owner denied |
| Malformed owner claim | Unchanged | No | Owner denied |
| Owner claim string `"true"` | Unchanged | No | Owner denied |
| Wrong claim namespace | Unchanged | No | Owner denied |
| Staging identity in production | No trusted production authority | No | Access denied |
| Token retrieval error | No newly granted authority | No | Fail closed |

Phase B must also verify:

- existing login works;
- callback works;
- logout works;
- normal provisioning is unchanged;
- admin provisioning is unchanged;
- admin metrics authority is unchanged;
- billing overview authority is unchanged;
- credit top-up authority is unchanged;
- review-mode access is unchanged;
- no email fallback exists;
- no owner UI or owner route was added; and
- no product, subscription, wallet, ledger, or organization state changed.

## 16. Former repository-name references

Phase A does not change any former-name reference.

Preserve for compatibility:

- browser local-storage keys beginning with `stefans-mvp`;
- Redis prefixes beginning with `stefans-mvp`;
- the existing Auth0 roles claim namespace; and
- the existing Auth0 API audience until a coordinated migration.

Separate cleanup:

- package name in `package.json` and `package-lock.json`; and
- stale absolute local paths in `docs/m18-refactor-inventory.md`.

No active old GitHub repository URL remains in tracked files.

## 17. Explicit Phase A non-goals

Phase A does not modify:

- `.env.example`;
- `lib/env.ts`;
- `lib/auth0.ts`;
- `lib/auth/rbac.ts`;
- `middleware.ts`;
- `lib/billing/ensureOrgForUser.ts`;
- Prisma schema or migrations;
- billing, credits, wallets, or ledgers;
- `/api/me`;
- admin routes;
- the telemetry page;
- UI;
- legal pages;
- trial duration;
- the Contact page;
- Lemon Squeezy;
- webhooks;
- notifications; or
- CI.

Phase A does not claim that any external Auth0 or Vercel setting is configured,
verified, or complete.

## 18. Approval and next gate

This runbook becomes the baseline for external Auth0 evidence and the Phase B
scope proposal. It does not itself approve external dashboard changes or Phase
B implementation.

Before Phase B, the human lead must approve:

- the claim namespace and boolean contract;
- one token-verification boundary;
- the staging and production topology;
- the audience values;
- the assignment, revocation, and audit owners;
- the break-glass owner and storage model;
- the rollback plan; and
- the validation matrix.

PR #84 remains blocked from implementing owner routes until the Phase B
authority helper and environment separation are approved, implemented,
validated, and reviewed.
