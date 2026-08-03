# Commercial Decisions and Lemon Squeezy Test Configuration

## Document control

| Field | Value |
|---|---|
| Scope | PR #81 — Commercial Decisions and Lemon Squeezy Test Configuration |
| Status | Decision and configuration contract; PR #82 remains blocked |
| Protected baseline | `master` at `6c0a33951aba742d0513c8508f21d74ee764c6f6` |
| Provider | Lemon Squeezy candidate, subject to account and activation approval |
| Repository audit date | 2026-07-31 |
| Runtime effect | None; documentation only |
| Final commercial decision owner | Stefan |

This document records confirmed repository behavior, candidate first-release
defaults, open owner decisions, external configuration, and the fail-closed
contract for future Lemon Squeezy test-mode checkout work. A recommendation is
not an approval. No open value may be treated as implementation authority.

Status vocabulary:

| Status | Meaning |
|---|---|
| `Repository-confirmed` | Current code or merged documentation establishes the fact |
| `Owner-approved` | Stefan has explicitly approved the value in a dated decision record |
| `Candidate — owner approval required` | A bounded recommendation exists but is not approved |
| `Manual external configuration required` | A provider or deployment action outside Git is required |
| `Provider/legal confirmation required` | Lemon Squeezy or a qualified adviser must confirm the point |
| `Future runtime implementation` | A later scoped PR must implement and test the contract |
| `Blocked` | Downstream work must not guess or proceed past the named gate |

## 1. Purpose and status

The goal is to give PR #82 a precise test-checkout contract without
implementing checkout. The document:

- preserves current product and authority boundaries;
- records the exact commercial decisions still missing;
- defines server-side organization and subscription resolution boundaries;
- defines proposed environment-variable names and failure behavior;
- separates test and live configuration;
- makes browser returns presentation-only; and
- keeps commercial activation blocked.

Readiness result:

```text
Documentation/configuration contract: COMPLETE when this draft is validated.
PR #82 checkout implementation: BLOCKED pending the gates in §18 and §20.
Commercial activation: BLOCKED.
```

## 2. Protected baseline

The protected workflow remains:

```text
Requirement
→ Test Design
→ Test Review
→ Review-driven improvement
→ Execution Evidence
→ Release Readiness
```

The protected architecture remains:

```text
AI
→ parsed structured artifacts
→ deterministic system logic
→ UI
```

Human QA and release owners remain final decision authorities. Review Score
remains separate from Release Readiness. Application-admin authority does not
imply commercial-owner authority.

Current protected commercial facts:

- public trial offer: 10 days;
- runtime new-trial provisioning: 15 days;
- existing persisted trial expiries must not be shortened;
- current trial: `trial_v1`, `trialing`, 100 credits, 1 seat;
- future paid plan code: `standard_v1`;
- credits belong to an organization and are usage units, not money;
- AI usage costs `max(1, ceil(totalTokens / 1000))` credits;
- direct execution-evidence upload and deterministic Release Readiness are
  credit-free;
- the legacy AI chat execution-ingest action charges one credit;
- checkout/browser state is non-authoritative; and
- future paid access and grants require verified provider events plus
  server-owned database state.

## 3. Repository evidence

### 3.1 Audited sources

| Requested area | Actual repository source | Finding |
|---|---|---|
| Commercial readiness | `docs/beta/legal-pricing-support-readiness.md` | Paid values and lifecycle decisions remain open |
| Provider approval readiness | `docs/beta/lemon-squeezy-store-approval-readiness.md` | Actual filename differs from the ticket shorthand; no integration or identifiers exist |
| Environment safety | `docs/beta/environment-and-deployment-safety.md` | Actual filename differs from the ticket shorthand; isolation evidence remains incomplete |
| Auth0 authority | `docs/beta/auth0-branding-commercial-authority-runbook.md` | Application admin and commercial owner remain separate |
| Package labels | `lib/product/packageLabels.ts` | Actual location is `lib/product`, not `lib/billing` |
| Trial provisioning | `lib/billing/ensureOrgForUser.ts` | 15 days, 100 credits, `trial_v1`, `trialing`, 1 seat |
| Organization charging | `lib/billing/chargeCredits.ts` | Charges the oldest-membership organization's wallet |
| Account access | `lib/billing/accountAccess.ts` | Reads newest subscription; permits current `trialing`/`active` rules only |
| Credit calculation | `lib/chat/costs.ts` | One credit per 1,000 tokens, rounded up |
| Account display | `app/api/me/route.ts`, `app/chat/UserBar.tsx` | Server state drives displayed plan, period, and balance |
| Data model | `prisma/schema.prisma` | Organization subscriptions; one wallet per organization/currency |
| Environment contract | `lib/env.ts`, `.env.example` | Uppercase underscore names; server-only central validation; no Lemon Squeezy variables |
| Dependencies/build | `package.json` | No Lemon Squeezy SDK; build invokes `prisma migrate deploy` |

