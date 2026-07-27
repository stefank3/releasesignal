# Commercial Beta Launch Readiness

## Document control

| Field | Value |
|---|---|
| Scope | PR #75 — Commercial Beta Launch Readiness Plan |
| Status | Architecture and launch-readiness plan; no runtime implementation |
| Protected baseline | `master` at `a3b7e6c4ee5135b44ae7f1e5ce9f498cd9fad00c` |
| Latest completed work | PR #74 — Beta Onboarding Completion |
| Production branch | `master` |
| Final launch authority | Stefan |
| Architecture rule | AI → parsed → structured artifacts → deterministic system logic → UI |

This document is the authoritative commercial beta architecture and sequencing
plan. Later implementation PRs must operate within it. A conflicting change
requires a separate, explicit product decision; it must not be introduced as an
implementation detail.

## 1. Purpose and current state

Release Signal is product beta-ready. The workspace, onboarding, visual
alignment, cleanup, architecture documentation, and frontend modularisation
cycles are complete. Frontend modularisation is paused and must not be reopened
by the commercial beta programme.

Release Signal is:

> a structured QA intelligence and release-readiness workspace

Its primary workflow is:

```text
Requirement
→ Test Design
→ Test Review
→ Review-driven improvement
→ Execution Evidence
→ Release Readiness
```

The strongest entry point remains sprint planning and feature readiness. This
plan moves the existing product toward a controlled commercial beta launch. It
is not a workspace redesign, Jira integration, Release Signal v2, demo
workspace, full administration panel, or renewed modularisation plan.

The current product UX and behaviour are the protected beta-ready baseline.
Commercial work follows:

```text
move and preserve first — redesign only through explicit product decision
```

## 2. Locked commercial baseline

### Decision record CBL-001 — Approved Phase 0 decisions

Status: **APPROVED**

The following decisions are authoritative:

```text
master is production.

The current product UX and behaviour remain protected.

Auth0 remains the identity provider.

Lemon Squeezy is the payment and subscription provider candidate.

Verified Lemon Squeezy webhook events plus Release Signal database state
become subscription truth.

Return URLs, emails, checkout completion pages, and frontend state
are never payment or subscription authority.

Trial and paid users see only their own plan, account status, and credits.

Operational admin access and commercial owner access remain separate.

Full administrative mutation controls remain deferred.
```

Later PRs must not reopen, weaken, or reinterpret these decisions implicitly.
Any conflict requires a separate product decision approved by Stefan before
implementation.

## 3. Commercial readiness states

Readiness states are cumulative. Passing a later state requires retaining all
earlier evidence.

| State | Required evidence | Allowed activity | Prohibited activity | Exit gate |
|---|---|---|---|---|
| Product beta-ready | Protected workflow works; onboarding, visual alignment, cleanup, architecture documentation, and modularisation cycles are complete | Internal validation and approved beta operation | Claiming payment or commercial launch readiness | Existing beta baseline accepted |
| Controlled external beta-ready | Healthy production deployment, login, trial provisioning, own-account display, onboarding, support path, trust links, known limitations, normal workspace workflow | Invite manually approved external trial users | Open self-service signup, paid activation, or unreviewed commercial claims | Controlled external beta invitation gate is `GO` or `GO WITH ACCEPTED LIMITATIONS` |
| Lemon Squeezy approval-ready | Merchant, payout, tax, public website, product, fulfilment, legal, support, pricing, test account, and evidence pack complete | Submit a truthful store application and answer review questions | Live payment acceptance or unsupported claims | Submission checklist complete and Stefan approves submission |
| Test-payment integration-ready | Isolated staging resources, test products, signed test webhooks, deterministic mapping, idempotency, credit ledger processing, failure handling, portal and notification evidence | Run Lemon Squeezy test-mode scenarios in staging | Live credentials, production data mutation, or treating test data as commercial truth | Required test matrix passes with no unresolved authority or integrity blocker |
| Live-payment-ready | Store approval, separated live configuration, production webhook, live IDs, kill switches, rollback, monitoring, mapping and grant validation | Execute one controlled real payment with explicit approval | General paid launch or uncontrolled checkout exposure | Live-payment enablement gate is `GO` |
| Commercial beta launch-ready | Controlled live payment, renewal, failure, cancellation, expiry, own-plan/credit display, owner visibility, support, legal, monitoring and limitations evidence | Invite approved paid beta users within capacity and support limits | Broader public launch or deferred mutation controls | Commercial beta launch gate is `GO` or an explicitly accepted `GO WITH ACCEPTED LIMITATIONS` |

`NO-GO` blocks advancement. `GO WITH ACCEPTED LIMITATIONS` requires the
limitation, owner, impact, mitigation, review date, and Stefan's acceptance to
be recorded.

## 4. Environment and deployment strategy

### Target environment model

```text
master = production
PR previews = bounded review deployments
staging = isolated integration validation
```

Every merge to `master` is a production release. A PR must therefore be
production-safe before merge; production must not be treated as an integration
test environment.

| Boundary | PR preview | Staging | Production |
|---|---|---|---|
| Vercel | Ephemeral, bounded review deployment | Stable non-production integration project/environment | Production project/environment deployed from `master` |
| Auth0 | No production client secret; use an approved non-production client only when authentication review is required | Dedicated staging tenant or application | Dedicated production tenant or application |
| Supabase/Postgres | No production write credentials; isolated disposable/read-safe data only | Dedicated staging database | Production database |
| Lemon Squeezy | No live credentials; test mode only if the preview is explicitly trusted and needed | Test-mode store/products/variants | Live mode only after approval and live gate |
| Webhook endpoint | Disabled by default; temporary preview endpoint only for an explicitly bounded test | Stable staging endpoint | Stable production endpoint |
| Webhook secret | Preview-specific or absent | Staging/test secret | Production/live secret |
| API keys | Least privilege and preview-safe | Staging/test keys | Production/live keys |
| Product and variant IDs | Test IDs only, if needed | Test product and variant IDs | Live product and variant IDs |
| Checkout URLs | Test and short-lived only | Test checkout generated server-side | Live checkout generated server-side |
| Return URLs | Exact preview URL only when explicitly allowed | Staging origin | Production origin |
| Customer portal URL | Test portal only | Test portal and staging return | Live portal and production return |
| Owner notifications | Disabled or non-production recipient/sink | Test recipient/channel | Approved owner recipient/channel |

