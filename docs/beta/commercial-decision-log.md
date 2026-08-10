# Commercial Decision Log for Test Checkout

## Document control

| Field | Value |
|---|---|
| Scope | PR #82A — Commercial Decision Log for Test Checkout |
| Status | Six PR #82 implementation decisions approved; documentation only |
| Protected baseline | `master` at `3c62183df73e793a961994da6eaa33c273c48e2f` |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Affected implementation | PR #82 |
| Runtime effect | None |

## 1. Purpose

This log is the authoritative owner-approval record for the six bounded
implementation decisions required before PR #82 may begin. It approves a
server-created Lemon Squeezy local test checkout contract. It does not
implement checkout, configure the provider, activate paid access, or approve
commercial launch.

The protected authority flow remains:

```text
authenticated server request
→ validated server-owned organization and configuration
→ provider test checkout creation
→ presentation-only browser return
```

Checkout creation and browser returns do not own subscription, entitlement,
trial, wallet, ledger, or credit truth. Later verified provider-event
processing remains required before paid state can become authoritative.

## 2. Authority model

This record distinguishes:

- repository evidence: current code and merged documentation;
- selected implementation behavior: the bounded PR #82 contract;
- owner approval: Stefan Kajchevski's dated authorization;
- provider configuration: external test resources and secrets;
- external confirmation: provider, legal, tax, or accounting evidence; and
- implementation evidence: later code, tests, and redacted execution results.

An implementation decision is authoritative only when it records its ID,
selected behavior, status, approver, approval date, repository evidence,
affected PR, and supersession state. Approved implementation behavior does not
silently approve an unresolved commercial value.

Allowed decision statuses are:

```text
PROPOSED
APPROVED
REJECTED
SUPERSEDED
BLOCKED
```

Private identity, banking, tax, provider-verification, account, credential, and
secret evidence remains outside Git.

## 3. Decision namespaces

PR #82 implementation decisions use this dedicated namespace:

```text
PR82-I-01 through PR82-I-06
```

It is separate from the commercial checkout namespace `C-01` through `C-15`
and the legal/pricing readiness namespace `D-01` through `D-20`.

Only these relationships exist:

```text
PR82-I-01 → C-09
PR82-I-02 → C-11
```

PR82-I-03 through PR82-I-06 approve implementation controls documented by PR
#81 but do not invent new C-identifiers.

## 4. Relationship to PR #80 and PR #81

PR #80, recorded in `docs/beta/legal-pricing-support-readiness.md`, keeps
seller, pricing, tax, paid-credit, lifecycle, support, and legal publication
decisions explicit and blocked where unresolved.

PR #81, recorded in
`docs/beta/commercial-decisions-test-configuration.md`, established the
organization, return-origin, kill-switch, variant, and environment authority
boundaries for future checkout work. Its C-register assigns:

- `C-09` to organization binding; and
- `C-11` to trial-to-paid behavior.

PR #81 assigns no C-identifiers to return-origin validation, kill-switch
handling, single-variant allowlisting, or environment/provider-mode validation.
This log therefore uses the dedicated PR82-I namespace without renumbering or
modifying the merged C-register.

Repository audit also confirmed:

- normal provisioning and charging select the oldest membership by
  `createdAt` ascending and then `id` ascending;
- account access and `/api/me` select the newest subscription row by
  `createdAt` descending and then evaluate that row;
- no Lemon Squeezy client, checkout route, webhook route, paid-subscription
  normalization, or paid-credit grant exists;
- `APP_BASE_URL` is existing required server configuration;
- `.env.example` contains placeholders only; and
- the current build command invokes `prisma migrate deploy`.

## 5. Current environment model

The repository exposes `dev`, `preview`, and `prod` runtime labels. The approved
checkout operating model is deliberately narrower:

```text
dev  = local development
prod = deployment from master
```

There is no approved staging checkout environment and no approved preview
checkout environment. Preview's existence as a broader platform/runtime label
does not authorize checkout there.

Provider modes are:

```text
test
live
```

Initial PR #82 execution is local `dev` with Lemon Squeezy `test` mode only.
Production checkout remains disabled. Staging or preview checkout requires a
separate trusted environment identity, implementation change, and dated owner
approval. Staging must not be silently mapped to preview, dev, or prod.

