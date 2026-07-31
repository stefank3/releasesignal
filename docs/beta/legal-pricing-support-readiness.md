# Legal, Pricing and Support Readiness

## Document control

| Field | Value |
|---|---|
| Scope | GitHub PR #80 — Legal, Pricing and Support Readiness |
| Roadmap mapping | Roadmap PR #79 = GitHub PR #80 |
| Status | Readiness contract; blocked for public paid launch and provider product creation |
| Protected baseline | `master` at `60b399cf3a2f9dbc1232bf6ca696f93524f11b01` |
| Provider | Lemon Squeezy, planned candidate subject to activation approval |
| Repository audit date | 2026-07-31 |
| Official provider-source verification date | 2026-07-31 |
| Runtime effect | None; documentation only |
| Final commercial and publication authority | Stefan |

This document records current repository behavior, approved baselines, open
decisions, and evidence gates. It is not legal, accounting, tax, or provider
approval advice. It does not make the current public trust pages legally
sufficient and does not authorize paid launch.

## Classification vocabulary

Every material finding uses one of these classifications:

| Classification | Meaning |
|---|---|
| `Repository change required` | A later scoped repository change is needed to make behavior or documentation consistent |
| `Public wording change required` | Current public copy is incomplete, contradictory, or premature |
| `Owner business decision required` | Stefan must approve a commercial or operating choice |
| `Legal/accounting confirmation required` | Qualified advice is needed for legal, tax, registration, reporting, or contractual treatment |
| `Lemon Squeezy confirmation required` | The live account, questionnaire, provider review, or support must confirm an account-specific point |
| `Future runtime implementation` | A later explicitly scoped application change is required |
| `Manual external configuration` | A provider, inbox, payout, tax, or operational setting outside Git is required |
| `No change required` | Current behavior or wording already matches the protected baseline |

## 1. Purpose and current status

Release Signal is a structured QA intelligence and release-readiness workspace.
The protected workflow is:

```text
Requirement
→ Test Design
→ Test Review
→ Review-driven improvement
→ Execution Evidence
→ Release Readiness
```

The protected architecture is:

```text
AI
→ parsed structured artifacts
→ deterministic system logic
→ UI
```

Human QA and release owners remain final decision authorities. Review Score
remains separate from Release Readiness.

PR #80 defines what must be decided, reviewed, configured, implemented, and
proved before Lemon Squeezy products or variants are created. It does not
implement checkout, webhooks, subscriptions, paid credits, cancellation,
customer portal access, owner tooling, or public copy.

Current readiness result:

```text
Controlled invite-only beta: conditionally supportable after the contact inbox
and 10-day/runtime mismatch are handled operationally.

Paid public beta: BLOCKED.

Lemon Squeezy product/variant creation: BLOCKED.
```

## 2. Protected product and commercial baseline

The following decisions are inputs to later work and must not be silently
changed:

- public trial duration is 10 days;
- the initial trial is controlled, limited beta access;
- trial grant is 100 credits;
- current trial plan code is `trial_v1`;
- current trial status is `trialing`;
- current trial seat count is 1;
- users see server-owned plan, status, and credit state for their mapped
  organization;
- credits are a usage allowance, not currency, cash, or stored value;
- AI-backed actions consume credits under the existing token-derived model;
- export, the current execution-evidence upload, and deterministic Release
  Readiness do not consume AI credits;
- the legacy AI chat action for execution-result ingestion currently charges a
  flat credit, so future wording must not describe every execution-related
  operation as credit-free;
- Release Signal supports rather than replaces human QA and release authority;
- Lemon Squeezy is the planned merchant-of-record and subscription provider,
  subject to approval;
- verified provider events plus Release Signal database state will become paid
  subscription authority;
- checkout returns, browser state, receipts, email, portal redirects, and
  provider-dashboard appearance are not entitlement authority; and
- commercial-owner authority remains separate from application-admin authority.

## 3. Repository audit

### 3.1 Current behavior and content