### 3.2 Confirmed absence

Repository search found no Lemon Squeezy runtime client, checkout route,
webhook route, portal route, provider product/variant mapping, provider
identifier, paid subscription normalization, or paid-period credit grant.

## 4. Commercial decision register

All decisions are open unless marked `Repository-confirmed`. Candidate defaults
must receive explicit Stefan approval before becoming implementation input.

| ID | Decision | Current resolution | Evidence/confirmation required | Gate |
|---|---|---|---|---|
| C-01 | Seller path | `Blocked` — individual versus registered entity is not selected | Lemon Squeezy account-specific confirmation, qualified North Macedonian advice, Stefan approval | Commercial activation |
| C-02 | Initial plan name/code | `Standard` / `standard_v1` are repository-supported candidates, not final provider approval | Stefan approval of checkout/product display name | Commercial activation |
| C-03 | Price and currency | `Blocked` — amount, currency, and tax display are unapproved | Stefan approval; provider configuration; tax advice where applicable | Real test variant and commercial activation |
| C-04 | Billing interval | `Blocked` — monthly-only is a candidate; annual is not approved | Stefan approval | Commercial activation |
| C-05 | Paid seats | `Blocked` — one seat is a candidate; current trial seat count does not approve paid seats | Stefan approval and membership policy | Commercial activation |
| C-06 | Paid AI allowance | `Blocked` — no credits-per-period or cost ceiling is approved | Stefan approval using usage/reserve evidence | Paid-credit implementation |
| C-07 | Reset/expiry/rollover | `Blocked` — reset/no-rollover/no-top-up/no-overage is a candidate only | Stefan approval | Paid-credit implementation |
| C-08 | Credit exhaustion | Current zero-credit denial is `Repository-confirmed`; continued credit-free functions are a candidate commercial contract | Stefan approval and later regression evidence | Paid-credit/UI implementation |
| C-09 | Organization binding | Oldest membership is `Repository-confirmed`; checkout must instead require exactly one server-resolved membership | Stefan approval of the fail-closed checkout rule | PR #82 implementation |
| C-10 | Subscription selection | Newest row is `Repository-confirmed`; normalized provider/environment/lifecycle authority and conflict handling remain future work | Stefan approval and later state-machine evidence | Webhook/subscription implementation |
| C-11 | Trial-to-paid | Verified-event activation is protected; active-trial purchase timing and remaining-credit treatment are open | Stefan approval; provider lifecycle confirmation | PR #82 timing and later webhook/paid-credit work |
| C-12 | Cancellation | `Blocked` — timing, access, credits, portal configuration, and mapping are open | Stefan approval, provider confirmation, qualified legal review | Commercial activation |
| C-13 | Refund/chargeback | Verified-event handling is protected; reconciliation policy is open | Stefan approval, provider confirmation, qualified legal review | Commercial activation; later reconciliation |
| C-14 | Tax presentation | `Blocked` — inclusive/exclusive display is not chosen | Stefan approval after provider and qualified tax advice | Commercial activation |
| C-15 | Support ownership | Address candidate confirmed; owners, language, and escalation are open | Monitored-inbox evidence and Stefan approval | Commercial activation |

The C-01 through C-15 identifiers belong to this commercial checkout contract
and are a separate namespace from the D-01 through D-20 decision register in
`legal-pricing-support-readiness.md`.

## 5. Unresolved blockers and approval authority