## 6. Approved PR #82 implementation decisions

All six records below are:

```text
Status: APPROVED
Approver: Stefan Kajchevski
Approval date: 2026-08-03
Affected PR: PR #82
Supersession status: Current; not superseded
```

These approvals allow PR #82 implementation to begin after this decision log
is merged. They do not remove the local test-deployment blockers in §9 or the
commercial-activation blockers in §10.

## 7. Decision summary

| Implementation ID | Related decision | Selected behavior | Status | Approver | Approval date | Evidence | Affected PR |
|---|---|---|---|---|---|---|---|
| PR82-I-01 | C-09 | Exactly one server-resolved membership; zero or multiple memberships fail closed | APPROVED | Stefan Kajchevski | 2026-08-03 | PR #81 contract; `lib/billing/ensureOrgForUser.ts`; `lib/billing/chargeCredits.ts` | PR #82 |
| PR82-I-02 | C-11 | Active trial may complete test checkout without trial or paid-state mutation | APPROVED | Stefan Kajchevski | 2026-08-03 | PR #81 contract; `lib/billing/accountAccess.ts`; `app/api/me/route.ts` | PR #82 |
| PR82-I-03 | None | Trusted `APP_BASE_URL` plus fixed success and cancellation paths | APPROVED | Stefan Kajchevski | 2026-08-03 | PR #81 contract; `lib/env.ts`; `.env.example` | PR #82 |
| PR82-I-04 | None | Safe-disabled checkout and controlled status handling | APPROVED | Stefan Kajchevski | 2026-08-03 | PR #81 contract; `middleware.ts` | PR #82 |
| PR82-I-05 | None | Exactly one server-configured variant; browser input is non-authoritative | APPROVED | Stefan Kajchevski | 2026-08-03 | PR #81 contract; `lib/product/packageLabels.ts` | PR #82 |
| PR82-I-06 | None | Local `dev` test mode only; all production checkout disabled | APPROVED | Stefan Kajchevski | 2026-08-03 | PR #81 contract; `lib/env.ts`; environment-safety contract | PR #82 |

## 8. Detailed implementation decisions

### PR82-I-01 — Exactly-one-membership organization binding

| Field | Value |
|---|---|
| Related commercial decision | C-09 |
| Status | APPROVED |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Evidence | `docs/beta/commercial-decisions-test-configuration.md`; `lib/billing/ensureOrgForUser.ts`; `lib/billing/chargeCredits.ts` |
| Affected PR | PR #82 |
| Supersession status | Current; not superseded |

Selected behavior:

```text
The authenticated user must have exactly one OrgMember membership before
a checkout session can be created.

The organization is resolved server-side.

Zero memberships fail closed.

More than one membership fails closed with support-required behavior.

Browser-supplied organization IDs are never authoritative.

No organization selector is introduced in PR #82.
```

Implementation consequences:

- no provider request occurs unless membership cardinality equals one;
- organization identity comes only from server-owned membership data;
- provider metadata may carry the resolved organization ID only as a mapping
  field;
- browser organization IDs are ignored or rejected;
- no subscription, entitlement, wallet, ledger, or credit mutation occurs; and
- checkout does not silently select the oldest membership when multiple
  memberships exist.

This deliberately overrides silent oldest-membership selection for checkout
only. PR #82A changes no existing billing or account lookup behavior.

### PR82-I-02 — Active-trial checkout behavior

| Field | Value |
|---|---|
| Related commercial decision | C-11 |
| Status | APPROVED |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Evidence | `docs/beta/commercial-decisions-test-configuration.md`; `lib/billing/accountAccess.ts`; `app/api/me/route.ts` |
| Affected PR | PR #82 |
| Supersession status | Current; not superseded |

Selected behavior:

```text
A user with an active trial may create and complete Lemon Squeezy test
checkout.

Checkout does not end, shorten, replace, or mutate the current trial.

Existing trial subscription history and persisted expiry remain unchanged.

Checkout completion does not activate paid access.

Only later verified provider-event processing may create or normalize
paid subscription state.

PR #82 grants no paid credits and changes no existing trial credits.
```

Implementation consequences:

- active trial status does not block checkout creation;
- checkout return pages do not modify trial state;
- no paid subscription row is created;
- no entitlement or credit grant occurs; and
- remaining trial-credit treatment remains deferred.