| Finding | Evidence | Classification | Required follow-up |
|---|---|---|---|
| Marketing offers a controlled 10-day beta through email, not checkout. | `app/components/marketing/marketingContent.ts` | `No change required` | Preserve until payment is actually approved and available. |
| New normal organizations receive a 15-day `trial_v1` subscription, 100 credits, and 1 seat. | `lib/billing/ensureOrgForUser.ts` | `Repository change required` | A later trial-provisioning PR must align new accounts to the approved 10-day public baseline. |
| Trial grant and usage authority are organization wallet and ledger records. | `lib/billing/ensureOrgForUser.ts`, `lib/billing/chargeCredits.ts`, `prisma/schema.prisma` | `No change required` | Preserve server/database authority. |
| For a user with multiple memberships, provisioning and charging both resolve the earliest-created `OrgMember`, ordered by `createdAt` ascending and then `id` ascending. | `lib/billing/ensureOrgForUser.ts`, `lib/billing/chargeCredits.ts` | `Future runtime implementation` | Checkout and subscription binding must use the same resolved organization or deliberately replace this rule everywhere through an explicit organization-selection contract. |
| `/api/me` returns database-owned plan, status, period, seats, and wallet balance. | `app/api/me/route.ts` | `No change required` | Preserve as UI input, not client authority. |
| For the resolved organization, access evaluation and `/api/me` select the newest subscription row, ordered by `createdAt` descending. | `lib/billing/accountAccess.ts`, `app/api/me/route.ts` | `Future runtime implementation` | Checkout, webhook, entitlement, and display work must preserve or deliberately replace this rule consistently. |
| The account badge displays trial days and credits, paid Standard when `standard_v1`, and the stored admin balance. | `app/chat/UserBar.tsx` | `No change required` | Any wording change belongs to a later scoped UI PR. |
| AI usage costs `max(1, ceil(totalTokens / 1000))` credits. | `lib/chat/costs.ts`, `lib/server/chat/openaiService.ts` | `No change required` | Measure real beta use before changing allowance. |
| Access is denied for expired/inactive subscriptions, missing wallets, or non-positive balances. | `lib/billing/accountAccess.ts`, `lib/server/chat/requestGuards.ts` | `No change required` | Paid lifecycle mapping remains future work. |
| A generated response can cost more than the pre-call positive balance and then fail during the atomic charge/persist transaction. | `lib/billing/accountAccess.ts`, `lib/billing/chargeCredits.ts` | `Future runtime implementation` | Decide whether to add a per-action ceiling or reservation before paid launch. |
| Newly provisioned Auth0 application admins receive an admin workspace with zero credits and no subscription; billable AI remains blocked at zero. | `lib/billing/ensureOrgForUser.ts`, `lib/server/chat/requestGuards.ts` | `Owner business decision required` | Decide and document the operational admin-funding policy without coupling admin and commercial-owner authority. |
| No Lemon Squeezy dependency, environment contract, checkout, webhook, portal, product, or variant exists. | `package.json`, `.env.example`, repository search | `Future runtime implementation` | Later PRs must add isolated test-mode integration only after their gates close. |
| The Prisma subscription model is generic and current access logic recognizes `trialing` and `active`; all other statuses are inactive for app access. | `prisma/schema.prisma`, `lib/billing/accountAccess.ts` | `Future runtime implementation` | Define and test provider-to-internal status mapping before webhook work. |
| Trust routes exist but the shared shell calls them draft placeholders. | `app/(trust)/TrustPage.tsx` | `Public wording change required` | Replace only after owner decisions and qualified legal review. |
| Contact marketing names `contact@releasesignal.io`, while the Contact page says no public support/sales address is finalized. | `app/components/marketing/marketingContent.ts`, `app/(trust)/contact/page.tsx` | `Public wording change required` | Confirm the inbox is working and monitored, then align all public surfaces. |
| Public pages make no live checkout or payment-availability claim. | landing and trust-page audit | `No change required` | Do not add a checkout CTA before approval and runtime evidence. |
| `npm run build` invokes `prisma migrate deploy`. | `package.json` | `No change required` | Documentation-only validation must not run the build. |

## 4. Current public-page inventory

| Surface | Current statement | Readiness | Classification |
|---|---|---|---|
| Landing page | Controlled beta; 10-day request by email; human-authority and sensitive-data guardrails | Accurate pre-payment positioning | `No change required` |
| Contact | Names Stefan Kajchevski / RSF Labs but says the public channel is unfinished | Contradicts published email and seller route is unresolved | `Public wording change required` |
| Privacy | Describes account, usage, QA artifacts, sensitive-data caution, and makes no compliance certification claim | Useful placeholder; lacks final controller identity, purposes/bases, retention, rights/request process, recipients/transfers, cookies, subprocessors, effective date, and update process | `Legal/accounting confirmation required` |
| Terms | Describes purpose, acceptable use, human responsibility, and no release guarantee | Incomplete commercial terms | `Legal/accounting confirmation required` |
| Trial Terms | Preserves server-owned authority and correctly says `standard_trial_v1` is not assigned | Does not state the approved 10-day public duration, 100-credit allowance, exhaustion, eligibility, start/end rules, or no-payment-details rule | `Public wording change required` |
| Refund / Cancellation | Explicitly says payment, cancellation, and refund policy are not finalized | Honest today but unusable for paid launch | `Owner business decision required` |
| Shared trust shell | Labels every page a draft placeholder requiring human review | Honest today but blocks commercial publication | `Public wording change required` |

## 5. Trial consistency audit

### 5.1 Source comparison

| Source | Current value or behavior | Classification |
|---|---|---|
| Approved public baseline | 10 days | `No change required` |
| Landing CTA, mail subject, and FAQ | 10-day beta trial | `No change required` |
| Runtime provisioning | `TRIAL_DURATION_DAYS = 15` | `Repository change required` |
| Current trial plan | `trial_v1`, `trialing`, 100 credits, 1 seat | `No change required` |
| `docs/v1.2-trial-credit-readiness-audit.md` | Records the observed 15-day runtime and also contains a stale future 7-day proposal | `Repository change required` |
| `docs/ai/PROMPT_TEMPLATES.md` | Presents 15 days as the approved V1 trial direction; this is agent-facing and can influence future implementation | `Repository change required` |
| `docs/ai/V1_ROADMAP_EXECUTION_RULES.md` | Presents 15 days as the expected V1 constant unless superseded; this is agent-facing and can influence future implementation | `Repository change required` |
| `docs/billing-wallet-ledger-integrity-audit.md` | Describes the current 15-day runtime rather than establishing the new public-offer authority | `Repository change required` |
| Existing beta readiness documents | Correctly record the 10-day public/15-day runtime contradiction | `No change required` |
| Trial Terms page | Avoids a duration promise | `Public wording change required` |

### 5.2 Mismatch classification and safe migration rule

- **Public-copy inconsistency:** the landing page truthfully states the approved
  10-day offer, but the Trial Terms page omits it and the Contact page is
  contradictory.
- **Runtime inconsistency:** new accounts receive 15 days, not the advertised
  10 days.
- **Migration/provisioning risk:** changing the constant affects only future
  provisioning if implemented surgically; rewriting subscription rows would
  create a separate data-migration risk.
- **Existing-user impact:** existing trial users already have a persisted
  `currentPeriodEnd`. They must retain that original expiry unless a separate,
  explicitly approved customer policy and migration says otherwise.