```text
Staging must never modify production users, subscriptions,
credits, billing records, webhook records, or account state.
```

### Preview restrictions

- Preview deployments must not receive production database, Auth0, OpenAI,
  Lemon Squeezy, webhook, email, or owner-notification credentials.
- Preview checkout and webhooks are disabled by default.
- A preview requiring external integration must be explicitly trusted, scoped
  to test resources, time-bounded, and removed after review.
- Untrusted or forked previews receive no privileged secrets.
- Preview data must be clearly non-production and disposable.
- Preview URLs must never be configured as production webhook, portal, callback,
  logout, or return destinations.

### Production secret protection

- Store secrets only in provider-managed secret stores with production scope.
- Grant only the runtime and people that require access.
- Never expose server credentials through `NEXT_PUBLIC_*`, client bundles,
  browser logs, screenshots, PR text, or diagnostics.
- Rotate a secret after suspected exposure and record affected systems and
  validation.
- Keep test and live identifiers separate even where the provider uses the same
  dashboard.

## 5. Public repository security

PR #75 changes no repository configuration. Future readiness checks must
confirm:

- [ ] No secrets, private keys, tokens, credentials, personal identity
      documents, or real webhook payloads containing personal data are
      committed.
- [ ] `.env` and local secret files are ignored.
- [ ] `.env.example` contains names and placeholders only.
- [ ] Server credentials never appear in client code or `NEXT_PUBLIC_*`
      variables.
- [ ] Vercel variables use the narrowest Production, Preview, or Development
      scope.
- [ ] Staging and production secrets are distinct.
- [ ] Lemon Squeezy test and live webhook secrets are distinct.
- [ ] Auth0 client secrets, session secrets, and management credentials remain
      server-only.
- [ ] Supabase/Postgres service and direct-connection credentials remain
      server-only.
- [ ] OpenAI keys are project/environment-specific and server-only.
- [ ] Lemon Squeezy API keys are mode-specific and server-only.
- [ ] Production credentials are excluded from unsafe and forked previews.
- [ ] Logs and error responses redact authorization headers, signatures,
      payload PII, and secret values.
- [ ] Secret owners, rotation cadence, and revocation steps are documented
      outside the public repository where necessary.

Accidental exposure response:

1. Disable or rotate the credential immediately.
2. Disable the affected integration or checkout path if continued use is risky.
3. Identify repository, build, log, preview, and provider exposure.
4. Remove the value from current content and follow the approved history-cleanup
   process when required; deletion from the latest commit alone is insufficient.
5. Review access and provider event logs.
6. Replace the credential only in the correct environment scopes.
7. validate authentication, webhook signatures, database access, and runtime
   health.
8. Record the incident, impact, actions, and follow-up without reproducing the
   secret.

## 6. Lemon Squeezy role and provider boundaries

Lemon Squeezy is the candidate merchant-of-record provider, payment processor,
subscription lifecycle provider, customer portal provider, and payment-event
source.

Release Signal remains responsible for:

- Auth0 identity;
- internal user and organisation mapping;
- application access;
- provider-to-internal plan mapping;
- server-owned credit authority;
- the credit and billing ledger;
- account state used by the application;
- commercial owner visibility; and
- AI budget protection.

The Lemon Squeezy dashboard is operational evidence, not sufficient application
authority. Provider data becomes application truth only after a signed allowed
event is verified, mapped, processed idempotently, and persisted into Release
Signal database state.

## 7. Lemon Squeezy test-mode strategy

The staging proof must exercise:

```text
Authenticated staging user
→ Lemon Squeezy test checkout
→ test payment
→ signed test webhook
→ signature verification
→ staging database update
→ test subscription mapping
→ test credit grant
→ user plan and credit display
→ owner test notification
→ cancellation or portal validation
```

Required scenarios:

| Scenario | Required proof |
|---|---|
| Successful payment | One mapped active test subscription and one correct billing-period grant |
| Failed payment | No false activation/grant; safe user state and owner visibility |
| Expired card | Provider failure preserved without application activation |
| Authentication-required payment | Completion only after provider-confirmed success |
| Abandoned checkout | No activation or grant |
| Duplicate checkout | No duplicate active mapping or credit entitlement |
| Duplicate webhook | Same provider event produces one authoritative effect |
| Invalid webhook signature | Rejected before persistence or account mutation |
| Out-of-order event | Ordering policy prevents stale state regression |
| Unknown user mapping | Quarantined/support-required; no guessed account mutation |
| Database failure | Retry-safe, observable, recoverable processing |
| Owner notification failure | Authoritative processing remains successful; notification retries separately |
| Cancellation | Correct end-of-period/immediate policy representation |
| Expiry | Access and grant behaviour follows explicit state policy |
| Renewal | One billing-period-aware grant |
| Plan update | Explicit provider-variant-to-plan mapping; no metadata guess |
| Customer portal return | Return triggers a refresh/poll only; does not mutate authority |
| Test/live mismatch | Fail closed before cross-environment mutation |

No test implementation belongs in PR #75.

## 8. Lemon Squeezy store approval readiness

Before submission:

- [ ] Merchant identity is accurate and consistent.
- [ ] Individual versus legal-entity setup is selected truthfully.
- [ ] Identity verification is complete or ready.
- [ ] Payout destination is verified.
- [ ] Required tax information is complete.
- [ ] The product is eligible under provider policies.
- [ ] SaaS digital fulfilment is explained accurately.
- [ ] The public website is complete and accessible.
- [ ] Pricing, currency, billing interval, included allowance, and recurring
      nature are clear.
- [ ] A monitored support contact is public.
- [ ] Terms, Privacy, Trial Terms, Subscription and Billing Terms, and Refund
      and Cancellation information are coherent.
- [ ] Reviewers can access a working product through a dedicated test account.
- [ ] Cancellation behaviour is explained and testable.
- [ ] Refund wording matches actual policy.
- [ ] Recurring billing disclosure appears before purchase.
- [ ] Seller identity is consistent across website, provider, legal, payout, and
      support surfaces.
