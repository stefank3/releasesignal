# Lemon Squeezy Store Approval Readiness

## Document control

| Field | Value |
|---|---|
| Scope | PR #77 — Lemon Squeezy Store Approval Readiness |
| Status | Approval checklist and evidence framework; not submission-ready |
| Protected baseline | `master` at `2ea067c8d55a0f44e9038cf6108036d3ddfc6950` |
| Provider | Lemon Squeezy, candidate only |
| Official-source verification date | 2026-07-28 |
| Submission gate | PR #85 |
| Final approval and submission authority | Stefan |

Provider documentation and account questionnaires can change. Re-verify all
external requirements immediately before PR #85. This document summarizes
official sources without reproducing identity documents, tax records, payout
details, credentials, or long provider text.

## Classification vocabulary

| Classification | Meaning |
|---|---|
| `confirmed by official provider documentation` | A current official Lemon Squeezy source directly supports the statement |
| `requires Lemon Squeezy confirmation` | Official material is incomplete, ambiguous, account-specific, or subject to provider review |
| `requires accountant or legal confirmation` | The question concerns local legal, registration, tax, reporting, or contractual obligations |
| `owner decision` | Release Signal must select and approve the commercial policy or operating choice |

## 1. Purpose

Release Signal is preparing for a controlled commercial beta using Lemon
Squeezy as the candidate merchant of record and subscription provider.

PR #77:

- does not submit a store activation application;
- does not implement checkout or webhooks;
- does not create a live product through repository code;
- does not change payment, subscription, account, credit, or ledger authority;
- does not perform provider, Vercel, Auth0, database, payout, tax, or identity
  configuration; and
- does not make a legal or tax conclusion without appropriate professional or
  provider confirmation.

Definition of Done:

```text
The Lemon Squeezy approval checklist, application-input inventory,
evidence framework, reviewer-access plan, and rejection-remediation
process are complete and ready to be populated and validated.
```

PR #77 completes the approval checklist and evidence framework.

It does not establish that the store is ready for activation submission.

This is not a claim that the store can be submitted. Store content readiness
depends on PR #79, and activation submission belongs to PR #85.

## 2. Current Release Signal state

- Product beta readiness is complete.
- Guided onboarding is complete.
- PR #75 documents commercial architecture and launch gates.
- PR #76 documents environment safety and active isolation blockers.
- No Lemon Squeezy API client, checkout, webhook, product, subscription, or
  payment runtime integration exists.
- Legal, pricing, support, and public commercial alignment remain scheduled for
  PR #79.
- Runtime provider integration begins no earlier than PR #80 and remains blocked
  until the applicable PR #76 environment evidence exists.

Active environment rule:

```text
Any migration-bearing Preview remains untrusted until external evidence proves
that Preview cannot access or migrate the production database.
```

PR #77 is safe to perform because it changes documentation only and requires no
Preview-based payment testing.

## 3. Lemon Squeezy provider role

Lemon Squeezy's intended candidate role is:

- merchant of record;
- payment provider;
- subscription lifecycle provider;
- customer portal provider; and
- signed payment-event source.

Release Signal remains responsible for:

- Auth0 identity;
- internal user and organisation mapping;
- application entitlement;
- paid plan mapping;
- credit authority and ledger;
- account state;
- commercial owner visibility;
- AI budget protection; and
- product support.

Authority remains:

```text
verified Lemon Squeezy webhook event
plus
Release Signal database state
equals
application subscription truth
```

The Lemon Squeezy dashboard, checkout return, receipt, email, portal redirect,
or frontend state alone is never Release Signal entitlement authority.

## 4. Official source register

All sources below are official Lemon Squeezy documentation, verified
2026-07-28.