- **Future implementation requirement:** change new-account provisioning to
  10 days; update stale public/readiness documentation, agent-facing prompt
  templates, execution rules, tests, and evidence; review descriptive billing
  audits; and leave existing subscriptions untouched. The three additional
  source files inventoried above are not edited by PR #80.

Until that implementation is merged, controlled invitations must disclose the
actual persisted expiry shown to each accepted user. No operator should promise
that changing public wording changes server-owned state.

Payment details are not currently collected for the controlled trial because
the request path is email and there is no payment integration. Whether a future
provider-hosted trial requires payment details is an owner and provider-product
decision, not current behavior.

## 6. Pricing decision matrix

No final price is approved by repository evidence. Do not create a Lemon
Squeezy product or variant from this matrix until every blocking row is closed.

| Pricing input | Confirmed current state | Decision/evidence required | Classification | Gate |
|---|---|---|---|---|
| Trial name | `Standard Trial` / `Release Signal Standard Trial` are approved display labels | Align later public terms without implying `standard_trial_v1` is live | `Public wording change required` | Before public terms update |
| Paid plan name | `Standard` / `Release Signal Standard`; future code `standard_v1` | Confirm final checkout/provider display name | `Owner business decision required` | Before product creation |
| Public trial price | Controlled trial currently has no checkout or charge | Confirm that it remains free and whether payment details are ever required | `Owner business decision required` | Before product creation |
| Paid price | Not approved | Exact numeric price | `Owner business decision required` | Blocker |
| Billing currency | Not approved | Customer-facing product currency and payout/accounting implications | `Owner business decision required` | Blocker |
| Billing interval | Not approved | Monthly, annual, or both | `Owner business decision required` | Blocker |
| Annual discount | Not approved | Whether annual exists and, if so, its price/renewal disclosure | `Owner business decision required` | Blocker |
| Seats | Trial runtime is 1; paid seat allowance is unknown | Included seats, additional-seat policy, and organization ownership | `Owner business decision required` | Blocker |
| Included AI allowance | Trial is 100 credits; paid allowance is unknown | Credits per billing period based on measured usage and reserve | `Owner business decision required` | Blocker |
| Credit exhaustion | Current AI actions are blocked at zero | Approve paid UX, support path, and whether service remains available for deterministic/read-only actions | `Owner business decision required` | Before paid terms/runtime |
| Additional credits | No top-up mechanism | Allow or prohibit top-ups; if allowed, package, price, expiry, refund, and grant authority | `Owner business decision required` | Blocker |
| Reset/expiry/rollover | No paid-period grant exists | Choose reset identity, expiry, rollover cap or no rollover | `Owner business decision required` | Blocker |
| Upgrade/downgrade | Not implemented | Eligible changes, effective time, proration, allowance reconciliation, and no double grants | `Owner business decision required` | Blocker |
| Promotional/beta pricing | Not approved | Eligibility, duration, renewal price, grandfathering, and public disclosure | `Owner business decision required` | Blocker |
| Price changes | Existing provider subscriptions may retain their created price according to current provider docs, but Release Signal policy is absent | Notice period, affected cohorts, acceptance, and provider mechanics | `Owner business decision required` | Before policy publication |
| Tax/VAT display | Lemon Squeezy supports tax-inclusive or tax-exclusive store pricing | Choose store presentation and ensure checkout/public copy match | `Owner business decision required` | Before product creation |
| Local tax treatment | Not determined | North Macedonian advice for payout income, registration, records, and reporting | `Legal/accounting confirmation required` | Before activation |

## 7. AI-credit lifecycle matrix

### 7.1 Current authority and behavior

| Topic | Current repository truth | Classification |
|---|---|---|
| Storage scope | One `CreditWallet` per organization and currency; ledger entries reference that wallet | `No change required` |
| Organization ownership | Credits belong to the organization, not directly to a user. Provisioning and charging currently resolve the same oldest membership by `createdAt` then `id`. | `No change required` |
| User visibility | `/api/me` returns the stored balance for the currently resolved organization | `No change required` |
| Trial grant | 100 credits created with the organization and a `trial_grant` ledger entry | `No change required` |
| Usage calculation | `max(1, ceil(totalTokens / 1000))` after a model response; legacy execution-ingest action charges flat 1 | `No change required` |
| Deduction | Serializable transaction, wallet row lock, idempotent `chat_usage` ledger key, then decrement | `No change required` |
| Insufficient credit | Pre-call denial at balance `<= 0`; transaction can also reject a charge larger than remaining balance | `No change required` |
| Admin wallet | New app-admin workspace starts at zero and billable AI is denied until a valid balance exists | `Owner business decision required` |
| Credit-free actions | Current export, `/api/execution-evidence` upload, evidence display, and deterministic readiness derivation | `No change required` |
| Legacy execution ingest | The legacy AI chat action for execution-result ingestion currently charges a flat credit | `No change required` |
| Cash value | Credits are internal usage units, not cash, currency, or provider wallet value | `No change required` |

The oldest-membership rule is deterministic current behavior, not an approved
long-term multi-organization product policy. `chargeCredits.ts` already warns
that multi-organization support requires an explicit selection contract.
Binding checkout or a subscription to a different organization from the wallet
used for charging would create entitlement and charging divergence.

### 7.2 Paid-credit decisions