Unresolved items are classified by the first phase they block in §20. A paid
credit policy may block paid-credit implementation without blocking creation of
a generic, configuration-driven checkout endpoint. Price and currency are
needed before creating the real provider test variant, but they do not prevent
implementation of that generic endpoint.

The planned authoritative approval record is:

```text
docs/beta/commercial-decision-log.md
```

That file does not need to be created in PR #81. Future approvals must record
the decision ID, selected value, approver, date, evidence reference, and
affected PR. Stefan is the final owner approver. Provider and legal evidence
remain separate from owner approval. Private provider, tax, banking, and
identity evidence must not be committed. Undated conversation assumptions are
not approved commercial decisions. PR #82 may consume only decisions recorded
in the approved decision log or directly approved in its bounded kickoff.

## 6. Initial package contract

| Field | Candidate value | Approval status |
|---|---|---|
| Product/package display name | `Standard` / `Release Signal Standard` | `Candidate — owner approval required` |
| Internal plan code | `standard_v1` | `Repository-confirmed` future code; activation mapping not implemented |
| Billing interval | Monthly only | `Candidate — owner approval required` |
| Paid seats | 1 seat per subscription | `Candidate — owner approval required` |
| Extra members | No paid multi-seat entitlement is defined | `Blocked` pending membership policy |
| Annual package | None for initial release | Candidate scope constraint; no annual promise is approved |
| Top-ups/overage | None for initial release | `Candidate — owner approval required` |

No provider product or variant may be created from this table until all fields
required for that product are owner-approved.

## 7. Credit-period contract

### 7.1 Confirmed behavior

- Credits are stored in one `CreditWallet` per organization and currency.
- Trial creation grants 100 credits and records `trial_grant` in the ledger.
- AI usage is token-derived and charged transactionally with idempotency.
- A zero or missing balance denies AI-backed account access.
- Direct execution-evidence upload, export, and deterministic readiness are
  credit-free.
- Legacy AI execution-result ingestion charges one flat credit.

### 7.2 Required paid-period decisions

| Field | Value/status |
|---|---|
| Credits per billing period | `Blocked — owner value required` |
| Estimated AI cost ceiling | `Blocked — usage/reserve evidence required` |
| Period grant timing | Only after verified, mapped provider-event processing |
| Period grant idempotency | Provider mode + subscription ID + billing-period identity + grant type |
| Reset date | `Blocked — owner policy required` |
| Unused credit expiry | `Blocked — owner policy required` |
| Rollover | No rollover is a candidate, not approved |
| Top-ups | No top-ups is a candidate, not approved |
| Overage billing | No overage is a candidate, not approved |
| Zero-credit behavior | Existing curated denial; credit-free paths continue only after owner approval and tests |

These values block paid-credit implementation, not generic checkout creation.
Checkout metadata and return copy must not claim an unapproved allowance.

## 8. Organization-binding contract

Current repository behavior for normal provisioning and charging:

```text
authenticated Auth0 subject
→ earliest-created OrgMember by createdAt ascending, then id ascending
→ organization wallet and account state
```

Credits and subscriptions are organization-owned. Normal provisioning and
charging resolve membership in deterministic order. There is currently no
supported organization switcher and no implemented multi-organization checkout
selector. Two admin billing routes may use narrower lookup behavior; those
routes do not define the customer checkout contract.

Required first-release checkout rule, pending owner approval as `C-09`:

```text
The checkout endpoint must resolve the authenticated user's organization
server-side.

Exactly one OrgMember membership must exist.

If zero memberships exist, checkout fails closed.

If more than one membership exists, checkout fails closed with a
support-required response.

The browser must not select or submit an organization ID as authority.
```

The current oldest-membership rule remains documented repository behavior, but
checkout must not use it to choose silently among multiple organizations. PR
#82 adds no multi-organization feature. Checkout metadata may contain only the
server-resolved organization ID as a provider-to-local mapping field. Later
webhook processing must validate that mapping against server-owned records.

## 9. Subscription-selection contract

```text
Current code selects the newest subscription row for the resolved
organization, ordered by createdAt descending, and then evaluates the
selected row's status.
```

Current repository flow:

```text
resolved organization
→ newest Subscription row by createdAt descending
→ current account access and /api/me display
```