- [ ] Product description and fulfilment claims are consistent.
- [ ] Support information is consistent and monitored.
- [ ] Placeholder, draft, and unfinished commercial copy is removed.

Recommended public product description:

> Release Signal is a structured QA intelligence and release-readiness
> workspace. It helps product and QA teams refine requirements, design and
> review structured test suites, improve coverage, record execution evidence,
> and produce deterministic release-readiness signals. Release Signal supports
> human release decisions; it does not guarantee complete test coverage,
> defect-free software, or a safe release.

## 9. Approval evidence pack

Prepare a dated, access-controlled evidence index containing:

- [ ] Homepage and public product description.
- [ ] Current product and workflow screenshots with no secrets or customer data.
- [ ] Pricing page and recurring-billing disclosure.
- [ ] Terms of Service.
- [ ] Privacy Policy.
- [ ] Trial Terms.
- [ ] Refund and Cancellation Policy.
- [ ] Contact and monitored support route.
- [ ] Auth0 login flow.
- [ ] Working dedicated trial/reviewer account.
- [ ] Digital fulfilment explanation.
- [ ] Subscription, billing period, AI allowance, and credit explanation.
- [ ] Cancellation and portal flow.
- [ ] Test-mode checkout evidence.
- [ ] Signature verification, idempotency, mapping, and webhook-processing
      evidence.
- [ ] Payout, tax, merchant identity, and verification readiness.

Do not create, copy, or store personal identity, tax, payout, or bank documents
in the repository. Record only that the provider-side evidence was verified by
the authorised human.

## 10. Rejection and reapplication strategy

```text
Application submitted
→ approved, pending, or declined
→ exact provider response recorded
→ findings classified
→ remediation planned
→ corrections implemented
→ evidence collected
→ resubmission decision
```

An unchanged application must not be repeatedly resubmitted. Preserve the exact
provider response in an access-appropriate operations record, remove sensitive
data from any repository summary, and map every finding to evidence and an
owner.

Finding classifications:

- identity;
- payout;
- tax;
- product eligibility;
- website;
- legal;
- pricing;
- fulfilment;
- support;
- technical integration;
- security;
- unsupported-risk category; and
- insufficient information.

Remediation record template:

| Finding | Source | Classification | Risk | Required correction | Implementation owner | Evidence | Validation | Status | Resubmission decision |
|---|---|---|---|---|---|---|---|---|---|
| _Exact, non-sensitive summary_ | _Provider response/date_ | _Classification_ | _Impact_ | _Bounded action_ | _Named owner_ | _Evidence link/reference_ | _Check and result_ | Open / fixed / accepted | Resubmit / ask provider / do not resubmit |

A resubmission requires a documented material correction or new evidence,
verification that public/provider information is consistent, and Stefan's
approval.

## 11. Identity and access model

```text
Trial user
→ full normal workspace within trial and credit limits
→ own trial status
→ own account status
→ own available credits

Paid user
→ full normal workspace within subscription and credit limits
→ own subscription state
→ own account status
→ own available credits

Admin
→ operational metrics, telemetry, diagnostics, and app health

Owner
→ operational access plus commercial subscriptions, payment state,
webhook health, credit liability, and AI reserve
```

Owner access must use a server-verified Auth0 owner claim. UI checks alone are
insufficient. `OrgMember.role = "admin"` is an organisation role and must not
automatically grant commercial owner access. The existing Auth0 admin claim
must not silently imply owner authority. Owner routes must fail closed when the
claim is missing, expired, malformed, or unverifiable.

Trial and paid users may receive only their own account information from a
server-authorised endpoint such as `/api/me`; organisation or user identifiers
from the browser must not expand access. Full administrative mutation controls
remain deferred.

## 12. Checkout architecture

```text
Auth0 establishes identity
→ Release Signal server creates checkout
→ internal user or organisation reference is attached
→ Lemon Squeezy processes payment
→ user returns to Release Signal
→ application waits for verified webhook-backed database state
```

- A success URL must not activate a paid plan.
- Frontend state must not activate a paid plan.
- Email confirmation must not activate a paid plan.
- Checkout metadata must not be trusted without verified provider processing.
- Account mapping must be server-controlled.
- Checkout creation must use authenticated server-owned user/organisation
  context and an allowlisted internal plan-to-provider-variant mapping.
- Return handling may refresh or poll server state but may not write paid state.

Expected return states:

| State | User meaning |
|---|---|
| `processing` | Checkout returned; authoritative provider event is not yet applied |
| `active` | Verified provider state is mapped and active in the database |
| `failed` | Payment/provider state did not produce activation |
| `mapping error` | Payment evidence exists but cannot safely map to an account |
| `support required` | Automated resolution stopped safely and human help is required |

These states are planned, not implemented by PR #75.

## 13. Webhook architecture

Every future webhook implementation requires:

- signature verification over the exact raw request body;
- an explicit event allowlist;
- persisted provider event ID and provider mode;
- event-level idempotency;
- duplicate-delivery handling;
- concurrent-delivery safety;
- event persistence and processing state;
- deterministic account mapping;
- out-of-order and stale-event handling;
- retry safety;
- atomic writes or a recoverable transaction/state machine;
- structured, secret-safe logs;
- an operational processing kill switch;
- strict test/live separation; and
- failure alerting.

Authority flow:

```text
Signed provider event
→ signature verified
→ duplicate and ordering checks
→ Release Signal account mapping
→ database update
→ credit and ledger processing where applicable
→ processing marked successful
→ owner notification
```

Owner notification occurs only after authoritative state processing. A failed
notification must not roll back or repeat a successful subscription or credit
transaction. An invalid, unsupported, mismatched, or unmappable event must fail
closed and must never guess an account.

## 14. Subscription source-of-truth model

```text
verified Lemon Squeezy event
plus
Release Signal database subscription state
equals
application subscription truth
```

Persisted mappings must relate provider customer, order, subscription, product,
variant, and billing-period identifiers to the Release Signal user,
organisation, internal plan code, subscription record, and billing period.
Email alone is not a stable account key. Mapping is created or confirmed from
authenticated server checkout context and verified provider data.