| Question | Status | Classification |
|---|---|---|
| Credits per paid billing period | Open | `Owner business decision required` |
| Period identity and deterministic grant key | Proposed as provider mode + provider subscription ID + billing-period identity + grant type | `Future runtime implementation` |
| Reset versus accumulation | Open | `Owner business decision required` |
| Expiration and rollover cap | Open | `Owner business decision required` |
| Top-ups and overage | Open; no mechanism exists | `Owner business decision required` |
| Per-action maximum or pre-authorization | Open | `Owner business decision required` |
| Cancellation-period credit use | Open | `Owner business decision required` |
| Refund/reversal effect on unused and consumed credits | Open | `Owner business decision required` |
| Upgrade/downgrade allowance reconciliation | Open | `Owner business decision required` |
| Multiple users consuming one organization allowance | Current schema implies organization scope; commercial policy unapproved | `Owner business decision required` |
| Checkout-return grant | Prohibited | `No change required` |
| Verified-event grant | Required but not implemented | `Future runtime implementation` |

Hard authority rule:

```text
Credits must not be granted from a checkout return URL or client-provided
payment state.
```

Paid grants must be created only after a signed, allowed, environment-matched
provider event is verified, mapped, processed idempotently, and persisted with
deterministic subscription and ledger writes.

## 8. Subscription lifecycle requirements

The current provider documentation recognizes trial, active, paused, past-due,
unpaid, cancelled, and expired lifecycle states. Release Signal must not copy
provider guidance directly into entitlement behavior without an approved
internal mapping.

For the organization resolved through the current oldest-membership rule,
`evaluateAccountAccess` and `/api/me` select the newest `Subscription` row by
`createdAt` descending. A newly inserted paid row may therefore supersede an
older trial row for current access evaluation and account display. This is
repository behavior, not an approved multiple-subscription policy. Duplicate,
overlapping, stale, test/live, or otherwise conflicting rows require an explicit
future policy. Checkout, webhook processing, entitlement, account display, and
charging must preserve or deliberately replace these resolution rules as one
consistent contract.

| Lifecycle point | Required policy | Current status | Classification |
|---|---|---|---|
| Trial request | Manual acceptance and invitation | Exists as email CTA; operating evidence needed | `Manual external configuration` |
| Trial start | Define whether it starts at account provisioning, first login, or another event | Runtime starts at organization creation | `Owner business decision required` |
| Trial end | 10 days for future public provisioning; retain existing persisted expiries | Runtime is still 15 days | `Future runtime implementation` |
| Trial-to-paid | Define eligible account/subscription mapping and handling of remaining trial credits | Not implemented | `Owner business decision required` |
| Initial activation | Verified provider event creates normalized active state and one idempotent period grant | Not implemented | `Future runtime implementation` |
| Renewal | Verified payment/lifecycle event advances period and grants exactly once | Not implemented | `Future runtime implementation` |
| Failed payment / past due | Decide access, grace, notices, and credit use during retries | Not decided | `Owner business decision required` |
| Unpaid | Decide access and recovery behavior | Not decided | `Owner business decision required` |
| Paused | Decide whether supported and its access/credit effect | Not decided | `Owner business decision required` |
| Cancellation | Decide effective time, end-of-period access, remaining credits, and resume rules | Not decided | `Owner business decision required` |
| Expiry | Deny paid access only from normalized server-owned state | Current generic access denies expired periods; provider mapping absent | `Future runtime implementation` |
| Upgrade/downgrade | Define timing, proration, period identity, allowance delta, and duplicate protection | Not decided | `Owner business decision required` |
| Refund/chargeback | Define access, credit reversal, negative-balance prevention, and support review | Not decided | `Owner business decision required` |
| Customer portal | Use provider-hosted portal initially; signed URL must be account-bound | Planned only | `Future runtime implementation` |
| Price change | Define notices and cohort treatment; do not assume existing subscriptions change | Not decided | `Owner business decision required` |

## 9. Cancellation and refund readiness

The current public Refund / Cancellation page is deliberately a placeholder.
Before paid launch, owner-approved policy and qualified review must answer:

- how a customer requests cancellation and a refund;
- whether cancellation takes effect immediately or at period end;
- whether access and unused credits remain until period end;
- how resumption works;
- what happens after failed payment, unpaid status, or expiry;
- refund eligibility, window, exclusions, partial refunds, and response process;
- how a full or partial refund affects entitlement and credits;
- how chargebacks and provider-initiated refunds are handled;
- whether consumed credits can create a negative balance or instead require
  manual review;
- what records and customer communications are retained; and
- which provider event is authoritative for each transition.

Official Lemon Squeezy documentation currently says sellers set their policy,
while Lemon Squeezy retains discretion to issue refunds within 60 days to
prevent chargebacks. Therefore a public “no refunds under any circumstances”
promise would be unsupported. Lemon Squeezy also documents cancelled
subscriptions as valid until the end of the current billing period, but Release
Signal must explicitly approve and implement its own entitlement and credit
policy.

Classifications:

- policy choices: `Owner business decision required`;
- final terms and consumer-law compatibility: `Legal/accounting confirmation required`;
- account-specific refund, cancellation, portal, and dunning configuration:
  `Lemon Squeezy confirmation required` and `Manual external configuration`;
- event mapping and access/credit effects: `Future runtime implementation`; and
- current placeholder replacement: `Public wording change required`.

### 9.1 Refund and credit-grant abuse risk

A later policy and implementation must prevent or contain this sequence:

```text
trial or paid activation
→ credit grant
→ refund or chargeback
→ new activation
→ another credit grant
```

The unresolved policy must cover unused credits, already-consumed credits,
ledger reversals, negative balances, repeated refund or chargeback behavior,
eligibility for future grants, organization and account linkage, manual review,
and abuse prevention. PR #80 does not choose the policy. This remains an
`Owner business decision required` and `Future runtime implementation` risk.

## 10. Digital-fulfilment contract