The raw newest-row rule creates known risks: a newer cancelled row can
supersede an older active row; a malformed or incomplete row can supersede an
older usable row; a test-mode row must not supersede a live row; and duplicate
or conflicting paid subscriptions must not be resolved silently.

```text
The raw newest-row rule is current repository behavior, not the final
normalized paid-subscription authority.

Webhook and subscription-normalization work must use provider identity,
environment, lifecycle status, and conflict detection.

Conflicting paid subscription records must produce support-required
state rather than silent entitlement selection.
```

PR #82 must not create or normalize subscription rows. The future normalized
commercial conflict policy remains `Candidate — owner approval required` as
`C-10`.

## 10. Trial-to-paid contract

Protected authority:

```text
verified Lemon Squeezy subscription event
→ validated mode/product/variant/customer mapping
→ newer paid local subscription state
→ deterministic entitlement
→ idempotent paid-period credit grant
```

Candidate simplest first-release behavior:

- an active trial user may enter checkout only after the commercial values are
  approved;
- checkout completion does not activate the account;
- paid activation begins only after verified event processing;
- the newer paid subscription row supersedes the trial row for access;
- the historical trial row and persisted expiry remain unchanged;
- paid credits are granted only after verified event processing; and
- remaining trial-credit treatment is `Blocked — owner decision required`.

Payment timing, provider trial configuration, and remaining-credit treatment
are not approved. PR #82 must not guess them.

## 11. Cancellation and refund baseline

### 11.1 Cancellation

Open decisions:

- immediate versus period-end cancellation effect;
- access through the paid period;
- use or expiry of remaining credits;
- hosted-portal features and configuration;
- local status mapping and resume behavior; and
- customer communication.

No provider default is treated as configured. Commercial activation remains
blocked until owner approval, provider confirmation, and qualified legal review.

### 11.2 Refunds and chargebacks

Minimum future implementation constraints:

- client/browser state never restores or revokes credits;
- only verified, environment-matched refund/chargeback events may enter the
  server processing path;
- unused and consumed credits require separate explicit treatment;
- ledger reversals must be idempotent and auditable;
- negative balances are not silently introduced;
- repeated activation → grant → refund/chargeback → activation → grant cycles
  require organization/account linkage, manual review, and abuse controls; and
- future-grant eligibility remains an owner decision.

Checkout foundation may omit automatic refund reconciliation, but commercial
activation remains blocked and the omission must be visible in handoff evidence.

## 12. Support ownership

| Field | Current status |
|---|---|
| Public address | `contact@releasesignal.io` — intended public address |
| Inbox monitoring test | `Manual external configuration required` |
| Primary owner | `Blocked — owner role required` |
| Backup owner | `Blocked — backup role required` |
| Supported language | `Blocked — owner decision required` |
| Payment escalation | `Blocked — Release Signal/provider responsibility path required` |
| Security/privacy escalation | `Blocked — qualified review and operating path required` |

No personal contact details, private identity evidence, or guaranteed response
time belongs in this document.

## 13. Lemon Squeezy test-mode identifiers

No identifier was found in the repository or supplied for this task.

| Identifier | Value/status | Secret? | Storage rule |
|---|---|---|---|
| Test store ID | `BLOCKED — manual external configuration required` | No, but configuration-sensitive | Provider-managed environment; redacted evidence may record presence |
| Test variant ID | `BLOCKED — commercial values and provider setup required` | No, but configuration-sensitive | Provider-managed environment |
| Test product ID | `Deferred — optional for basic checkout when variant allowlisting is sufficient` | No, but configuration-sensitive | Later webhook/product validation configuration if required |
| Test webhook endpoint ID | `Deferred — webhook scope not implemented` | No, but configuration-sensitive | Manual provider metadata; not an application runtime variable |

API keys, webhook signing secrets, seller-verification evidence, bank/tax
information, identity data, and personal addresses must never be stored here.

## 14. Environment-variable contract

The repository convention is uppercase underscore-separated names loaded only
by server code through centralized validation. No `NEXT_PUBLIC_*` payment
authority is permitted. These names are the proposed contract for later scoped
implementation; PR #81 does not add them to code or `.env.example`.