Expected lifecycle policy:

| State | High-level application behaviour |
|---|---|
| `trialing` | Normal workspace within trial end and credit limits |
| `active` | Normal workspace within paid period and credit limits |
| `past due` | Follow the approved grace/access policy; do not grant unverified renewal credits |
| `paused` | Follow an explicit pause/access policy; no implicit renewal grant |
| `cancelled but active until period end` | Preserve access and remaining credits according to approved period policy; show cancellation |
| `expired` | Block paid entitlement according to deterministic access rules; preserve history |
| `refunded` where applicable | Apply an explicit reviewed refund/access/credit policy; never delete billing history |

The exact provider status mapping, transition precedence, and time semantics
must be documented and tested in the implementing PR.

## 15. Credit granting and ledger model

- Trial and paid users see only their own credits.
- `CreditWallet.balance` remains the current server-owned operational balance
  authority unless a separately approved migration changes it.
- `/api/me` or an equivalent server endpoint remains the user-facing source.
- Paid credits are granted only from verified, mapped subscription events.
- Every grant requires a deterministic idempotency key.
- Every grant requires a ledger entry.
- Wallet and ledger effects must be transactional or recoverable.
- Duplicate events must not duplicate grants.
- Renewal grants must be keyed to subscription and billing period, not merely
  delivery event ID.
- Cancellation must not erase historical ledger entries.
- Expiry and exhaustion behaviour must be explicit and deterministic.
- Grants and access must protect the OpenAI provider budget.
- Existing users, subscriptions, wallets, credits, and ledger history must not
  be silently reset, backfilled, or migrated.

Recommended grant idempotency domain:

```text
provider mode + provider subscription ID + billing-period identity + grant type
```

The provider event ID remains separately unique for event processing. This
prevents a second event for the same renewal period from creating a second
period grant.

### Unresolved commercial values

These values require explicit product decisions; this plan does not invent
them:

- paid plan price and currency;
- billing interval;
- included AI allowance;
- credits per billing period;
- rollover versus expiration;
- credit expiration timing;
- grace period;
- past-due access behaviour;
- cancellation-period credit behaviour; and
- refund impact on access and credits.

## 16. AI reserve model

The owner needs an operational forecast:

```text
active paid subscribers
× AI allowance per subscriber
= expected AI reserve
```

Recommended initial buffer:

```text
expected AI reserve × 1.25
```

This is an operational estimate, not an accounting guarantee. It must be
labelled with its measurement time, currency/unit assumptions, and known model
cost uncertainty.

Required inputs:

- active paid subscribers;
- credits granted;
- credits consumed;
- remaining credit liability;
- expected renewal volume;
- provider budget; and
- reserve threshold.

The calculation must use structured database/provider-budget inputs and
deterministic arithmetic, not free-form AI output.

## 17. Owner notifications

Initial notification events:

- subscription activated;
- renewal succeeded;
- payment failed;
- subscription cancelled;
- subscription expired;
- webhook processing failed; and
- AI reserve threshold warning.

Minimum content, where applicable and safe:

- user email;
- internal user or organisation ID;
- internal plan;
- subscription status;
- provider event ID;
- credits granted or blocked;
- active subscriber count;
- expected AI reserve; and
- recommended reserve buffer.

```text
Notifications are visibility, not authority.
```

Notification payloads must minimize personal and provider data, contain no
secrets, and link to server-authorised evidence where useful. Resend, Postmark,
SendGrid, and Amazon SES are candidates only. Provider selection remains
deferred.

## 18. Read-only owner commercial overview

The initial owner view may show:

- active subscribers;
- trial users;
- past-due subscriptions;
- cancelled subscriptions;
- expired subscriptions;
- failed payments;
- webhook-processing status;
- credits granted;
- credits consumed;
- remaining credit liability;
- expected AI reserve; and
- recommended reserve buffer.

It explicitly excludes:

- manual plan changes;
- manual subscription changes;
- manual credit grants;
- manual payment-state changes;
- user deletion;
- role editing;
- trial extension controls; and
- webhook replay controls unless separately approved.

All values come from server-authorised structured state. The overview is
read-only and cannot become an indirect mutation surface.

## 19. Customer portal strategy

Use the Lemon Squeezy customer portal initially for billing-information updates,
subscription management, cancellation, invoice access where provided, and
return to Release Signal.

Portal redirects do not change authoritative Release Signal state.
Subscription changes must arrive through verified provider events. The return
route may request a server-state refresh and show `processing` while an event is
pending.

Release Signal should not build a full custom billing portal for the first paid
beta unless a concrete provider limitation creates an explicitly approved
requirement.

## 20. Auth0 branding and commercial authority cleanup

A later scoped PR must:

- remove visible development-tenant wording;
- verify production application name, logo, and branding;
- review enabled identity providers;
- verify callback URLs, logout URLs, and allowed origins;
- separate staging and production clients/tenants;
- preserve current deterministic provisioning;
- preserve claim-based authority;
- introduce or confirm a dedicated owner claim; and
- prevent admin-to-owner privilege leakage.

No Auth0 configuration or runtime change belongs in PR #75. The owner claim
namespace/value, assignment process, and emergency revocation procedure must be
approved before owner routes are implemented.

## 21. Legal and commercial pages

Future public alignment must cover:

- Terms of Service;
- Privacy Policy;
- Trial Terms;
- Subscription and Billing Terms;
- Refund and Cancellation Policy;
- Contact and Support;
- Acceptable Use;
- AI-credit limits;
- recurring billing;
- cancellation timing;
- digital fulfilment;
- account suspension;
- third-party processors;
- data handling; and
- human release authority.

No public page should imply live payment exists before it is activated. Public
copy, checkout disclosure, provider product copy, receipts, support information,
and legal identity must agree.

Release Signal:

- supports release decisions;
- does not guarantee complete test coverage;
- does not guarantee a safe or defect-free release; and
- does not replace human QA or release authority.

Legal content requires appropriate human/legal review. This architecture plan is
not legal advice.

## 22. Beta user intake and support