This approval is limited to test-checkout implementation. It is not the final
public trial-conversion policy.

### PR82-I-03 — Trusted return-origin contract

| Field | Value |
|---|---|
| Related commercial decision | None |
| Status | APPROVED |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Evidence | `docs/beta/commercial-decisions-test-configuration.md`; `lib/env.ts`; `.env.example` |
| Affected PR | PR #82 |
| Supersession status | Current; not superseded |

Selected behavior:

```text
Success and cancellation URLs are derived server-side from trusted
APP_BASE_URL configuration.

The browser cannot provide the origin or complete return URLs.

Fixed paths are used:

/billing/checkout/success
/billing/checkout/cancel
```

Safeguards:

- `APP_BASE_URL` must be an absolute URL;
- local `dev` may use an explicitly approved localhost HTTP origin;
- `prod` requires HTTPS;
- user-controlled hostnames are prohibited;
- missing or malformed origin fails closed before a provider request;
- paths are joined without accepting a user-controlled host; and
- query parameters cannot establish organization, plan, variant, payment,
  subscription, entitlement, or credit state.

PR #82A creates no return page.

### PR82-I-04 — Kill switch and status handling

| Field | Value |
|---|---|
| Related commercial decision | None |
| Status | APPROVED |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Evidence | `docs/beta/commercial-decisions-test-configuration.md`; `middleware.ts` |
| Affected PR | PR #82 |
| Supersession status | Current; not superseded |

Selected behavior:

```text
LEMON_SQUEEZY_ENABLED=false is the safe default.

Disabled, missing, malformed, environment-incompatible, or intentionally
unavailable checkout returns controlled 503 Service Unavailable.
```

Required unavailable behavior:

- no Lemon Squeezy request;
- no checkout URL;
- no subscription or entitlement mutation;
- no wallet or ledger mutation;
- no credit grant or deduction;
- no sensitive provider configuration in the response; and
- UI does not represent checkout as operational.

Future endpoint status contract:

| Status | Meaning |
|---:|---|
| 401 | Unauthenticated |
| 403 | Authenticated but prohibited by account policy |
| 409 | Authenticated account conflicts with checkout prerequisites |
| 503 | Checkout disabled, unavailable, or incorrectly configured |

Zero memberships, multiple memberships, or another explicit account-state
conflict are `409` examples. PR #82A implements none of these responses.

### PR82-I-05 — Single-variant allowlisting

| Field | Value |
|---|---|
| Related commercial decision | None |
| Status | APPROVED |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Evidence | `docs/beta/commercial-decisions-test-configuration.md`; `lib/product/packageLabels.ts` |
| Affected PR | PR #82 |
| Supersession status | Current; not superseded |

Selected behavior:

```text
PR #82 supports exactly one configured Lemon Squeezy variant.

The endpoint does not accept an authoritative variant ID from the browser.

The server reads the only authoritative variant from:

LEMON_SQUEEZY_VARIANT_ID
```

Safeguards:

- browser plan or variant input is ignored or rejected;
- the configured variant must be present and syntactically valid;
- provider metadata includes internal plan code `standard_v1`;
- metadata is a mapping field and does not grant entitlement; and
- future variants require a new explicit allowlist decision.

This approval does not approve price, currency, billing interval, seat count,
or paid-credit allowance. The actual test variant ID remains an external local
test-deployment blocker.

### PR82-I-06 — Environment/provider-mode validation

| Field | Value |
|---|---|
| Related commercial decision | None |
| Status | APPROVED |
| Approver | Stefan Kajchevski |
| Approval date | 2026-08-03 |
| Evidence | `docs/beta/commercial-decisions-test-configuration.md`; `docs/beta/environment-and-deployment-safety.md`; `lib/env.ts`; `.env.example` |
| Affected PR | PR #82 |
| Supersession status | Current; not superseded |

Approved checkout matrix:

| Release Signal environment | Lemon Squeezy mode | Enabled | Result |
|---|---|---:|---|
| `dev` | `test` | `true` | Allowed with complete test configuration |
| `dev` | `live` | any | Denied |
| `prod` | `test` | any | Denied |
| `prod` | `live` | `false` | Safely disabled |
| `prod` | `live` | `true` | Denied until separate live-activation approval |