Planned authority flow:

```text
Verified Lemon Squeezy event
→ normalized subscription state
→ deterministic Release Signal entitlement
→ deterministic credit ledger grant
→ UI reflects server-owned state
```

The customer will receive, after verified activation:

- authenticated workspace access;
- server-owned plan and status visibility;
- the approved billing-period AI-credit allowance;
- continued access to credit-free functions allowed by the approved account
  policy;
- provider-hosted renewal, billing, and cancellation management; and
- the approved Release Signal support path.

The following must never grant access or credits:

- checkout return URL;
- frontend “success” state;
- email or receipt alone;
- unverified webhook body;
- provider-dashboard appearance alone;
- portal return or redirect;
- client-supplied plan, price, payment, period, or credit fields; or
- an application-admin or commercial-owner claim.

Delayed or failed processing must show a neutral `processing` or
`support required` state derived from server records. It must not guess success.
This entire flow is `Future runtime implementation`.

## 11. Legal-page gap analysis

Final content requires qualified legal review for the chosen seller route and
customer markets. This table is an inventory, not a conclusion about mandatory
wording or legal sufficiency.

| Topic | Current public coverage | Gap before paid publication | Classification |
|---|---|---|---|
| Seller/operator identity | “Stefan Kajchevski / RSF Labs” on Contact | Selected legal seller name, status, contact, and required business details must be consistent | `Legal/accounting confirmation required` |
| Service description | Present and broadly accurate | Align exact paid package, entitlement, and fulfilment | `Public wording change required` |
| AI decision-support disclaimer | Present | Preserve consistently in terms and provider copy | `No change required` |
| Human/customer responsibility | Present | Review final allocation of responsibilities | `Legal/accounting confirmation required` |
| Acceptable use / prohibited misuse | Basic terms exist | Review suspension, enforcement, prohibited content, and remedies | `Legal/accounting confirmation required` |
| Account/authentication responsibility | Not adequately covered | Define credential security, authorized use, account recovery, and organization responsibility | `Legal/accounting confirmation required` |
| Trial limits | Server-authority caveat exists | Add 10-day offer, 100 credits, eligibility, start/end, exhaustion, and transition rules | `Public wording change required` |
| Credit limits | Only server-authority language exists | Define usage-unit nature, calculation disclosure level, exhaustion, expiry/rollover, and no cash value | `Owner business decision required` |
| Recurring subscription/renewal | Not covered | Add price, interval, renewal, taxes, notices, and provider role | `Legal/accounting confirmation required` |
| Cancellation/refunds | Placeholder only | Add approved policy consistent with provider rights | `Legal/accounting confirmation required` |
| Digital fulfilment | Not on public pages | Explain verified-event activation and what customer receives without exposing internals unnecessarily | `Public wording change required` |
| Availability | No uptime or SLA claim | Define conservative beta availability, maintenance, suspension, and dependency limitations | `Owner business decision required` |
| Data handling/privacy | High-level placeholder | Finalize identity, purposes/bases, retention, requests, recipients, subprocessors, transfers, security, cookies, updates, and effective date as applicable | `Legal/accounting confirmation required` |
| Third-party services | Not covered | Identify relevant providers and accurately allocate responsibilities | `Legal/accounting confirmation required` |
| Intellectual property | Not covered | Define product, customer-content, feedback, and permitted-use terms | `Legal/accounting confirmation required` |
| Warranty/liability | Only no-release-guarantee wording | Qualified review of disclaimers and limitations | `Legal/accounting confirmation required` |
| Support contact | Contradictory | Verify monitored address and align all surfaces | `Manual external configuration` |
| Security reporting | Not defined | Approve a monitored reporting path and safe submission instructions | `Owner business decision required` |
| Governing law/disputes | Not covered | Select only with qualified advice for seller route and markets | `Legal/accounting confirmation required` |
| Effective date/updates | Not covered | Add version/effective date and change-notice process | `Legal/accounting confirmation required` |

No placeholder notice may be removed until the replacement is human-approved
and every factual commercial value it contains is settled.

## 12. Seller-identity decision paths

The repository does not establish whether Stefan must sell as an individual or
through a registered legal entity. Both routes remain open.

### 12.1 Individual seller path

| Evidence area | Required private evidence or confirmation | Classification |
|---|---|---|
| Lemon Squeezy activation | Live questionnaire accepts the individual route; KYC and product review complete | `Lemon Squeezy confirmation required` |
| Identity | Provider-accepted legal identity and government ID | `Manual external configuration` |
| Payout | Owned bank or verified PayPal method with matching identity | `Lemon Squeezy confirmation required` |
| Tax | Provider-requested non-US tax information | `Manual external configuration` |
| Public identification | Approved individual seller/operator wording and required contact/business details | `Legal/accounting confirmation required` |
| Receipts/invoices | Provider presentation and any seller information are accurate | `Lemon Squeezy confirmation required` |
| Local obligations | North Macedonian registration, tax, reporting, consumer, and records duties | `Legal/accounting confirmation required` |
| Support | Public channel identifies the operator as legally advised | `Owner business decision required` |

### 12.2 Registered legal entity seller path

| Evidence area | Required private evidence or confirmation | Classification |
|---|---|---|
| Lemon Squeezy activation | Live questionnaire accepts the entity; KYB, beneficial-owner, representative, and product review complete | `Lemon Squeezy confirmation required` |
| Entity identity | Exact registered name, registration, address, beneficial owner, and authorized representative | `Manual external configuration` |
| Payout | Account owned by the entity with consistent details | `Lemon Squeezy confirmation required` |
| Tax | Provider-requested entity tax information | `Manual external configuration` |
| Public identification | Exact entity seller/operator wording and required business details | `Legal/accounting confirmation required` |
| Receipts/invoices | Provider and local record presentation are accurate | `Legal/accounting confirmation required` |
| Local obligations | Formation, registration, tax, accounting, reporting, and record duties | `Legal/accounting confirmation required` |
| Support | Public channel identifies the entity and operator consistently | `Owner business decision required` |

