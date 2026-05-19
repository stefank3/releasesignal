---
type: v1_roadmap_execution_rules
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: v1_product_readiness
status: active
inherits:
  - AGENTS.md
  - docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
  - docs/ai/AI_SAFEGUARDS.md
  - docs/ai/AGENT_OPERATING_MODEL.md
  - docs/ai/MILESTONE_WORKFLOW.md
---

# Release Signal V1 Roadmap Execution Rules

This document defines how Release Signal V1 product-readiness work should be planned, implemented, reviewed, and protected.

It applies to V1 work involving:

- trials
- credits
- subscriptions
- usage controls
- onboarding
- landing page
- domain setup
- Cloudflare / edge protection
- launch-readiness validation

All V1 work must preserve the Release Signal architecture rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

No V1 roadmap item may override `AGENTS.md`, the Consensus Decision Rule, or the artifact ownership model.

---

## V1 Objective

The V1 objective is to prepare Release Signal for controlled product readiness.

V1 is not just a visual polish phase.

V1 must make the product safer to expose to real users by adding:

- deterministic trial setup
- deterministic credit visibility
- server-side AI usage protection
- basic onboarding
- public-facing landing entry
- domain readiness
- deployment/edge protection
- launch regression discipline

The highest V1 risk is uncontrolled AI usage.

Therefore, credit/trial/access protection must be treated as product infrastructure, not UI decoration.

---

## V1 Scope Boundaries

V1 may include:

- trial initialization for new organizations
- trial duration rules
- starting credit grants
- credit wallet display
- credit ledger-backed grants if ledger exists
- credit consumption guards for AI-triggering actions
- account/trial/credit status display
- onboarding flow for first-time users
- landing page
- domain setup documentation/configuration
- Cloudflare or equivalent protection
- Auth0 URL/configuration updates required for domain setup
- app-level abuse/usage protection
- final V1 launch regression

V1 must not include unless explicitly scoped:

- native TestRail/Qase/Xray/Zephyr integrations
- Automation Candidate Analysis
- Playwright code generation
- generic AI UI scraper
- native execution result file translator
- JUnit/Postman/Cypress/Cucumber report parsers
- CI/CD provider integrations
- team/project enterprise model
- advanced historical readiness dashboard
- AI-based release approval
- AI-based billing decisions
- broad architecture refactor
- broad dashboard redesign
- artifact contract migration
- review scoring redesign

These belong to future V1.1/V1.2/V2 work only when explicitly approved.

---

## Implementation Order

The recommended implementation order is:

```text
1. Trial initialization
2. Credit status API / credit wallet display
3. Credit consumption guard for AI-triggering actions
4. App-level abuse and usage protection
5. First-time onboarding
6. Landing page
7. Domain setup
8. Cloudflare / edge protection
9. Final V1 launch regression
10. V1 closure / launch-candidate decision
```

This order prioritizes product safety before public marketing polish.

Reason:

```text
A landing page can attract users.
Trials and credits decide whether those users can safely consume AI resources.
Server-side enforcement must exist before public traffic is invited.
```

Deployment/domain/Cloudflare work may be prepared in parallel as documentation or configuration, but public launch should wait until trial, credit, and usage protections are in place.

---

## Public Launch Protection Order

Implementation order and public-launch readiness order are related but not identical.

Before public launch, Release Signal must have:

```text
1. Server-side authentication and ownership checks
2. Server-side trial/account state
3. Server-side credit/usage enforcement for AI-triggering actions
4. App-level rate/abuse protection where applicable
5. Domain and Auth0 production URL configuration
6. Cloudflare or equivalent edge protection
7. Landing page or clear product entry route
8. Final launch regression
```

Cloudflare is not a substitute for server-side enforcement.

Domain setup is not a substitute for account-level authorization.

Frontend hiding is not a substitute for credit/usage guards.

---

## V1 Milestone 1: Trial Initialization

Goal:

```text
New organizations receive a deterministic trial state and starting credits when created.
```

Recommended branch:

```text
feature/v1-trial-initialization
```

Expected V1 constants unless superseded by an approved decision:

```text
trial duration: 15 days
starting credits: 100
planCode: trial_v1
subscription status: trialing
seats: 1
grant reason: trial_grant
```

Architecture rules:

- trial state must be server-side
- trial creation must be deterministic
- starting credits must be database-owned
- if a credit ledger exists, the grant must be ledger-backed
- existing organizations must not be reset
- existing organizations must not be silently backfilled
- repeated login must not duplicate trial grants
- AI text must not decide trial status
- UI must not be the source of trial truth

Likely high-risk area:

```text
lib/billing/ensureOrgForUser.ts
```

Forbidden unless explicitly scoped:

- app UI changes
- landing page changes
- Cloudflare changes
- domain setup
- credit spending enforcement
- subscription provider integration
- schema change unless required and approved
- existing organization migration/backfill

Validation expectations:

- new org gets trial state
- new org gets starting credits
- repeated login does not duplicate credits
- existing org remains unchanged
- build passes
- no unrelated files changed

---