```text
Access request
→ manual review
→ invitation
→ account provisioning
→ onboarding instructions
→ support contact
→ structured feedback
```

- Invite only users whose QA/release-readiness use case fits the controlled
  beta, who accept applicable terms, and whose support/data-risk needs are
  within current capacity.
- Capture requests through the approved monitored contact channel with name,
  work email, organisation/use case, expected workflow, and acknowledgement of
  beta limitations. Do not request secrets or sensitive customer data.
- Communicate acceptance manually with access scope, trial terms, onboarding,
  support route, known limitations, and expected feedback.
- Support reports should include account email, time and timezone, route/action,
  expected result, actual result, safe reproduction steps, request/event ID
  where displayed, and redacted screenshot. They must exclude credentials,
  payment-card data, secrets, and unnecessary customer content.
- Trial extension requests go to the support channel for manual review; no
  extension control or automatic entitlement is implied.
- Upgrade requests are recorded and answered manually until verified paid
  activation exists.
- Commercial incidents involving payment, access, credit, data, security, or
  provider failure escalate immediately to the owner with relevant
  non-sensitive IDs and impact.

A full support portal is out of scope.

## 23. Launch gates

Every gate receives one recorded outcome:

```text
GO
GO WITH ACCEPTED LIMITATIONS
NO-GO
```

Stefan remains final launch authority.

### Controlled external beta invitation

- [ ] Production deployment is healthy.
- [ ] Auth0 login/logout and callback work.
- [ ] Normal-user trial provisioning is correct.
- [ ] The user sees only their own credits and account state.
- [ ] Guided onboarding works.
- [ ] A monitored support path is available.
- [ ] Trust links are reachable and current for the beta.
- [ ] The normal workspace workflow completes.
- [ ] Known limitations are documented and communicated.

### Lemon Squeezy activation submission

- [ ] Merchant identity and seller presentation are consistent.
- [ ] Payout and tax readiness are confirmed outside the repository.
- [ ] Public website and product description are complete.
- [ ] Pricing and recurring billing are clear.
- [ ] Legal pages are reviewed and consistent.
- [ ] Digital fulfilment and cancellation are explained.
- [ ] Support contact is monitored.
- [ ] Reviewer/test account works.
- [ ] Test-mode checkout and webhook evidence is complete.
- [ ] No placeholder or unfinished commercial copy remains.

### Live payment enablement

- [ ] Lemon Squeezy approval is received.
- [ ] Live credentials and IDs are separated from test configuration.
- [ ] Live product and variants are configured.
- [ ] Production webhook and secret are configured.
- [ ] Event and period-grant idempotency are validated.
- [ ] Account mapping is validated.
- [ ] Subscription update and credit grant are validated.
- [ ] Owner notification is validated.
- [ ] Customer portal and return are validated.
- [ ] Checkout and webhook kill switches and rollback are available.

### Commercial beta launch

- [ ] A controlled live payment succeeded.
- [ ] Renewal handling is proven.
- [ ] Failed-payment handling is proven.
- [ ] Cancellation and expiry are proven.
- [ ] Users see their own correct plan and credits.
- [ ] Owner commercial visibility is correct and read-only.
- [ ] Support path and escalation are staffed.
- [ ] Legal and trust links are current.
- [ ] Production monitoring and provider budgets are active.
- [ ] Known limitations and accepted risks are documented.

## 24. Failure, rollback, and disable strategy

Future implementation PRs must provide:

- a server-controlled checkout disable switch;
- a webhook-processing disable/containment switch with documented semantics;
- safe rejection of invalid, unsupported, or environment-mismatched events;
- event and billing-period idempotency preventing duplicate credit grants;
- recoverable partial-failure states;
- rollback without deletion or rewriting of ledger/event history;
- production secret rotation;
- defined provider-outage behaviour;
- defined Auth0-outage behaviour;
- defined database-outage behaviour;
- owner escalation; and
- a manual reconciliation runbook.

The checkout switch should stop new checkout creation without corrupting
existing subscriptions. Webhook containment must not acknowledge unprocessed
events as successful unless their durable retry state is safely recorded.
Database or mapping failure must preserve the event for retry/reconciliation.
Provider or notification outages must not cause guessed state.

Manual reconciliation must compare provider event history, persisted webhook
records, subscription mappings, billing periods, wallet effects, and ledger
entries. Corrections require reviewed, idempotent, auditable operations; history
must not be erased.

## 25. Deferred scope

Explicitly deferred:

- full admin management panel;
- manual subscription mutation;
- manual payment-state mutation;
- manual credit controls;
- user deletion tools;
- support-ticket platform;
- advanced revenue analytics;
- Jira integration;
- Release Signal v2;
- demo workspace;
- workspace redesign;
- renewed frontend modularisation;
- GitHub Actions; and
- CI introduction.

## 26. Dependency-ordered roadmap

The approved sequence is retained because each PR establishes evidence or
authority required by the next:

```text
PR #75 — Commercial Beta Launch Readiness Plan

PR #76 — Environment and Deployment Safety

PR #77 — Lemon Squeezy Store Approval Readiness

PR #78 — Auth0 Branding and Commercial Authority Cleanup

PR #79 — Legal, Pricing and Support Readiness

PR #80 — Lemon Squeezy Test-Mode Checkout Foundation

PR #81 — Verified Webhook and Event Foundation

PR #82 — Subscription State and Credit Granting

PR #83 — Customer Portal and Subscription Management

PR #84 — Owner Notifications and Read-only Commercial Overview

PR #85 — Lemon Squeezy Activation Submission

PR #86 — Live Configuration and Controlled Real Payment

PR #87 — Commercial Beta Launch Gate
```

### PR #76 — Environment and Deployment Safety

- **Goal:** Establish and document safe production, staging, and preview
  separation before any payment integration.
- **Dependencies:** PR #75.
- **Allowed scope:** Environment inventories, deployment checks, secret scopes,
  safe configuration documentation, and explicitly approved guardrails.
- **Out of scope:** Checkout, webhooks, subscription/credit changes, commercial
  UI, migrations, and production data mutation.
- **Source of truth:** Vercel/provider environment configuration plus reviewed
  deployment documentation; no client-supplied environment claim.