Required rules:

- `LEMON_SQUEEZY_MODE` accepts only `test` or `live`;
- missing environment identity or provider mode fails closed;
- `prod` never falls back to test mode;
- local `dev` never uses live mode;
- PR #82 does not enable production live checkout;
- validation occurs before any provider request;
- invalid combinations return controlled `503`;
- test and live values cannot be mixed; and
- `master` production remains disabled during PR #82.

A distinct staging or approved preview checkout environment is not currently
implemented. Future staging or preview checkout requires a separate trusted
environment identity, implementation change, and owner approval. Neither may
be silently mapped to another environment. PR #82A does not change `lib/env.ts`.

## 9. Local test-deployment blockers

The approvals allow PR #82 code to begin, but local test execution remains
blocked until all of the following exist:

- Lemon Squeezy test account and store availability;
- test store ID;
- test variant ID;
- test API key configured outside Git;
- trusted local `APP_BASE_URL`;
- complete local test configuration;
- environment-isolation evidence;
- successful provider test connectivity; and
- provider test product and variant configuration.

The initial test target is only:

```text
local dev
+
Lemon Squeezy test mode
```

No staging or preview checkout environment is required before implementing or
locally testing PR #82. No identifier or secret is invented by this record.

## 10. Commercial-activation blockers

The following remain unresolved but do not block writing the generic local test
checkout endpoint:

- final seller route and provider account approval;
- final public price and currency;
- billing interval and tax presentation;
- paid seat count and paid-credit allowance;
- credit reset, rollover, expiry, top-up, and overage policy;
- normalized subscription authority;
- cancellation policy;
- refund and chargeback policy;
- paid-credit reconciliation;
- support ownership and escalation;
- final legal publication;
- production live configuration; and
- production live activation approval.

## 11. Supersession rules

- Implementation decisions do not silently modify commercial decisions.
- A later change must identify the implementation decision it supersedes.
- Every change requires dated owner approval.
- Provider confirmation does not replace owner approval.
- Owner approval does not replace provider, legal, tax, or accounting
  confirmation.
- Private evidence remains outside Git.
- Agents must use the latest non-superseded approved record.
- Environment vocabulary must reflect the actual approved deployment model.
- Future staging or preview checkout support requires a separate decision.
- Silent edits to an approved selected behavior are prohibited.

## 12. PR #82 implementation handoff

After this log is merged, PR #82 may implement only:

```text
Server-created Lemon Squeezy local test checkout
```

Allowed scope:

- authenticated server endpoint;
- exactly-one-membership guard;
- server-resolved organization metadata;
- one configured variant;
- kill switch;
- `dev | prod` environment validation;
- `test | live` provider-mode validation;
- trusted return URLs derived from `APP_BASE_URL`;
- controlled `401`, `403`, `409`, and `503` handling;
- Lemon Squeezy test checkout creation in local `dev`; and
- return of a provider checkout URL to the authenticated client.

Prohibited scope:

- webhook endpoint;
- subscription creation or normalization;
- entitlement activation;
- paid-credit grants;
- trial mutation;
- cancellation synchronization;
- refund processing;
- customer portal;
- public checkout CTA;
- production live enablement;
- production test mode;
- staging implementation;
- preview checkout implementation; and
- browser-authoritative organization, plan, variant, payment, or subscription
  state.

## 13. Definition of Done

- [x] Six unique PR82-I implementation decisions are recorded.
- [x] PR82-I-01 references C-09.
- [x] PR82-I-02 references C-11.
- [x] No new C-identifier or D-identifier is introduced.
- [x] Every implementation decision is APPROVED.
- [x] Approver, approval date, evidence, affected PR, and supersession state are
  present.
- [x] Local development is `dev` and `master` deployment is `prod`.
- [x] Preview and staging checkout are explicitly unsupported.
- [x] Only enabled local `dev` plus provider `test` mode is allowed.
- [x] Production checkout remains disabled.
- [x] Local test-deployment and commercial-activation blockers remain separate.
- [x] No price, currency, credit allowance, provider ID, or secret is invented.
- [x] No runtime, environment, public page, schema, billing, credit, Auth0,
  Review Score, or Release Readiness behavior changes.
- [x] PR #82 runtime implementation has not begun.