## V1 Milestone 2: Credit Status API / Credit Wallet Display

Goal:

```text
Authenticated users can see remaining credits and relevant trial/account status.
```

Recommended branch:

```text
feature/v1-credit-status-display
```

Architecture rules:

- credit balance must come from server/database truth
- UI displays credit state only
- UI must not calculate authoritative balance
- missing wallet/account state must fail clearly or display a safe unavailable state
- unauthenticated users must not access wallet/account data
- users must not access another organization’s wallet/account data

Possible implementation areas:

- billing/account read helper
- API route or server action for account status
- header/sidebar/account-status UI
- safe loading/empty/error UI state

Forbidden unless explicitly scoped:

- credit deduction
- AI route enforcement
- pricing page
- external payment provider integration
- trial creation logic changes
- historical billing dashboard

Validation expectations:

- authenticated user sees correct balance/status
- unauthenticated access is rejected
- missing wallet state is safe
- UI display matches server/database truth
- build passes

---

## V1 Milestone 3: Credit Consumption Guard

Goal:

```text
AI-triggering actions are blocked or charged deterministically based on available credits.
```

Recommended branch:

```text
feature/v1-credit-consumption-guard
```

This is high-risk.

Architecture rules:

- AI usage must be gated server-side
- credit checks must happen before provider execution where possible
- credit deduction/reservation must be deterministic
- AI text must not decide cost
- UI must not decide credit availability
- negative balances must not occur unless explicitly designed and approved
- failed provider calls must have an explicit charge/refund policy
- all credit ledger entries must be deterministic if a ledger exists

Before implementation, define:

- which actions cost credits
- credit cost per action
- whether credits are deducted before or after provider call
- whether failed provider calls refund or do not charge
- how duplicate requests are prevented
- what error is returned when credits are insufficient
- what UI message is shown when blocked
- what ledger reason/request identifier is used

Forbidden unless explicitly scoped:

- provider-specific billing math based on raw token counts
- AI-generated pricing decisions
- client-side-only usage blocking
- silent negative balances
- broad API route refactor
- subscription provider integration

Validation expectations:

- user with credits can perform allowed AI action
- user without credits is blocked before useful AI work is returned
- credit balance changes deterministically
- duplicate submissions do not double-charge if idempotency is implemented
- failed AI call follows approved charge/refund rule
- build passes
- high-risk review completed

---

## V1 Milestone 4: App-Level Abuse and Usage Protection

Goal:

```text
Reduce abuse risk for AI-triggering and sensitive application routes.
```

Architecture rules:

- protection must exist server-side where product resources are consumed
- route protection must not rely only on frontend visibility
- Auth0 session does not automatically imply credit entitlement
- Cloudflare does not replace app-level enforcement
- usage/rate protection must fail safely

Sensitive areas may include:

- AI-triggering chat/API routes
- execution evidence submission
- export routes if costly or sensitive
- account/credit status routes
- Auth0 organization/session-sensitive paths

Possible controls:

- authentication checks
- organization ownership checks
- credit/account status checks
- rate limiting where appropriate
- request-size limits
- fail-closed validation
- structured error responses

Forbidden unless explicitly scoped:

- broad route rewrite
- moving authorization into UI only
- weakening existing ownership checks
- disabling useful validation for convenience
- relying only on Cloudflare

Validation expectations:

- unauthenticated access rejected
- wrong-organization access rejected
- over-limit usage rejected if rate limit is implemented
- valid usage still works
- build passes

---

## V1 Milestone 5: First-Time Onboarding

Goal:

```text
Guide new users toward the first useful Release Signal workflow without changing product truth ownership.
```

Recommended branch:

```text
feature/v1-onboarding-flow
```

Recommended onboarding path:

```text
1. Welcome to Release Signal
2. Explain the value in one clear sentence
3. Show trial/credit/account status if available
4. Offer primary CTA: start with a requirement
5. Offer optional sample/demo path if scoped
6. Guide user into artifact-driven workflow
```

Architecture rules:

- onboarding may guide user actions
- onboarding must not own workflow state
- onboarding must not create fake product truth
- sample/demo data must be clearly marked if introduced
- onboarding must consume server/account state, not invent it
- artifact workflow remains authoritative

Forbidden unless explicitly scoped:

- fake persisted demo data as real user truth
- AI-generated onboarding decisions that change workflow state
- broad dashboard redesign
- billing semantics changes
- trial/credit logic changes
- artifact contract changes

Validation expectations:

- first-time user sees onboarding
- returning user path remains sane
- CTA leads to valid workflow
- account/credit status display remains server-driven
- build passes

---

## V1 Milestone 6: Landing Page

Goal:

```text
Create a public-facing entry page that explains Release Signal and routes users into the app.
```

Recommended branch:

```text
feature/v1-landing-page
```

Landing page should communicate:

- what Release Signal does
- who it is for
- the deterministic workflow
- why test design + execution evidence + readiness matters
- trial or product entry CTA
- navigation into the authenticated app

Suggested positioning:

```text
Release Signal helps QA teams turn requirements, test plans, and execution evidence into deterministic release readiness.
```