| Variable | Purpose | Classification | Missing/invalid behavior |
|---|---|---|---|
| `LEMON_SQUEEZY_ENABLED` | Boolean checkout kill switch | Server only | Default/fail closed; no provider request |
| `LEMON_SQUEEZY_MODE` | Provider mode; accepts only `test` or `live` | Server only | Fail closed |
| `LEMON_SQUEEZY_STORE_ID` | Allowlisted store mapping | Non-secret, server-owned configuration | Fail closed |
| `LEMON_SQUEEZY_VARIANT_ID` | Allowlisted checkout variant | Non-secret, server-owned configuration | Fail closed |
| `LEMON_SQUEEZY_API_KEY` | Provider API authentication | Server-only secret | Fail closed; no provider request |
| `APP_BASE_URL` | Trusted server-owned application origin | Server-only configuration | Fail closed; no checkout creation |

`APP_BASE_URL` supplies the trusted origin for fixed application paths such as
`/billing/checkout/success` and `/billing/checkout/cancel`. The browser and
request body cannot supply or override the return origin.

`LEMON_SQUEEZY_PRODUCT_ID` and `LEMON_SQUEEZY_WEBHOOK_SECRET` are deferred to
later webhook requirements. Product ID is optional for basic checkout creation
when variant allowlisting is sufficient, but may become required for webhook
normalization and product/variant validation. The webhook secret is not
required for PR #82. A webhook endpoint ID is manual provider metadata, not an
application runtime variable.

Validation must reject whitespace-only values, malformed booleans, unknown
modes, unsupported origins, mode/ID mismatches, and mixed test/live resources.
PR #81 adds no runtime variable and does not modify `.env.example`.

## 15. Environment-isolation rules

```text
Local/test checkout
→ Lemon Squeezy test mode only

Staging
→ Lemon Squeezy test mode only until explicit activation

Production
→ disabled until live identifiers and activation approval exist
```

Mandatory server-side stage/mode validation before every provider call:

| Runtime stage | Provider mode | Enabled | Result |
|---|---|---:|---|
| local | test | true | Allowed |
| local | live | any | Denied |
| preview | test | true | Allowed only when explicitly configured |
| preview | live | any | Denied |
| staging | test | true | Allowed |
| staging | live | any | Denied until separate activation approval |
| production | test | any | Denied |
| production | live | false | Disabled safely |
| production | live | true | Allowed only after explicit live activation and complete live configuration |

Required rules:

- test and live keys, IDs, webhook secrets, endpoints, and evidence are separate;
- production never falls back to test configuration;
- live mode never runs in local, preview, or staging before explicit approval;
- test and live identifiers cannot be mixed;
- missing runtime-stage information fails closed;
- missing configuration never creates checkout;
- mode and allowlisted identifiers are validated server-side;
- later webhook processing matches event mode to configured environment;
- Preview receives no production credentials or identifiers;
- staging uses an isolated stable identity and non-production application,
  database, Redis, Auth0, and OpenAI resources;
- the migration-bearing build must not give Preview production database access;
  and
- environment-isolation evidence from
  `docs/beta/environment-and-deployment-safety.md` remains a blocker.

These rules preserve the PR #76 environment-safety contract.

## 16. Checkout kill-switch contract

Safe default:

```text
LEMON_SQUEEZY_ENABLED=false
```

Future runtime behavior while disabled or unavailable returns:

```text
503 Service Unavailable
```

The controlled, non-sensitive response applies when checkout is disabled,
required provider configuration is absent or malformed, runtime-stage and
provider-mode checks fail, or the provider is intentionally unavailable.

Required behavior:

- no checkout session is created;
- no Lemon Squeezy request occurs;
- no checkout URL is created;
- UI does not advertise available payment;
- no local subscription mutation;
- no entitlement mutation;
- no wallet or ledger mutation;
- no credit change; and
- missing, blank, or malformed enablement configuration is treated as `false`.

Enabling checkout also requires valid test mode, all checkout-required test
configuration, approved commercial values, authenticated server-side account
resolution, and environment-isolation evidence. The boolean alone is never
sufficient authority.

## 17. Non-authoritative return-flow contract

Recommended future success copy:

```text
Payment submitted.

Release Signal is verifying your subscription. Access and credits will
update only after the provider event is verified and processed.
```

Recommended future cancellation copy:

```text
Checkout cancelled.

No local subscription, entitlement, or credit change was made by this
return page.
```

Neither return may:

- grant access or credits;
- create or update a local subscription;
- accept plan, organization, price, payment, mode, or entitlement truth from
  query parameters or browser state;
- mark payment successful;
- bypass verified webhook processing; or
- imply that an email, receipt, redirect, or provider dashboard is authority.

The return page does not verify payment. Account refresh reads server-owned
state only. Delayed activation routes to support without temporary access.

## 18. PR #82 implementation handoff

PR #82 is **Server-created Lemon Squeezy test checkout only**. It may begin once
the PR #82 implementation blockers in §20 are closed and may use explicitly
configured test identifiers even while commercial activation remains blocked.

PR #82 may implement only:

- an authenticated server endpoint;
- exactly-one-membership organization resolution;
- an approved variant allowlist;
- server-owned checkout metadata;
- server-side test/live mode and runtime-stage validation;
- the kill switch;
- trusted success and cancel return URLs derived from `APP_BASE_URL`; and
- controlled `503 Service Unavailable` behavior.

PR #82 must not implement:

- webhook handling;
- subscription-row creation or normalization;
- entitlement activation;
- credit grants;
- refund processing;
- cancellation synchronization;
- a customer portal;
- a public payment CTA; or
- live production enablement.

## 19. Definition of Done

- [x] Repository behavior and actual source paths were audited.
- [x] Every minimum commercial decision is confirmed or explicitly blocked.
- [x] No price, currency, interval, paid seat, or paid allowance was invented.
- [x] Organization binding and subscription selection are explicit.
- [x] Trial-to-paid and paid-credit authority boundaries are explicit.
- [x] Test/live environment separation is explicit.
- [x] A fail-closed checkout kill switch is defined.
- [x] Return flows are presentation-only and non-authoritative.
- [x] Test identifiers are explicitly blocked rather than fabricated.
- [x] No secret or private verification evidence is recorded.
- [x] PR #82 has an exact stop/go checklist and cannot proceed by guessing.
- [x] Public paid activation remains blocked.
- [x] No runtime, public page, schema, environment, or provider state changed.

## 20. Phase-classified blockers

### Blocks PR #82 implementation

- approved exactly-one-membership organization-binding rule (`C-09`);
- active-trial purchase timing (`C-11`);
- trusted return-origin contract based on `APP_BASE_URL`;
- kill-switch response behavior;
- variant allowlisting contract; and
- server-side test/live mode and runtime-stage validation.

### Blocks test deployment

- Lemon Squeezy test store and variant configuration;
- provider API key in the test environment;
- test return origin;
- environment-isolation evidence; and
- successful test-mode provider connectivity.

### Blocks paid-credit implementation, not checkout creation

- credits granted per billing period (`C-06`);
- remaining trial-credit treatment (`C-11`);
- reset, expiry, and rollover (`C-07`);
- top-up and overage policy (`C-07`);
- complete zero-credit customer behavior (`C-08`);
- refund or chargeback credit reconciliation (`C-13`); and
- idempotent period-grant identity.

### Blocks commercial activation

- final provider-facing plan name (`C-02`);
- final price and currency (`C-03`);
- approved billing interval (`C-04`);
- paid seat count and membership policy (`C-05`);
- tax presentation (`C-14`);
- cancellation policy (`C-12`);
- refund and chargeback policy (`C-13`);
- normalized subscription authority and conflict policy (`C-10`);
- support ownership and escalation (`C-15`);
- seller/provider approval (`C-01`); and
- final legal publication approval.

### Blocks public launch

- production live identifiers;
- live environment isolation;
- completed legal pages;
- public pricing and payment copy;
- resolution of the documented 10-day public versus 15-day runtime mismatch;
- verified support operation; and
- completed end-to-end payment lifecycle testing.

Price and currency are needed before creating the real provider test variant,
but they do not prevent implementation of a generic, configuration-driven
server checkout endpoint. PR #82 may be implemented against explicitly
configured test identifiers once its implementation blockers are closed.
Commercial activation remains blocked until the wider commercial decisions are
approved.

Existing persisted trial expiries remain unchanged. This document does not
implement checkout, create provider configuration, or authorize commercial
activation.