North Macedonia is listed in Lemon Squeezy's current official bank-payout
country list. That listing is not a guarantee that a specific seller, account,
payout method, tax setup, or product will be approved.

Seller-route decision:

```text
Lemon Squeezy account-specific confirmation
+ North Macedonia accounting/legal advice
+ Stefan's explicit owner decision
= selected seller route
```

Government IDs, tax numbers, personal addresses, bank/PayPal details,
registration certificates, beneficial-owner records, signatures, and sensitive
provider screenshots must remain outside Git. Repository evidence may record
only owner, date, pass/block status, confirmation source, and a redacted private
evidence reference.

## 13. Support operating model

### 13.1 Minimum controlled-beta contract

```text
Published support address
→ monitored inbox
→ acknowledgement without a guaranteed time
→ issue classification
→ safe evidence collection
→ owner/provider escalation
→ resolution or status update
```

Proposed conservative contract, subject to owner approval:

- use one functioning public address across landing, legal, provider, receipt,
  and onboarding surfaces;
- state that support is limited beta support and avoid 24/7, SLA, uptime, or
  guaranteed-resolution promises;
- accept account/access, technical, billing/payment, credit, cancellation,
  refund, privacy/deletion, and security reports through that address until a
  separate secure channel is approved;
- acknowledge in the language the team can reliably support; no multilingual
  promise is approved;
- request account email, time and timezone, affected route/action, expected and
  actual result, safe reproduction steps, and non-sensitive request/event IDs;
- prohibit passwords, secrets, card data, identity documents, private keys, and
  unnecessary customer content in support submissions;
- escalate payment, subscription, refund, and chargeback mechanics to Lemon
  Squeezy while Release Signal owns application access, mapping, credits, and
  product support;
- treat OpenAI incidents as an upstream dependency issue while Release Signal
  remains responsible for customer communication, safe degradation, credit
  correctness, and its own support response;
- publish cancellation/refund instructions only after policy and portal flow are
  approved; and
- maintain a backup owner and a private incident record for commercial,
  security, privacy, provider, and access failures.

### 13.2 Open operating decisions

| Decision | Classification |
|---|---|
| Confirm `contact@releasesignal.io` exists, receives mail, and is monitored | `Manual external configuration` |
| Name primary and backup inbox owners | `Owner business decision required` |
| Define honest response expectation without a guaranteed SLA | `Owner business decision required` |
| Confirm supported response language | `Owner business decision required` |
| Select a security-reporting route after qualified review of intake and disclosure needs | `Legal/accounting confirmation required`; owner approval required after confirmation |
| Select privacy/deletion intake and identity-verification processes after qualified review | `Legal/accounting confirmation required`; owner approval required after confirmation |
| Define provider outage and commercial incident customer-update process | `Owner business decision required` |
| Define refund/cancellation intake and authority | `Owner business decision required` |

No support portal is required for the initial commercial beta.

## 14. Public-copy alignment requirements

| Topic | Current state | Required future wording | Classification |
|---|---|---|---|
| Trial duration | Landing says 10 days; runtime says 15 | Keep public offer at 10 days and change future provisioning, not existing records | `Repository change required` |
| Beta availability | Controlled, first-come request by email | Preserve until owner deliberately opens access | `No change required` |
| Pricing | No public price | Do not show price until approved and configured consistently | `Owner business decision required` |
| Payment availability | No checkout claim | Keep explicit pre-payment state; no checkout CTA before approval | `No change required` |
| Subscription | Trust pages say behavior is undefined | Publish price, interval, recurring renewal, lifecycle, and provider role only after approval | `Public wording change required` |
| AI credits | Landing does not explain the allowance | Explain usage allowance, included amount, exhaustion, expiry/rollover, and credit-free actions | `Public wording change required` |
| Cancellation/refund | Placeholder | Publish approved request path, timing, access, refund, and provider boundaries | `Public wording change required` |
| Contact/support | Published email conflicts with Contact page | Use one verified monitored channel | `Public wording change required` |
| Seller identity | Stefan / RSF Labs wording exists, route unresolved | Align website, provider, policy, payout, receipts, and support after route selection | `Legal/accounting confirmation required` |
| Product positioning | AI-assisted structured workflow; human decision remains final | Preserve consistently | `No change required` |

Public copy must never imply that a paid subscription, checkout, instant
activation, top-up, portal, or refund automation exists before it is implemented
and proved.

## 15. External evidence requirements

Official Lemon Squeezy sources were re-verified on 2026-07-31:

- [Activate Your Store](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store)
- [Supported Countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)
- [Getting Paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)
- [Tax Forms](https://docs.lemonsqueezy.com/help/tax-forms)
- [Merchant of Record](https://docs.lemonsqueezy.com/help/payments/merchant-of-record)
- [Sales Tax and VAT](https://docs.lemonsqueezy.com/help/payments/sales-tax-vat)
- [Refunds and Chargebacks](https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks)
- [Subscriptions](https://docs.lemonsqueezy.com/help/products/subscriptions)
- [Customer Portal](https://docs.lemonsqueezy.com/help/online-store/customer-portal)
- [Webhooks and signatures](https://docs.lemonsqueezy.com/help/webhooks)

Provider documentation can change. Re-verify immediately before product
creation, activation submission, and live launch.

| External evidence | Owner | Repository record allowed | Classification |
|---|---|---|---|
| Exact activation questionnaire and seller-route fields | Stefan | Field names and redacted pass/block result | `Lemon Squeezy confirmation required` |
| Exact account and product approval | Stefan / Lemon Squeezy | Dated status and redacted provider response | `Lemon Squeezy confirmation required` |
| North Macedonia account/payout acceptance | Stefan / Lemon Squeezy | Method type and pass/block only | `Lemon Squeezy confirmation required` |
| Identity/KYC or KYB completion | Stefan / Lemon Squeezy | Completion status/date only | `Manual external configuration` |
| Tax-form completion | Stefan / accountant/provider | Form completion status/date only; no identifiers | `Manual external configuration` |
| Local seller, payout-income, tax, VAT, registration, reporting, and record obligations | Qualified North Macedonia adviser | Advice received/date/decision; no private evidence | `Legal/accounting confirmation required` |
| Final public terms and privacy review | Qualified reviewer | Approval status, scope, date, limitations | `Legal/accounting confirmation required` |
| Monitored support inbox and backup | Stefan | Address, owner role, test date, pass/block | `Manual external configuration` |
| Provider refund, portal, dunning, tax display, and subscription settings | Stefan | Approved configuration summary without secrets/IDs | `Manual external configuration` |
| Isolated test environment | Stefan | Redacted environment/evidence status | `Manual external configuration` |

## 16. Owner decision register

All rows are open unless a dated human approval is later recorded.

Professional confirmation and final owner approval are separate responsibilities.
Neither this document nor any AI reviewer provides legal approval.

| ID | Decision | Decision owner | Classification | Evidence or confirmation required | Blocking status | Needed before / downstream PR |
|---|---|---|---|---|---|---|
| D-01 | Individual or registered-entity seller route | Stefan | `Owner business decision required` after external confirmation | Lemon Squeezy account-specific confirmation; qualified North Macedonian legal/accounting advice; §12 and §15 | Blocks commercial activation | Provider application |
| D-02 | Exact public seller/operator identity | Stefan | `Legal/accounting confirmation required`; owner approval after confirmation | Selected seller route; qualified legal review; §12 | Blocks public legal publication | Public legal-page PR |
| D-03 | Paid plan name and provider product/variant structure | Stefan | `Owner business decision required` | Provider field review; repository product-label evidence | Blocks Lemon Squeezy product creation | Product creation / checkout PR |
| D-04 | Price, currency, billing interval, and annual option | Stefan | `Owner business decision required` | Commercial approval; provider configuration evidence | Blocks Lemon Squeezy product creation | Product creation / checkout PR |
| D-05 | Paid seats and organization/subscription ownership | Stefan | `Owner business decision required`; `Future runtime implementation` | Oldest-membership rule in §3 and §7; repository/runtime evidence; explicit organization-selection contract | Blocks checkout implementation | Checkout and subscription PRs |
| D-06 | Paid credits per period and reserve threshold | Stefan | `Owner business decision required` | Usage telemetry, reserve model, and provider budget | Blocks Lemon Squeezy product creation | Product creation / paid-credit PR |
| D-07 | Credit reset, expiry, rollover, top-up, and overage | Stefan | `Owner business decision required` | Credit lifecycle analysis in §7 | Blocks paid-credit implementation | Paid-credit and public-terms PRs |
| D-08 | Credit exhaustion and per-action ceiling behavior | Stefan | `Owner business decision required` | Repository/runtime evidence; measured usage | Blocks paid-credit implementation | Paid-credit and UI PRs |
| D-09 | Trial start, trial-to-paid transition, payment details, remaining credits, and subscription selection | Stefan | `Owner business decision required`; `Future runtime implementation` | Newest-subscription rule in §8; existing-user evidence; provider trial configuration | Blocks checkout implementation | Trial provisioning / checkout / subscription PRs |
| D-10 | Past-due, unpaid, paused, grace, and failed-payment access | Stefan | `Owner business decision required` | Provider lifecycle confirmation; access-policy review | Blocks webhook/subscription implementation | Subscription-state PR |
| D-11 | Cancellation effective time, period access, and remaining credits | Stefan | `Owner business decision required` | Provider portal/cancellation confirmation; qualified legal review | Blocks webhook/subscription implementation | Subscription and portal PRs |
| D-12 | Refund eligibility, chargebacks, entitlement, and credit reversal | Stefan | `Owner business decision required`; `Legal/accounting confirmation required` | Provider refund rights; qualified legal review; §9 | Blocks webhook/subscription implementation | Refund/webhook/public-terms PRs |
| D-13 | Upgrade/downgrade, proration, allowance, overlapping rows, and multiple-subscription policy | Stefan | `Owner business decision required`; `Future runtime implementation` | Newest-subscription rule in §8; provider proration behavior; repository/runtime evidence | Blocks webhook/subscription implementation | Subscription-state PR |
| D-14 | Promotional pricing, grandfathering, and price-change notice | Stefan | `Owner business decision required` | Commercial approval; qualified legal review where required | Blocks Lemon Squeezy product creation | Product/public-terms PRs |
| D-15 | Tax-inclusive or tax-exclusive customer presentation | Stefan | `Owner business decision required` after external confirmation | Lemon Squeezy account-specific confirmation; qualified North Macedonian legal/accounting advice | Blocks Lemon Squeezy product creation | Product creation / public terms |
| D-16 | Support address, owner, backup, language, and response expectation | Stefan | `Owner business decision required`; `Manual external configuration` | Monitored-inbox test and operating-owner evidence | Blocks public launch | Controlled beta / activation |
| D-17 | Security issue intake; privacy/deletion intake; privacy-request identity verification | Stefan | Qualified legal confirmation required; owner approval required after confirmation | Qualified legal-text/process review; operational route evidence | Blocks public legal publication | Legal/support publication PR |
| D-18 | Final legal text, governing law, effective date, update process, and publication approval | Stefan | Qualified legal confirmation required; owner approval required after confirmation | Qualified legal-text review with scope/date/limitations; owner publication approval | Blocks public legal publication | Legal publication / activation |
| D-19 | Admin wallet funding/display policy, separate from commercial-owner authority | Stefan | `Owner business decision required` | Repository/runtime and authority-boundary evidence | Non-blocking for documentation completion | Paid beta operations PR |
| D-20 | Repeated activation, refund/chargeback, and credit-grant abuse policy | Stefan | `Owner business decision required`; `Future runtime implementation` | Abuse analysis in §9.1; organization/account linkage and ledger evidence | Blocks paid-credit implementation | Refund, webhook, and paid-credit PRs |

## 17. Future implementation handoff

### 17.1 Gate for PR #81 checkout foundation

No checkout implementation should begin until the human lead explicitly accepts
the remaining scope and, at minimum:

- D-01 through D-09 and D-15 are approved;
- Lemon Squeezy confirms the intended seller/account path can proceed in test
  mode;
- product name, price, currency, interval, seats, allowance, tax display, and
  fulfilment copy are exact;
- the 10-day future-provisioning rule and existing-user preservation rule are
  accepted;
- environment isolation required by
  `docs/beta/environment-and-deployment-safety.md` is evidenced;
- test and live modes, credentials, IDs, and webhooks remain separated;
- checkout is authenticated, server-created, organization-bound, and
  kill-switch controlled; and
- checkout return is explicitly non-authoritative.

If the next checkout PR truly does not grant entitlement or credits, D-10
through D-14 may remain implementation blockers for the later subscription
state PR, but they still block public product copy, provider activation, and
paid launch.

### 17.2 Later runtime contracts

Later PRs must separately implement and validate:

1. future new-account trial provisioning at 10 days, updating runtime
   provisioning, stale public/readiness documentation, agent-facing
   `docs/ai/PROMPT_TEMPLATES.md` and
   `docs/ai/V1_ROADMAP_EXECUTION_RULES.md`, descriptive billing audits, tests,
   and evidence, with no mutation of existing persisted trial expiry rows;
2. provider client and authenticated test-mode checkout;
3. raw-body signature verification, environment checks, event allowlist,
   replay/idempotency protection, and durable failure handling;
4. deterministic provider-product mapping and normalized subscription states;
5. billing-period-aware, exactly-once ledger grants;
6. cancellation, expiry, refund, failed-payment, upgrade, and downgrade policy;
7. account-bound signed customer portal access;
8. server-owned processing and support-required UI states;
9. owner visibility that remains read-only and separate from app-admin
   authority; and
10. reconciliation, monitoring, kill switches, rollback, and controlled launch
    evidence.

None of these is implemented by PR #80.

## 18. Definition of Done

This readiness document is complete when:

- [x] confirmed repository behavior is separated from future intent;
- [x] the approved 10-day public baseline and current 15-day runtime mismatch
      are explicit;
- [x] existing trial subscriptions are protected from silent mutation;
- [x] known plan labels and codes are recorded without inventing a paid price;
- [x] all missing pricing and credit decisions are owner gates;
- [x] cancellation, refund, renewal, failed-payment, and fulfilment boundaries
      are documented;
- [x] current legal-page gaps are inventoried without a legal-sufficiency claim;
- [x] individual and entity seller paths remain open pending provider,
      professional, and owner confirmation;
- [x] the minimum support model avoids unsupported SLA or 24/7 promises;
- [x] public copy is barred from overstating payment availability;
- [x] checkout return and client state are barred from granting entitlement or
      credits;
- [x] external evidence is kept outside Git;
- [x] the gate for later checkout work is explicit; and
- [x] no runtime or public page changed.

Commercial readiness remains incomplete until the blockers below are closed.

## 19. Explicit launch blockers

### Blocks Lemon Squeezy product or variant creation

- final price, currency, interval, seats, and allowance;
- rollover/expiry/top-up/exhaustion policy;
- trial-to-paid and payment-details policy;
- tax-inclusive versus tax-exclusive display;
- seller route and consistent product/seller identity; and
- exact provider product, variant, fulfilment, confirmation, and receipt copy.

### Blocks Lemon Squeezy activation submission

- provider/account confirmation for the selected seller and payout route;
- North Macedonia professional advice and required private evidence;
- qualified review of final legal and privacy text;
- resolved 10-day public/15-day runtime mismatch for new users;
- final cancellation, refund, recurring-billing, credit, and fulfilment policy;
- verified monitored support path;
- final public pages without placeholder notices; and
- provider evidence pack and safe reviewer-access plan.

### Blocks paid public beta

- approved lifecycle decisions for renewal, failed payment, unpaid, cancellation,
  expiry, refund, upgrade, and downgrade;
- isolated test environment;
- signed webhook and deterministic subscription/ledger implementation;
- test-mode checkout, lifecycle, portal, and reconciliation evidence;
- kill switches, monitoring, support, and rollback;
- provider activation approval; and
- a separate human launch decision after required risk review.

### Blocks controlled external trial until operationally addressed

- the 10-day offer versus 15-day runtime provisioning contradiction; and
- the published contact email versus unfinished Contact-page statement and
  unverified monitoring ownership.

Claude review is required before commit because this contract governs later
pricing, payment, entitlement, credit, fulfilment, support, and public legal
implementation.