- **Authority boundary:** Only authorised operators configure secrets;
  application code cannot promote preview/staging state.
- **Idempotency:** Repeated validation must be read-only; configuration changes
  must be repeatable without duplicating resources.
- **Failure handling:** Fail closed when required environment separation or a
  secret is missing.
- **Rollback:** Restore prior reviewed configuration and rotate affected
  credentials; do not copy production secrets into lower environments.
- **Validation:** Environment matrix review, secret-exposure scan, deployment
  health checks, required application validation for any code touched.
- **Claude review:** Required for environment isolation, secret scope, and
  production-release risk.
- **Definition of done:** Staging cannot mutate production, previews are bounded,
  `master` release semantics are documented, and no unresolved secret boundary
  blocks integration.

### PR #77 — Lemon Squeezy Store Approval Readiness

- **Goal:** Prepare the provider application, product/fulfilment description,
  merchant checklist, evidence index, and rejection workflow.
- **Dependencies:** PR #76.
- **Allowed scope:** Approval documentation, provider-side preparation, evidence
  checklist, and non-sensitive operational records.
- **Out of scope:** Runtime checkout/webhooks, live credentials, public payment
  claims, and repository storage of identity/payout/tax documents.
- **Source of truth:** Exact provider requirements and authorised human
  verification of merchant, payout, tax, and identity status.
- **Authority boundary:** Provider and Stefan decide approval/submission;
  repository text cannot assert provider approval.
- **Idempotency:** One versioned application record per submission; unchanged
  applications are not repeatedly submitted.
- **Failure handling:** Classify exact findings and stop pending remediation.
- **Rollback:** Withdraw/correct inaccurate material and preserve the review
  trail without sensitive evidence.
- **Validation:** Approval checklist and evidence-pack review against current
  provider requirements.
- **Claude review:** Required for completeness, claims, rejection remediation,
  and unsupported-risk gaps.
- **Definition of done:** A truthful, consistent application can be submitted
  with all required non-runtime evidence and Stefan's approval.

### PR #78 — Auth0 Branding and Commercial Authority Cleanup

- **Goal:** Establish production/staging Auth0 branding and a server-verifiable
  owner authority distinct from operational admin.
- **Dependencies:** PR #76; PR #75 access decision.
- **Allowed scope:** Explicitly approved Auth0 configuration, claim validation,
  and minimal authority/branding code needed by the ticket.
- **Out of scope:** Replacing Auth0, changing normal provisioning, granting owner
  through `OrgMember.role`, billing implementation, or broad login redesign.
- **Source of truth:** Verified Auth0 access-token claims read server-side.
- **Authority boundary:** Admin and owner claims are distinct; UI visibility
  never grants authority.
- **Idempotency:** Role/claim assignment and configuration can be reapplied
  without duplicate users or memberships.
- **Failure handling:** Missing/unverifiable owner claim fails closed.
- **Rollback:** Revoke owner claim/route access and restore reviewed Auth0
  application settings without altering user product state.
- **Validation:** Normal/admin/owner negative and positive access matrix,
  callback/logout/origin checks, build, and authentication regression.
- **Claude review:** Required because authentication and authorisation are
  high-risk.
- **Definition of done:** Production branding is correct, environments are
  separate, current provisioning remains intact, and no admin-to-owner leakage
  exists.

### PR #79 — Legal, Pricing and Support Readiness

- **Goal:** Replace placeholder commercial copy with consistent, reviewed
  pricing, recurring billing, legal, fulfilment, support, and beta-intake
  information.
- **Dependencies:** PR #77; approved commercial values and seller identity.
- **Allowed scope:** Public trust/pricing/support pages and supporting
  documentation explicitly named by the PR.
- **Out of scope:** Live payment claims, runtime entitlement changes, checkout,
  webhooks, and unreviewed legal assertions.
- **Source of truth:** Human-approved commercial decisions and legal text;
  server state remains account authority.
- **Authority boundary:** Public copy describes policy but cannot change trial,
  subscription, credit, or access state.
- **Idempotency:** Not applicable to state mutation; repeated page deployment
  must not create account effects.
- **Failure handling:** Do not publish unresolved or contradictory commercial
  claims; retain honest pre-payment wording until approved.
- **Rollback:** Revert public copy to the last accurate reviewed version.
- **Validation:** Link/content review, seller/support consistency, accessibility,
  build for application files, and legal/human approval.
- **Claude review:** Required for authority claims, fulfilment gaps, and
  contradiction review.
- **Definition of done:** Website/provider copy is consistent, monitored support
  exists, values are explicit, and no page implies unavailable payment.

### PR #80 — Lemon Squeezy Test-Mode Checkout Foundation

- **Goal:** Create authenticated, server-controlled test checkout in isolated
  staging with safe return states.
- **Dependencies:** PRs #76, #78, and #79; test product/variant decisions.
- **Allowed scope:** Minimal test-mode provider client, server checkout endpoint,
  allowlisted plan mapping, safe return handling, and tests.
- **Out of scope:** Live mode, webhook-authoritative activation, paid credit
  grants, customer portal, owner dashboard, or frontend redesign.
- **Source of truth:** Auth0 server identity and allowlisted server
  configuration; checkout completion is not subscription truth.
- **Authority boundary:** Browser selects only an allowed offer; server controls
  user/organisation mapping and provider variant.
- **Idempotency:** Checkout request key prevents accidental duplicate creation
  where provider support allows; duplicate checkout cannot activate twice.
- **Failure handling:** Fail closed on auth, mapping, environment, provider, or
  configuration error and show non-authoritative safe states.
- **Rollback:** Disable checkout creation and remove test exposure without
  changing account state.
- **Validation:** Auth, mapping, duplicate, abandonment, provider-failure,
  test/live mismatch, build, and staging tests.
- **Claude review:** Required for identity metadata, provider boundary, and
  failure safety.
- **Definition of done:** An authenticated staging user can enter test checkout
  and return without any return path activating a subscription.

### PR #81 — Verified Webhook and Event Foundation

- **Goal:** Persist and process signed allowlisted test events safely and
  idempotently.