| Source | Verified | Verified provider finding | Release Signal implication | Classification |
|---|---|---|---|---|
| [Activate Your Store](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store) | 2026-07-28 | Live mode requires store activation, including a business/customer questionnaire and identity verification. Lemon Squeezy performs KYC/KYB and product/policy review. SaaS/software using subscriptions or licensing is typically allowed. Declined applicants may resubmit if a mistake or changed circumstances address the issue. | Prepare accurate application inputs and product/fulfilment evidence; do not submit in PR #77. | `confirmed by official provider documentation` |
| [Supported Countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries) | 2026-07-28 | Merchant eligibility depends on receiving a supported bank or PayPal payout. North Macedonia is currently listed for bank payouts. | North Macedonia is not currently excluded from the documented bank-payout list, but account-specific onboarding and payout acceptance still need provider validation. | Country listing: `confirmed by official provider documentation`; actual account acceptance: `requires Lemon Squeezy confirmation` |
| [Verify Your Identity](https://docs.lemonsqueezy.com/help/getting-started/verify-your-identity) | 2026-07-28 | New merchants must provide personal information and a government-issued ID; re-verification may be required and incomplete verification can pause payouts/pay-ins. | Identity evidence must be prepared outside Git and kept current. | `confirmed by official provider documentation` |
| [Prohibited Products](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products) | 2026-07-28 | Software and SaaS are acceptable examples. Physical goods, services, marketplaces, unlicensed IP, and listed regulated/high-risk categories are prohibited. Provider support should be contacted when uncertain. | Describe Release Signal as hosted SaaS and decision support, not consulting, a marketplace, or a regulated/high-risk service. | `confirmed by official provider documentation` |
| [Test Mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode) | 2026-07-28 | New stores start in test mode. Test checkout, subscriptions, webhooks, and API integrations can be exercised before activation. Test products do not automatically become live, and test/live API keys are separate. | Account/test-mode inspection may begin externally, but runtime testing remains blocked by PR #76 isolation requirements. | `confirmed by official provider documentation` |
| [Simulate Webhook Events](https://docs.lemonsqueezy.com/help/webhooks/simulate-webhook-events) | 2026-07-28 | Test and live webhooks are separate and test events can be simulated. | Later staging evidence must use test webhook configuration and never production credentials. | `confirmed by official provider documentation` |
| [Getting Paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid) | 2026-07-28 | Payouts can use supported bank accounts or verified Personal/Business PayPal accounts. The published schedule is twice monthly, net sales are held before availability, payouts may take additional days, and the documented minimum payout threshold is USD 50. Currency conversion/fees may apply. | Verify an owned, name-consistent payout method and account-specific fees/currency before submission. | General provider behavior: `confirmed by official provider documentation`; North Macedonia method/account acceptance: `requires Lemon Squeezy confirmation` |
| [Tax Forms](https://docs.lemonsqueezy.com/help/tax-forms) | 2026-07-28 | Lemon Squeezy collects tax information; US and non-US merchants have different form paths, and payouts may be disabled until the required form is complete. The provider says this is not tax advice. | Inspect the actual non-US form requested for the selected seller type. Do not guess the form or local tax treatment. | Provider requirement: `confirmed by official provider documentation`; applicable form/local treatment: `requires accountant or legal confirmation` |
| [Merchant of Record](https://docs.lemonsqueezy.com/help/payments/merchant-of-record) | 2026-07-28 | Lemon Squeezy describes the merchant of record as handling payment responsibility, sales-tax collection, refunds/chargebacks, and PCI compliance for the customer transaction. | Preserve Lemon Squeezy's customer-transaction role without claiming it eliminates Release Signal's local business, income-tax, support, or product obligations. | `confirmed by official provider documentation` |
| [Sales Tax and VAT](https://docs.lemonsqueezy.com/help/payments/sales-tax-vat) | 2026-07-28 | Lemon Squeezy states it collects/remits sales tax and VAT as merchant of record, while merchants may still owe tax on payout income and should seek local advice. | Macedonian registration, income, reporting, and tax obligations remain professional-advice questions. | Provider sales-tax role: `confirmed by official provider documentation`; local obligations: `requires accountant or legal confirmation` |
| [Refunds and Chargebacks](https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks) | 2026-07-28 | Sellers choose their refund policy, while Lemon Squeezy reserves discretion to issue refunds within 60 days to prevent chargebacks. Chargebacks can affect payouts and excessive chargebacks can lead to intervention. | PR #79 must align the public refund policy with provider rights and the support/escalation process. | `confirmed by official provider documentation` |
| [Two-Factor Authentication](https://docs.lemonsqueezy.com/help/getting-started/two-factor-authentication) | 2026-07-28 | Account 2FA and one-time recovery codes are supported. | Enable 2FA and store recovery codes in an approved private break-glass location. | `confirmed by official provider documentation` |
| [Adding Products](https://docs.lemonsqueezy.com/help/products/adding-products) | 2026-07-28 | Products require a clear name, price, and fulfilment item; descriptions appear at checkout; tax category, media, files/links, variants, confirmation, and receipt content are configurable. Draft products are supported. | Prepare a concise product description, subscription variant plan, screenshots, fulfilment link/approach, and tax-category question before activation. | `confirmed by official provider documentation` |
| [Subscriptions](https://docs.lemonsqueezy.com/help/products/subscriptions) | 2026-07-28 | Subscription products define price and billing interval. Official lifecycle documentation includes on-trial, active, paused, past-due, unpaid, cancelled, and expired states. | PR #82 must include `unpaid` and define Release Signal behavior rather than copying provider access guidance blindly. | Provider statuses: `confirmed by official provider documentation`; app policy: `owner decision` |
| [Customer Portal](https://docs.lemonsqueezy.com/help/online-store/customer-portal) | 2026-07-28 | The hosted portal can expose billing history, payment methods, billing data, and subscription management including cancellation. | The first paid beta can use the hosted portal; verified webhooks still own Release Signal state changes. | `confirmed by official provider documentation` |

### Requirements not fully enumerated by public official documentation

The official pages reviewed do not publish:

- every field in the current activation questionnaire;
- a complete individual-versus-company field matrix;
- a registered-entity requirement for North Macedonian applicants;
- a guaranteed reviewer-account requirement;
- a guaranteed website-page checklist for every application;
- a mandatory merchant support response time or support-page specification;
- a guaranteed reason for rejection or appeal procedure; or
- a promise that a technically eligible product/account will be approved.

These items require dashboard inspection or direct Lemon Squeezy confirmation.

## 5. Merchant eligibility

### North Macedonia

| Question | Current conclusion | Classification | Required evidence |
|---|---|---|---|
| Is North Macedonia listed for bank payouts? | Yes, in the current official supported-country list. | `confirmed by official provider documentation` | Dated source record |
| Is a specific North Macedonian account guaranteed approval? | No guarantee is documented; KYC/KYB, product, risk, and payout review still apply. | `requires Lemon Squeezy confirmation` | Completed dashboard eligibility/payout checks and provider response if needed |
| Is PayPal payout available and suitable for this exact owner/account? | The provider supports verified Personal or Business PayPal in supported regions, but this exact account has not been validated. | `requires Lemon Squeezy confirmation` | Provider/dashboard validation and verified owned PayPal account if selected |
| What local registration and payout-income tax obligations apply? | Not determined here. | `requires accountant or legal confirmation` | Written professional guidance for the selected seller route |

### Individual versus company

Official tax and payout documentation contemplates individuals and entities, and
identity verification requires personal identification. The activation page
does not state that every applicant must be a registered legal entity, but it
also does not publish a country-specific individual approval guarantee.

Therefore:

- "a registered entity is mandatory" is **not established** by the reviewed
  official sources;
- "an individual application will be accepted for this owner and product" is
  also **not established**;
- the live questionnaire and Lemon Squeezy support must confirm the exact route;
  and
- Macedonian legal/tax suitability must be confirmed professionally.

## 6. Seller identity decision

Unresolved owner decision:

```text
Apply as an individual
or
apply through a legally registered entity
```

No identity route may be selected merely because it appears faster.

### Individual route evidence

- legal name;
- current residential/registered address;
- provider-accepted government ID;
- tax residence and provider-requested non-US tax information;
- payout method owned by the same individual;
- individual application eligibility confirmed by Lemon Squeezy;
- Macedonian legal/tax suitability confirmed professionally; and
- consistent public seller/operator wording.

### Entity route evidence

- exact registered company name and registration details;
- registered address;
- beneficial-owner information;
- authorised representative and government ID;
- provider-requested tax information;
- payout account owned by the entity;
- authority to accept provider/legal terms; and
- consistent provider, website, legal-page, payout, and support identity.

### Repository prohibition

Do not store government IDs, tax numbers, personal addresses, bank/PayPal
details, registration certificates, beneficial-owner records, signatures, or
provider verification screenshots containing sensitive data in Git.

Repository evidence may record only:

- route selected;
- owner;
- verification date;
- pass/block status;
- redacted external evidence location; and
- provider/professional confirmation status.

## 7. Merchant application-input inventory

The actual activation questionnaire must be inspected before PR #85. Prepare:

| Input area | Required preparation | Classification | Status |
|---|---|---|---|
| Seller route | Individual or entity decision | `owner decision` | Open |
| Legal seller identity | Exact selected-route identity, consistent everywhere | Provider/professional confirmation required | Open |
| Country and address | North Macedonia and provider-accepted address evidence | `requires Lemon Squeezy confirmation` | Open |
| Business/product summary | Concise factual Release Signal description | `owner decision` based on product truth | Drafted below |
| Customer audience | Software teams, QA professionals, product/release stakeholders | `owner decision` | Drafted |
| Product category | Hosted software/SaaS | Officially eligible category; final review still provider-owned | Drafted |
| Fulfilment | Authenticated hosted workspace after verified subscription processing | Provider questionnaire specifics require confirmation | Planned |
| Website | Public product, pricing, legal, support, fulfilment, and trust information | Final content requires PR #79 | Blocked |
| Pricing | Price, currency, interval, allowance, credit policy | `owner decision` | Open |
| Support | Monitored address and escalation process | `owner decision` | Blocked by PR #79 |
| Refund/cancellation | Public policy consistent with provider rights | Owner/legal decision | Blocked by PR #79 |
| Identity verification | Government ID and current personal details outside Git | Officially required | Not performed |
| Payout | Supported owned method with matching name | Provider/account confirmation | Open |
| Tax information | Actual provider-requested form and local treatment | Provider plus professional confirmation | Open |
| Product/variant | Draft/test subscription structure | Owner decision; provider fields inspected later | Open |
| Reviewer access | Safe evidence/account option | Provider need unconfirmed; Release Signal plan below | Planned |

## 8. Product eligibility and description

Release Signal is:

```text
A hosted QA intelligence and release-readiness workspace that helps
software teams refine requirements, design and review test coverage,
record execution evidence, and support human release decisions.
```

It is:

- hosted SaaS;
- digitally delivered;
- accessed through authenticated accounts;
- used for QA planning and release-decision support;
- not a physical product;
- not financial, gambling, adult, restricted, or prohibited software;
- not a marketplace or consulting service; and
- not a guarantee of release safety.

Avoid claims that Release Signal provides:

- automatic release approval;
- guaranteed defect prevention;
- guaranteed or complete test coverage;
- replacement of human QA/release authority; or
- unrestricted AI access.

### Recommended short provider product description

> Release Signal is a hosted QA intelligence and release-readiness workspace
> for software teams. It helps users refine requirements, create and review
> structured test coverage, record execution evidence, and generate
> deterministic readiness signals that support human release decisions.
> Subscription access includes a defined AI-assisted usage allowance; Release
> Signal does not guarantee complete coverage, defect-free software, or a safe
> release.

The final allowance sentence must be aligned with approved PR #79 commercial
values before use.

## 9. Fulfilment model

Planned customer journey:

```text
Customer subscribes
→ Lemon Squeezy processes the transaction
→ verified webhook is processed
→ Release Signal maps the subscription
→ application entitlement and credits are updated
→ customer accesses the hosted workspace through Auth0
```

What the customer receives:

- access to the hosted Release Signal workspace;
- the approved plan's workflow and account entitlement;
- a defined billing-period AI/credit allowance; and
- access to support and provider billing management.

Access begins only after verified, mapped provider processing updates Release
Signal database state. Account identity is established through Auth0. Credits
represent a server-owned usage allowance for approved AI-backed workflow
actions; they are not cash, stored value, or a provider wallet.

If webhook processing is delayed, the return experience must show processing or
support-required state. A checkout completion page, email receipt, return URL,
portal redirect, or frontend flag must not activate access.

This fulfilment flow is planned and not yet implemented.

## 10. Public website readiness checklist

Required before activation submission:

- [ ] Clear homepage and factual product description.
- [ ] Customer audience and normal workflow.
- [ ] Hosted SaaS/digital fulfilment explanation.
- [ ] Price, currency, subscription interval, and recurring-billing disclosure.
- [ ] Included AI allowance/credits and exhaustion behavior.
- [ ] Trial duration and terms.
- [ ] Cancellation timing and access effect.
- [ ] Refund policy consistent with provider rights.
- [ ] Terms of Service.
- [ ] Privacy Policy.
- [ ] Subscription and Billing Terms.
- [ ] Contact and monitored support information.
- [ ] Acceptable Use and sensitive-data guidance.
- [ ] Human release-authority guardrail.
- [ ] No placeholder or premature live-payment wording.
- [ ] Seller/operator identity consistent with the selected application route.

Current blocking gaps:

```text
Marketing advertises a 10-day trial.
Server provisioning remains 15 days.

contact@releasesignal.io is advertised.
The Contact page says the support channel is unfinished.
```

Trust, refund, privacy, and related commercial pages also identify themselves as
drafts/placeholders. PR #79 owns public-site alignment. PR #77 does not change
these pages.

## 11. Pricing-input inventory

Do not create provider product/variant values until the owner decides:

- [ ] Price.
- [ ] Currency.
- [ ] Monthly, annual, or other approved billing interval.
- [ ] Included AI allowance.
- [ ] Credits granted per period.
- [ ] Credit reset date and billing-period identity.
- [ ] Rollover or expiration.
- [ ] Past-due behavior.
- [ ] `unpaid` behavior.
- [ ] Cancellation timing and end-of-period access.
- [ ] Refund treatment for access and credits.
- [ ] Plan-change/proration treatment.
- [ ] Trial-to-paid transition.
- [ ] Credit exhaustion behavior.
- [ ] Whether subscription ownership is user- or organisation-based.
- [ ] Multiple-subscriptions-per-account policy.

These are required before PR #79 final copy, before product/variant approval,
and before PR #85 submission.

## 12. Legal and policy inventory

PR #77 inventories; PR #79 aligns repository/public content.

- Terms of Service.
- Privacy Policy.
- Trial Terms.
- Subscription and Billing Terms.
- Refund and Cancellation Policy.
- Contact and Support.
- Acceptable Use.
- AI limitations and credit rules.
- Account suspension/termination.
- Recurring billing and renewal disclosure.
- Third-party processors/subprocessors.
- Data handling and retention claims.
- Human release-authority disclaimer.
- Seller identity and governing/business information appropriate to the chosen
  route.

Final text requires appropriate human/legal review. No public page may imply
that live payments are available before activation.

## 13. Support readiness

Initial controlled-beta model:

```text
Support email
→ monitored inbox
→ acknowledgement
→ issue classification
→ resolution or escalation
```

Required evidence:

- functioning public support address;
- named monitored owner and backup;
- truthful response expectation;
- account/access escalation;
- payment/subscription escalation;
- refund/cancellation escalation;
- security-reporting path;
- provider-failure escalation; and
- incident record that excludes credentials and unnecessary personal/payment
  data.

No support portal is required for the first commercial beta.

## 14. Reviewer-access strategy

Public official documentation reviewed for PR #77 does not guarantee that every
activation reviewer will request an account. Release Signal should nevertheless
prepare safe options:

- public product walkthrough;
- current workflow screenshots;
- concise fulfilment explanation;
- pricing/subscription explanation;
- cancellation/support path;
- a dedicated reviewer account if requested;
- bounded trial access; and
- evidence that the SaaS is functional.

A reviewer account must:

- contain no production customer data;
- use synthetic, non-sensitive QA content;
- have bounded credits;
- expose no admin or owner functionality;
- have clear login/use instructions;
- be dedicated to review rather than reused personal access;
- be monitored; and
- be removable or disabled after review.

Creating an account is not authorised by PR #77.

## 15. Approval evidence pack

Each item records:

| Field | Meaning |
|---|---|
| Item | Evidence being prepared |
| Owner | Person accountable |
| Source/location | Public URL or redacted private reference |
| Status | Not started / collecting / ready / verified / blocked |
| Verification date | Most recent human check |
| Blocker | Missing decision, content, setup, or provider answer |
| Gate relevance | PR #77, PR #79, PR #85, or later |

Evidence checklist:

| Item | Owner | Source/location | Status | Verification date | Blocker | Gate relevance |
|---|---|---|---|---|---|---|
| Homepage screenshot | Stefan | Public site | Not started | — | PR #79 content | PR #85 |
| Product positioning | Stefan | Public/provider copy | Draft | 2026-07-28 | Commercial values | PR #79/#85 |
| Workflow screenshots | Stefan | Redacted evidence pack | Not started | — | Select safe states | PR #85 |
| Auth0 login | Stefan | Redacted walkthrough | Not started | — | Production branding PR #78 | PR #85 |
| Account workspace | Stefan | Redacted walkthrough | Not started | — | Safe test data | PR #85 |
| Reviewer/trial account | Stefan | Private operations record | Not created | — | Explicit approval/setup | PR #85 |
| Pricing and interval | Stefan | Public/provider copy | Blocked | — | Owner decisions | PR #79/#85 |
| Product/variant configuration | Stefan | Provider dashboard reference | Not created | — | Pricing and plan decisions | PR #85 |
| Terms | Stefan | Public route | Draft only | 2026-07-28 | PR #79 review | PR #85 |
| Privacy | Stefan | Public route | Draft only | 2026-07-28 | PR #79 review | PR #85 |
| Trial Terms | Stefan | Public route | Draft only | 2026-07-28 | Duration contradiction | PR #79/#85 |
| Refund/Cancellation | Stefan | Public route | Placeholder | 2026-07-28 | Policy decision | PR #79/#85 |
| Contact/support | Stefan | Public route/inbox evidence | Blocked | 2026-07-28 | Wording/monitoring contradiction | PR #79/#85 |
| Fulfilment description | Stefan | This document/provider copy | Planned | 2026-07-28 | Runtime not implemented | PR #85 |
| Subscription lifecycle | Stefan | Architecture/evidence pack | Planned | 2026-07-28 | PRs #81–#83 | PR #85 |
| Cancellation flow | Stefan | Test evidence | Not available | — | PR #83 | PR #85 |
| Test checkout evidence | Stefan | Redacted test evidence | Not available | — | Environment block and PR #80 | PR #85 |
| Test webhook evidence | Stefan | Redacted test evidence | Not available | — | Environment block and PR #81 | PR #85 |
| Identity readiness | Stefan | Private identity record | Not assessed | — | Seller route | PR #85 |
| Payout readiness | Stefan | Private provider record | Not assessed | — | Seller route/account validation | PR #85 |
| Tax-form readiness | Stefan | Private provider/professional record | Not assessed | — | Seller route/professional advice | PR #85 |

Identity, payout, and tax documents never belong in the repository.

## 16. Lemon Squeezy account and test-mode preparation

Safe external steps that may begin:

- create a Lemon Squeezy account;
- verify account email;
- enable two-factor authentication;
- store recovery codes privately;
- inspect—but do not submit—the activation questionnaire;
- inspect identity, payout, tax, store, and product fields;
- inspect test mode;
- inspect webhook and customer portal capabilities;
- record required field names without values; and
- create a draft/test product only after the owner approves the structure and
  PR #76 isolation constraints are respected.

Do not:

- submit activation;
- enable live mode;
- use live credentials;
- perform Preview-dependent payment tests;
- commit product/variant IDs, credentials, secrets, personal data, or provider
  screenshots containing them; or
- treat test success as approval certainty.

Test-mode products do not automatically become live. Any later copy-to-live
action requires review of final price, interval, tax category, fulfilment,
receipt, variant, and public copy.

## 17. Payout readiness

Confirmed provider facts:

- North Macedonia is currently in the official bank-payout country list.
- Supported merchants may use bank or verified Personal/Business PayPal payout
  methods, subject to account/country acceptance.
- Published payouts are created twice monthly, include a holding period, and may
  require additional bank processing time.
- The current documented minimum payout threshold is USD 50.
- Bank/PayPal conversion and payout fees can apply.
- Identity verification and completed tax information can affect payouts.

Required owner/provider evidence:

- selected payout method is available for this exact account;
- payout account ownership matches selected seller identity;
- name/address/tax information is consistent;
- settlement currency and conversion costs are understood;
- threshold/holding period are operationally acceptable;
- payout failure/escalation path is known; and
- account remains verified.

Do not conclude anything about Macedonian tax liability from payout support.

## 18. Tax and merchant-of-record boundaries

Lemon Squeezy states that, as merchant of record, it handles the customer
transaction responsibilities described in its official material, including
payment processing, sales-tax/VAT collection/remittance, refunds/chargebacks,
and PCI responsibility.

Release Signal/Stefan remains responsible for:

- accurate seller and product information;
- lawful business operation and local registration where required;
- payout-income accounting and tax;
- provider-requested tax/identity information;
- product fulfilment and support;
- application access and data handling;
- commercial policy and contract accuracy; and
- local reporting or other obligations.

Merchant-of-record status does not prove that no Macedonian registration,
income-tax, reporting, accounting, or legal obligation exists.

Before submission:

- inspect the exact provider tax form for the selected route;
- have an accountant/legal professional confirm local obligations;
- ensure payout identity and public seller identity are consistent; and
- keep all sensitive records outside Git.

## 19. Refund, cancellation, and support boundaries

- Release Signal must select and publish a refund policy.
- Lemon Squeezy reserves documented refund discretion, including within 60 days
  to prevent chargebacks.
- Refund and chargeback effects on payouts must be understood.
- The customer must receive a monitored support path before escalating a
  fulfilment concern to a chargeback.
- Cancellation timing and end-of-period access must be described accurately.
- The Lemon Squeezy customer portal is the intended first-beta management path.
- Portal actions become Release Signal truth only through verified provider
  events and database state.

PR #79 owns public policy text. PRs #81–#83 own later deterministic processing.

## 20. Rejection and reapplication process

```text
Application submitted
→ approved, pending, or declined
→ exact response recorded
→ findings classified
→ corrections planned
→ corrections implemented
→ evidence collected
→ resubmission decision
```

The provider's activation documentation allows resubmission where a mistake or
changed business circumstances may resolve the issue. It does not guarantee
approval or a detailed reason.

```text
Do not repeatedly resubmit an unchanged application.
```

Remediation template:

| Field | Entry |
|---|---|
| Provider response | Exact non-sensitive response or private reference |
| Date | Provider response date |
| Finding | Factual issue |
| Classification | Identity / jurisdiction / payout / tax / product / website / legal / pricing / fulfilment / support / technical / security / risk / insufficient information |
| Risk | Approval or downstream impact |
| Required correction | Bounded action |
| Owner | Accountable person |
| Evidence | Public/redacted private reference |
| Validation | Check and result |
| Status | Open / clarified / corrected / accepted / unremediable |
| Support clarification required | Yes/no and question |
| Resubmission decision | Do not resubmit / request clarification / resubmit after correction / abandon provider |

A resubmission requires a material correction, new evidence, or documented
provider clarification plus Stefan's approval.

## 21. Provider fallback decision

```text
If Lemon Squeezy is declined for remediable reasons
→ correct and reapply.

If Lemon Squeezy is declined for unclear reasons
→ request provider clarification.

If Lemon Squeezy is declined for an unremediable eligibility,
jurisdiction, product, payout, or risk reason
→ stop Lemon Squeezy-specific implementation and reopen
the payment-provider decision.
```

An unremediable rejection triggers:

- explicit provider re-evaluation;
- impact review for PRs #80–#86;
- no automatic substitution of another provider;
- no reuse of Lemon Squeezy-specific status, API, checkout, webhook, portal,
  payout, tax, or legal assumptions;
- removal/revocation of provider-specific credentials and external
  configuration according to PR #76; and
- updated architecture and legal review approved by Stefan.

## 22. Approval gates

### Evidence framework complete — PR #77

- [ ] Current official requirements researched and dated.
- [ ] Merchant application inputs inventoried.
- [ ] Individual/entity decision and evidence paths identified.
- [ ] Product and fulfilment descriptions drafted truthfully.
- [ ] Website, pricing, legal, and support prerequisites inventoried.
- [ ] Reviewer-access plan defined.
- [ ] Evidence checklist/template established.
- [ ] Rejection, reapplication, and provider-fallback process defined.
- [ ] Unresolved items have classifications and owners.

Passing this gate does not mean the store can be submitted.

### Store content ready — after PR #79

- [ ] Pricing and recurring-billing disclosure finalised.
- [ ] Trial-duration contradiction resolved through explicit decision.
- [ ] Contact/support contradiction resolved.
- [ ] Legal/trust pages aligned and human-reviewed.
- [ ] Public fulfilment wording is accurate.
- [ ] Seller identity is consistent.
- [ ] No placeholder or premature payment copy remains.

### Activation submission ready — PR #85

- [ ] Seller identity selected.
- [ ] Identity documents available outside Git.
- [ ] Payout account/method confirmed.
- [ ] Provider tax-information requirement and local obligations confirmed.
- [ ] Public site complete.
- [ ] Reviewer access/evidence prepared.
- [ ] Product/variant configuration reviewed.
- [ ] Store, site, legal, support, and payout identity consistent.
- [ ] Test-mode checkout/webhook/portal evidence available where required.
- [ ] PR #76 environment evidence complete for the tested integration.
- [ ] No unresolved approval blocker.
- [ ] Stefan approves submission.

## 23. Risks and blockers

| Risk | Current status | Required response |
|---|---|---|
| Individual/entity uncertainty | Open | Provider plus professional confirmation; owner decision |
| Payout-account incompatibility | Open | Validate exact method/account before submission |
| Inconsistent seller identity | Open | Align provider, payout, public, legal, and support identity |
| Incomplete legal pages | Blocking PR #85 | PR #79 and human review |
| Pricing not final | Blocking PR #85 | Owner decision and PR #79 |
| Trial-duration contradiction | Blocking controlled external beta/PR #85 | Explicit decision and PR #79 |
| Unfinished support wording | Blocking controlled external beta/PR #85 | Confirm monitored channel and PR #79 |
| Unclear fulfilment | Planned only | Implement/test PRs #80–#82 and document accurately |
| Unsupported product interpretation | Low but provider-owned | Use factual SaaS description; ask support if questioned |
| Incomplete reviewer access | Open | Prepare safe evidence/account plan |
| Premature activation submission | Blocked by process | Submit only at PR #85 gate |
| Unremediable provider rejection | Open contingency | Reopen provider decision |
| Treating test mode as approval certainty | Prohibited | Keep test and activation gates separate |
| Identity documents or secrets in Git | Prohibited | Store privately; rotate/remediate exposure |
| Preview production database access | Operational blocker | Complete PR #76 external evidence |

## 24. Vercel operational work in parallel

Outside PR #77 repository scope, collect redacted evidence that:

- Preview does not receive production `DATABASE_URL`;
- Preview does not receive production `DIRECT_URL`;
- Preview does not receive production Auth0 secrets;
- Preview does not receive production Upstash credentials;
- Preview does not receive production OpenAI credentials;
- Production variables have correct Vercel scope; and
- a dedicated staging identity can be established.

Record only:

- control checked;
- environment;
- owner;
- date;
- result;
- redacted evidence location; and
- remediation required.

Runtime implementation and Preview-based payment testing remain blocked until
the relevant isolation evidence exists.

## 25. Repository scope and non-goals

PR #77 creates this document only. It does not:

- implement checkout, webhooks, API clients, subscriptions, portal, billing,
  credits, owner views, or notifications;
- add payment/subscription/event tables or change Prisma;
- change Auth0, `/api/me`, account state, or access behavior;
- change UI, pricing copy, trial duration, Contact wording, legal pages,
  onboarding, prompts, artifacts, Review Score, or Release Readiness;
- create reviewer accounts, store activation, live products, payout methods, or
  tax/identity submissions;
- add secrets, credentials, provider IDs, personal identity data, GitHub
  Actions, or CI; or
- treat provider dashboard state as application authority.

## 26. Downstream roadmap

```text
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

- PR #77 creates the approval checklist and evidence framework.
- PR #78 prepares Auth0 branding and commercial authority.
- PR #79 makes the site commercially consistent.
- PRs #80–#84 build and test the isolated integration.
- PR #82 must include `unpaid`, decide user/organisation subscription ownership,
  define multiple-subscription policy, and stage schema/lifecycle review before
  credit/ledger integration.
- PR #85 is the activation submission gate.
- PR #86 begins only after provider approval.
- PR #87 makes the commercial beta launch decision.

## 27. Current PR #85 blockers

- Seller identity route not selected.
- Exact Lemon Squeezy activation questionnaire not inspected.
- Individual-route acceptance for this owner/account not confirmed.
- Macedonian legal/tax obligations not professionally confirmed.
- Payout method/account not validated.
- Provider tax-form path not validated.
- Price, currency, interval, allowance, and credit policies not final.
- Trial-duration contradiction unresolved.
- Support/Contact contradiction unresolved.
- Legal and commercial pages remain drafts/placeholders.
- Reviewer access/evidence not prepared.
- No approved product/variant configuration.
- No isolated test checkout, webhook, subscription, portal, or cancellation
  evidence.
- PR #76 external environment-separation evidence incomplete.

## 28. PR #77 completion boundary

PR #77 is complete when the checklist and framework are ready to populate and
validate:

- current official Lemon Squeezy requirements are documented with sources and
  verification date;
- application inputs are inventoried;
- individual and entity evidence routes are separated;
- product and fulfilment descriptions are accurate;
- website, pricing, legal, and support prerequisites are inventoried;
- reviewer access and evidence requirements are defined;
- payout and tax uncertainties are classified;
- rejection remediation is defined;
- unremediable rejection reopens the provider decision;
- PR #85 blockers are visible; and
- no runtime or commercial behavior changes.

Completion does **not** mean the store is ready to submit. PR #79 content
alignment and PR #85 submission approval remain mandatory.