Architecture rules:

- landing page is marketing/product-entry UI
- landing page must not own product workflow state
- landing page must not own billing, trial, or credit truth
- landing page must not claim unsupported features
- landing page must not imply native integrations that do not exist
- landing page must not market generic JSON/CSV export as guaranteed direct TestRail/Qase/Xray/Zephyr compatibility

Forbidden unless explicitly scoped:

- billing implementation
- pricing engine
- external payment provider integration
- app workflow rewrites
- artifact logic changes
- credit enforcement changes
- unsupported integration claims

Validation expectations:

- public route loads
- navigation to app/auth flow works
- copy matches current product capabilities
- unsupported future scope is not claimed as implemented
- build passes

---

## V1 Milestone 7: Domain Setup

Goal:

```text
Prepare Release Signal for custom-domain production access.
```

Domain setup is mostly deployment/configuration work.

It should be documented carefully and implemented only where repo changes are needed.

Required considerations:

- Vercel custom domain configuration
- DNS records
- HTTPS
- Auth0 callback URLs
- Auth0 logout URLs
- Auth0 allowed web origins
- production environment variables
- app base URL references
- email/support/contact links if introduced

Architecture rules:

- domain setup must not change product truth
- domain setup must not weaken auth
- Auth0 URL updates must be precise
- local/dev environment must remain usable
- production URL changes must not be hardcoded incorrectly

Forbidden unless explicitly scoped:

- billing logic changes
- trial logic changes
- credit logic changes
- broad environment rewrite
- hardcoded secrets
- committing `.env` files

Validation expectations:

- production domain resolves
- HTTPS works
- Auth0 login callback works
- logout works
- app navigation works
- local dev still works
- no secrets committed

---

## V1 Milestone 8: Cloudflare / Edge Protection

Goal:

```text
Add edge-level protection to reduce public abuse risk.
```

Cloudflare or equivalent edge protection is an outer layer.

It must not replace server-side application enforcement.

Possible protection areas:

- DNS proxying
- SSL/TLS configuration
- WAF managed rules
- bot/challenge rules
- rate limiting for sensitive routes
- request-size controls
- basic monitoring/analytics
- origin protection where applicable

Architecture rules:

- edge protection is defense-in-depth
- app-level auth still required
- app-level credit enforcement still required
- app-level ownership checks still required
- edge configuration must not break Auth0 callbacks
- edge configuration must not block valid app/API behavior

Forbidden unless explicitly scoped:

- removing server-side checks
- relying only on Cloudflare for cost protection
- weakening Auth0
- bypassing app-level usage enforcement
- exposing secrets through edge config

Validation expectations:

- domain still loads
- Auth0 login still works
- app API routes still work for valid users
- obvious abusive patterns are rate-limited/challenged where configured
- valid AI usage still requires server-side credits

---

## V1 Milestone 9: Final V1 Launch Regression

Goal:

```text
Validate that Release Signal is safe and coherent enough for controlled public/product readiness.
```

Minimum regression checklist:

- login
- logout
- new user/org creation path
- trial state creation
- credit grant creation
- repeated login does not duplicate grant
- credit/account status display
- AI action with credits
- AI action without credits or insufficient credits
- requirement refinement
- test generation
- test review
- Improve Test Plan
- Next Batch
- edit/save test case
- JSON export
- CSV export
- execution evidence structured submission if available
- release readiness panel
- workspace health card
- session switch
- page refresh / artifact rehydration
- landing page navigation
- Auth0 callback on production domain
- Cloudflare/domain route behavior if configured

Rules:

- failures must be documented
- skipped checks must be explained
- launch blockers must be separated from non-blocking follow-ups
- no AI may declare launch readiness without human approval

---

## V1 Closure Criteria

V1 can be considered launch-candidate ready only when:

- trial setup works for new organizations
- existing organizations are not accidentally reset
- credit/account status is visible or intentionally deferred
- AI usage is protected server-side according to approved credit rules
- public entry route exists or is intentionally deferred
- domain setup is verified or deferred with explicit reason
- Cloudflare/edge protection is verified or deferred with explicit reason
- Auth0 production URLs are configured correctly if custom domain is used
- core artifact workflows still work
- build passes
- high-risk review is complete
- known limitations are documented
- human lead approves closure

---

## V1 Explicit Non-Goals

Unless separately approved, V1 does not include:

- enterprise tenant administration
- external test management synchronization
- native Qase/TestRail/Xray/Zephyr APIs
- native execution report adapters
- Playwright test generation
- automation candidate scoring
- AI-based release approval
- AI-based billing/pricing decisions
- multi-team enterprise governance
- historical readiness analytics
- full subscription/payment provider launch
- replacing traditional test management tools

---

## Final V1 Rule

V1 is about controlled product readiness.

Do not trade architecture safety for launch speed.

The correct Release Signal flow remains:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

For V1 billing, trial, credit, onboarding, and public launch work, this means:

```text
AI may assist.
Server/database truth decides.
Deterministic services enforce.
UI displays and guides.
Human lead approves.
```