- **Dependencies:** PRs #76 and #80; approved event/status mapping.
- **Allowed scope:** Webhook route, raw-body signature verification, event
  persistence, processing states, mapping, idempotency, ordering, logs, kill
  switch, alerts, and tests.
- **Out of scope:** Live credentials, final credit grants, owner UI, manual
  replay control, and broad subscription redesign.
- **Source of truth:** Verified provider event plus persisted Release Signal
  event/mapping state.
- **Authority boundary:** Unsigned, invalid, unsupported, stale, cross-mode, or
  unmappable events cannot mutate account truth.
- **Idempotency:** Provider event ID is unique per provider/mode; concurrency and
  retry tests prove one processing effect.
- **Failure handling:** Durable failed/pending state, safe provider response
  policy, secret-safe diagnostics, alerting, and recoverable retry.
- **Rollback:** Disable processing while retaining immutable event evidence;
  rollback code without deleting event history.
- **Validation:** Signature, duplicate, concurrency, ordering, stale, unknown
  mapping, DB failure, retry, mode mismatch, build, and staging tests.
- **Claude review:** Mandatory high-risk webhook/authority review.
- **Definition of done:** Allowed signed test events are durably processed once,
  invalid events fail closed, and recovery evidence is complete.

### PR #82 — Subscription State and Credit Granting

- **Goal:** Map verified test events into deterministic subscription lifecycle
  state and ledger-backed, billing-period-aware credits.
- **Dependencies:** PR #81; approved price, allowance, rollover/expiry, grace,
  past-due, cancellation, and refund policies.
- **Allowed scope:** Explicit schema/service changes, plan/status mapping, wallet
  and ledger transaction, access integration, `/api/me` extension, tests, and
  migration/rollback artifacts approved for the PR.
- **Out of scope:** Manual grants, automatic mutation of existing accounts,
  owner mutation controls, live mode, or UI redesign.
- **Source of truth:** Verified provider event plus Release Signal subscription,
  wallet, and ledger state.
- **Authority boundary:** Server services own lifecycle and grants; frontend,
  email, return URL, and provider dashboard alone cannot activate access.
- **Idempotency:** Unique event processing plus one grant per provider
  subscription/billing period/grant type.
- **Failure handling:** Atomic or recoverable subscription/wallet/ledger writes;
  no partial activation or duplicate liability.
- **Rollback:** Disable new processing; preserve events and ledger; use reviewed
  forward repair rather than deleting history.
- **Validation:** Full lifecycle, duplicate/concurrent/out-of-order events,
  renewal, failure, cancel, expiry, refund policy, mapping, wallet/ledger
  reconciliation, `/api/me`, build, and database migration review.
- **Claude review:** Mandatory high-risk billing, schema, lifecycle, and ledger
  review.
- **Definition of done:** Test subscription state and grants are deterministic,
  auditable, period-idempotent, user-scoped, and budget-safe.

### PR #83 — Customer Portal and Subscription Management

- **Goal:** Add server-authorised access to the Lemon Squeezy test customer
  portal and safe return/refresh behaviour.
- **Dependencies:** PR #82.
- **Allowed scope:** Minimal portal-session/link creation, account mapping,
  return state, user-facing subscription management entry, and tests.
- **Out of scope:** Custom billing portal, direct application mutation,
  provider-dashboard embedding, live mode, or manual cancellation controls.
- **Source of truth:** Verified events and Release Signal database state, not
  portal redirects.
- **Authority boundary:** Server maps the authenticated user to their provider
  customer/subscription; users cannot request another account.
- **Idempotency:** Repeated portal entry/return has no subscription or credit
  side effect.
- **Failure handling:** Fail safely on missing mapping/provider outage; show
  processing/support state without guessed mutation.
- **Rollback:** Disable portal entry while leaving existing subscription truth
  and provider processing intact.
- **Validation:** Cross-account denial, cancellation/update/return, delayed
  webhook, provider failure, build, and staging tests.
- **Claude review:** Required for account isolation and subscription authority.
- **Definition of done:** A staging user can manage only their own test
  subscription and portal returns never mutate app truth.

### PR #84 — Owner Notifications and Read-only Commercial Overview

- **Goal:** Provide post-processing owner visibility, read-only metrics, and AI
  reserve estimates.
- **Dependencies:** PRs #78 and #82; notification-provider decision.
- **Allowed scope:** Server-verified owner routes, read-only queries,
  deterministic reserve calculation, post-commit notification delivery, and
  minimal owner UI/tests.
- **Out of scope:** Admin-to-owner inheritance, manual plan/payment/credit/user
  mutation, trial extension, webhook replay, and advanced analytics.
- **Source of truth:** Authorised structured database state and configured
  provider budget inputs.
- **Authority boundary:** Dedicated server-verified owner claim; notifications
  and UI are visibility only.
- **Idempotency:** Notification delivery key per authoritative event/type;
  retries do not repeat state processing.
- **Failure handling:** Notification failure is recorded and retryable without
  rolling back authoritative state; overview fails closed for non-owners.
- **Rollback:** Disable notifications/owner surface without changing commercial
  records.
- **Validation:** Owner/admin/user access matrix, aggregation accuracy,
  notification duplicate/failure tests, reserve arithmetic, PII/secret review,
  and build.
- **Claude review:** Mandatory for owner authority, data exposure, and
  notification/state separation.
- **Definition of done:** Owner sees accurate read-only commercial health and
  receives idempotent post-processing notifications; no mutation path exists.

### PR #85 — Lemon Squeezy Activation Submission

- **Goal:** Perform the human-approved store submission with a complete evidence
  pack and record the outcome/remediation path.
- **Dependencies:** PRs #77–#84 and all submission gate items.
- **Allowed scope:** Provider submission, non-sensitive status/evidence records,
  reviewer support, and correction planning.
- **Out of scope:** Live checkout exposure, live user activation, speculative
  provider workarounds, or unchanged repeat submission.
- **Source of truth:** Lemon Squeezy's exact response and provider dashboard
  status, recorded by an authorised human.
- **Authority boundary:** Lemon Squeezy decides provider approval; Stefan decides
  whether and when to submit/resubmit.
- **Idempotency:** One traceable submission attempt per materially distinct
  application version.
- **Failure handling:** Classify pending/declined findings, remediate, validate,
  and seek a new resubmission decision.
- **Rollback:** Withdraw or correct inaccurate material; disable any premature
  commercial claims.
- **Validation:** Final gate checklist, evidence review, provider receipt/status,
  and sensitive-data exclusion.
- **Claude review:** Required before submission and for any rejection
  remediation plan.
- **Definition of done:** Application is submitted once with approval, and the
  exact outcome has an owned next step.

### PR #86 — Live Configuration and Controlled Real Payment

- **Goal:** Configure live resources and prove one controlled end-to-end real
  payment without opening general commercial access.
- **Dependencies:** Provider approval from PR #85 and completed live-payment
  enablement gate.
- **Allowed scope:** Live products/variants, production secrets, webhook, bounded
  checkout exposure, one approved payment, portal, notification, monitoring,
  reconciliation, and rollback evidence.
- **Out of scope:** Broad paid launch, public self-service expansion, mutation
  dashboard, or architecture changes.
- **Source of truth:** Verified live provider event plus production Release
  Signal database state.
- **Authority boundary:** Server-owned mapping and processing; only authorised
  operator can enable the bounded live path.
- **Idempotency:** Live event uniqueness and billing-period grant uniqueness are
  proven before and during the controlled payment.
- **Failure handling:** Kill switches, alerts, support state, provider/DB/Auth0
  outage behaviour, and manual reconciliation are active.
- **Rollback:** Disable new checkout and contain processing safely; preserve live
  event, subscription, payment, wallet, and ledger history.
- **Validation:** Controlled payment, user plan/credit, owner notice/overview,
  portal, cancellation as approved, production logs/monitoring, reconciliation,
  and rollback drill.
- **Claude review:** Mandatory high-risk live-payment review before execution and
  after evidence collection.
- **Definition of done:** One controlled live transaction reconciles end to end
  with no cross-environment, duplicate, mapping, authority, or ledger defect.

### PR #87 — Commercial Beta Launch Gate

- **Goal:** Consolidate evidence and decide whether to launch the controlled paid
  beta.
- **Dependencies:** PR #86 plus lifecycle/support/monitoring evidence.
- **Allowed scope:** Launch audit, evidence index, known limitations, operational
  runbook, go/no-go record, and only separately approved blocker fixes.
- **Out of scope:** Feature expansion, workspace redesign, broad admin tooling,
  Jira, v2, renewed modularisation, CI, or hiding unresolved blockers.
- **Source of truth:** Validated production/provider/database evidence and the
  approved readiness gates.
- **Authority boundary:** Reviewers recommend; Stefan is final launch authority.
- **Idempotency:** Re-running the gate is read-only and references the same
  versioned evidence unless a corrective change produces new evidence.
- **Failure handling:** Any authority, payment, mapping, credit, security,
  support, legal, or rollback blocker produces `NO-GO`.
- **Rollback:** Do not launch, or disable checkout and follow the commercial
  incident/reconciliation runbook if a post-launch gate regresses.
- **Validation:** Controlled payment, renewal, failure, cancellation, expiry,
  own-account display, owner visibility, support, legal links, monitoring,
  known limitations, and rollback evidence.
- **Claude review:** Mandatory final architecture/risk review; Claude recommends.
- **Definition of done:** A recorded `GO`, `GO WITH ACCEPTED LIMITATIONS`, or
  `NO-GO` has complete evidence, owners, limitations, and Stefan's decision.

## Current evidence, gaps, and decisions still required

### Repository evidence preserved by this plan

- Current normal trial provisioning uses `trial_v1`, 100 credits, and a 15-day
  trial; this plan does not change it.
- `CreditWallet.balance` is the current operational remaining-credit authority;
  the ledger is the audit/idempotency trail and historical mismatches require
  manual review.
- `/api/me` exposes server/database-owned plan, account, and credit state.
- Auth0 access-token claims currently establish app-admin access.
- Public trust routes exist for Terms, Privacy, Trial Terms, Refund and
  Cancellation, and Contact, but several are explicitly drafts/placeholders.
- Current public messaging already states that Release Signal supports rather
  than replaces human release decisions.

### Existing alignment gaps to resolve in later scoped PRs

1. Public marketing copy advertises a 10-day beta trial, while current server
   provisioning and the trial-credit audit record a 15-day trial. PR #79 must
   align truthful public wording after an explicit duration decision; no current
   account may be silently changed. This is blocking before controlled external
   beta.
2. The public marketing content publishes `contact@releasesignal.io`, while the
   Contact route says a public support/sales address has not been finalised. PR
   #79 must confirm monitoring and make the surfaces consistent. This is
   blocking before controlled external beta.
3. The billing integrity audit says app admins display `Credits: admin`, while
   the current `UserBar` formats `Admin: <stored balance> credits left`. A later
   scoped account/authority review must decide the accurate operational display
   without changing admin bypass, wallet, or ledger truth implicitly. This is a
   commercial-semantics clarification required before paid launch.

### Decisions required before relevant implementation PRs

- Paid price, currency, billing interval, and included AI allowance.
- Credits per billing period, rollover/expiration, grace, past-due,
  cancellation, and refund behaviour.
- Final seller identity and individual/legal-entity setup.
- Final support channel, staffing expectation, and commercial incident
  escalation details.
- Final public legal text and required human/legal approval.
- Dedicated Auth0 owner claim namespace/value and assignment/revocation process.
- Notification provider and owner recipient/channel.
- Provider product/variant mapping and exact lifecycle-event allowlist.
- Checkout and webhook kill-switch ownership and operational mechanism.
- Production AI budget and reserve warning threshold.

None of these open values overrides the approved Phase 0 decisions.

## PR #75 completion boundary

PR #75 creates this document only. It does not implement payment, checkout,
webhooks, subscriptions, credits, Auth0 changes, Prisma changes, owner routes or
dashboards, notifications, email, UI changes, onboarding changes, prompts,
artifact contracts, Review Score, Release Readiness, Jira integration, GitHub
Actions, or CI.

Documentation validation:

```text
git diff --check
docs-only working-tree review
```
