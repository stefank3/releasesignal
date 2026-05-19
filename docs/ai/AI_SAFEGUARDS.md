---
type: safeguards
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: all_repo_work
status: active
inherits:
  - AGENTS.md
  - docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
---

# Release Signal AI Safeguards

This document defines the operating safeguards for all AI-assisted work in the Release Signal repository.

It inherits the root governance contract from `AGENTS.md` and the architecture rules from `docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md`.

The controlling architecture rule is:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

No safeguard in this file may override that rule.

---

## Purpose

The purpose of this file is to prevent AI-assisted development from causing:

- architecture drift
- broad uncontrolled refactors
- conflicting edits across agents
- product truth moving into AI text
- product truth moving into UI-only state
- hidden scope expansion
- unsafe billing, credit, or trial behavior
- accidental artifact contract changes
- accidental roadmap expansion
- unvalidated merge decisions

These safeguards apply to ChatGPT, Codex, Claude Code, Gemini CLI, and any future AI agent operating in this repository.

---

## Universal Safeguards

### 1. No Broad Refactors

Agents must not rewrite large files, rename architecture concepts, reorganize folders, or restructure workflows unless explicitly scoped and approved.

Allowed:

- small helper extraction
- presentational component extraction
- dead import removal
- isolated bug fix
- documentation update
- scoped validation improvement

Not allowed:

- large file rewrite
- global cleanup
- architecture redesign
- broad naming churn
- moving workflow ownership
- changing artifact contracts casually
- combining feature work with unrelated cleanup

---

### 2. One Active Editing Agent

Only one AI agent may edit files on a branch at a time.

Allowed flow:

```text
ChatGPT plans
Codex implements
Claude Code reviews
Codex fixes scoped findings
Gemini CLI reviews docs/consistency
```

Not allowed:

```text
Codex, Claude Code, and Gemini CLI all editing the same branch independently.
```

Review agents may inspect and comment, but they must not edit files unless explicitly assigned as the active editing agent.

---

### 3. No Hidden Scope Expansion

Agents must stay inside the approved scope.

If the task requires files outside the approved scope, the agent must stop and raise a blocker.

The agent must not say:

- "I also cleaned up..."
- "I fixed a few related things..."
- "I updated nearby files for consistency..."
- "I refactored the surrounding code..."
- "I renamed this while I was there..."

These are scope-expansion red flags.

---

### 4. No Product Truth in AI Text

Free-form AI text must never become product truth.

AI text must not directly decide:

- release readiness
- review score
- billing status
- trial status
- credit balance
- credit usage
- execution outcome
- artifact lifecycle
- workflow state
- authorization
- organization ownership
- user entitlement

AI output may become useful only after it is parsed, validated, normalized, and persisted into structured artifacts or deterministic state.

---

### 5. No UI-Owned Business Truth

UI components may render state and trigger actions.

UI components must not own:

- workflow truth
- artifact truth
- billing truth
- credit truth
- trial truth
- review scoring
- release readiness
- execution evidence truth
- access control
- ownership checks

If a UI change needs authoritative state, it must consume deterministic server/client state from an approved service or artifact path.

---

### 6. No Silent Existing Data Mutation

Agents must not silently reset, backfill, overwrite, or mutate existing state unless explicitly scoped.

Protected state includes:

- users
- organizations
- Auth0 identities
- subscriptions
- trials
- wallets
- credit ledgers
- sessions
- artifacts
- test suites
- review results
- execution evidence
- readiness signals

For V1 trial and credit work, existing organizations must not be reset or backfilled unless the milestone explicitly approves it.

---

### 7. Fail Closed

When validation fails, the system must reject safely rather than guess.

Examples:

- invalid model output -> reject or retry safely
- invalid execution evidence -> reject
- duplicate execution result -> reject
- empty execution result -> reject
- suite version mismatch -> reject
- unsupported upload format -> fail clearly
- insufficient credits -> block AI usage when enforcement exists
- missing artifact -> block dependent action
- unauthorized session access -> reject

Failing open is not acceptable for product truth, billing, credits, trials, execution evidence, release readiness, or authorization.

---

### 8. Deterministic Validation First

Any feature touching the following areas must use deterministic validation:

- billing
- trials
- credits
- review scoring
- release readiness
- execution evidence
- artifact parsing
- artifact persistence
- file ingestion
- exports
- access control
- session ownership

No AI-generated string may be the deciding input for these areas.

---

## Blast Radius Controls

Default blast radius limits:

| Task Type | Default Maximum Changed Files | Rule |
|---|---:|---|
| Documentation-only task | 10 | Must not touch app logic |
| Bug fix | 3 | Must be targeted |
| Normal feature | 5 | Must stay within approved scope |
| Complex feature | 10 | Requires explicit approval |
| Refactor milestone | Approved scope only | Requires dedicated branch |

Files under `.ai/milestones/` may be excluded from blast-radius counting when they are milestone artifacts only.

Exceeding the default limit requires explicit human approval.

An agent must stop and raise a blocker if the blast radius exceeds the approved scope.

---

## High-Risk File Safeguards

The following areas require extra caution and review:

- `app/api/chat/route.ts`
- `app/chat/hooks/useChatSession.ts`
- `lib/chat/artifact.ts`
- artifact parsing services
- artifact persistence services
- `lib/server/chat/artifactUpdateService.ts`
- billing services
- trial initialization logic
- credit wallet logic
- credit ledger logic
- subscription logic
- Auth0 organization or user creation logic
- release readiness services
- review scoring logic
- AI provider abstraction
- prompt execution boundaries
- session ownership checks
- authorization checks
- database schema and migrations

When these areas are touched, the agent must provide:

- reason for touching the file
- exact behavior being changed
- exact behavior being preserved
- validation performed
- risk assessment
- rollback considerations

Claude Code review is strongly recommended for high-risk areas.

Human approval is required before merge.

---

## Architecture Red Lines

The following patterns are not allowed:

| Pattern | Why it is blocked |
|---|---|
| AI response directly rendered as product state | Raw AI bypasses structured artifacts |
| AI string used to approve/reject release readiness | AI owns release decision |
| AI string used to calculate billing or credit usage | AI owns billing truth |
| UI-only state used as authoritative balance | UI owns credit truth |
| Chat history used as artifact source when persisted artifact exists | Chat becomes product truth |
| Prompt text treated as persistence contract | Prompt becomes schema |
| Execution results changing review score | Execution truth mutates design-quality truth |
| Readiness logic implemented inside display component | UI owns release decision |
| Existing orgs reset during trial setup without approval | Silent data mutation |
| Provider-specific free text driving workflow behavior | Provider output bypasses parser |

If an agent encounters one of these patterns, it must stop and raise a blocker.

---

## Red-Flag Agent Phrases

Agents must stop and self-review if they are about to say:

- "I also cleaned up..."
- "I refactored the surrounding code..."
- "I simplified the architecture..."
- "I renamed this for consistency..."
- "I changed the prompt to decide..."
- "I moved this logic into the component..."
- "I updated related files while I was there..."
- "I fixed a few other things I noticed..."
- "This was easier if I rewired..."
- "I made the UI calculate..."
- "I used the AI response to determine..."

These phrases usually indicate unauthorized scope expansion or architecture drift.

---

## Blocker Protocol

When an agent finds ambiguity, contradiction, missing scope, or unsafe architecture pressure, it must stop.

For milestone work, create or request:

```text
.ai/milestones/M-{N}/blocker.md
```

The blocker must include:

- title
- milestone
- branch
- agent
- date
- blocker type
- affected files
- affected rules
- what triggered the blocker
- why proceeding is unsafe
- recommended options
- what was not changed

Template:

```md
# Blocker: [short title]

## Milestone

M-{N}

## Branch

[branch name]

## Agent

[ChatGPT | Codex | Claude Code | Gemini CLI]

## Blocker Type

[scope | architecture | artifact contract | billing/credit/trial | validation | dependency | roadmap | unknown]

## Affected Files

- [file or directory]

## Affected Rules

- [AGENTS.md section]
- [docs/ai file/section]

## What Triggered the Blocker

[clear explanation]

## Why Proceeding Is Unsafe

[clear explanation]

## Recommended Options

1. [option]
2. [option]
3. [option]

## What Was Not Changed

[explicitly state what the agent did not modify]
```

Implementation may resume only after the human lead resolves the blocker.

---

## Validation Safeguards

Every code change must report:

1. files changed
2. behavior changed
3. behavior explicitly not changed
4. validation commands run
5. validation result
6. risks
7. follow-up recommendations

Minimum validation for application code:

```bash
npm run build
```

Additional validation is required when touching:

- billing
- credits
- trials
- authentication
- authorization
- artifact parsing
- artifact persistence
- AI provider flow
- session state
- review scoring
- release readiness
- execution evidence
- exports
- onboarding
- landing page routing

For documentation-only changes, run at minimum:

```bash
git diff --stat
git diff -- [changed docs]
```

Build validation may still be run before merge, but documentation-only changes should not require application logic changes.

---

## Git Safety Rules

Agents must not:

- work directly on `master`
- push unless explicitly instructed
- merge unless explicitly instructed
- delete branches unless explicitly instructed
- rebase unless explicitly instructed
- amend commits unless explicitly instructed
- reset hard unless explicitly instructed
- stash and drop changes unless explicitly instructed

All implementation work should start from latest `master` unless continuing an approved existing branch.

Use one branch per bounded task.

---

## Dependency Safeguards

Agents must not add, remove, or upgrade dependencies unless explicitly scoped.

Dependency changes require:

- reason
- package name
- version
- risk assessment
- lockfile impact
- validation commands
- rollback plan

Do not introduce dependencies for convenience if the task can be completed safely with existing code.

---

## Schema and Database Safeguards

Agents must not change database schema, Prisma schema, migrations, or persisted artifact contracts unless explicitly scoped.

Schema/database changes require:

- explicit milestone approval
- migration plan
- backward compatibility assessment
- rollback plan
- validation plan
- production-risk note

Never smuggle schema changes into a UI, docs, or small feature branch.

---

## Billing, Trial, and Credit Safeguards

Billing, trial, and credit state are deterministic product state.

Rules:

- trial creation must be server-side
- credit balance must come from server/database truth
- credit ledger entries must be deterministic if a ledger exists
- credit consumption must not be decided by AI text
- UI must not be the authority for remaining credits
- existing organizations must not be reset or backfilled unless explicitly scoped
- public traffic must not be allowed to consume AI resources without server-side protection
- Cloudflare does not replace server-side enforcement
- Auth0 login does not automatically imply credit entitlement unless the server confirms it

Any change to billing, trial, wallet, ledger, subscription, or usage enforcement is high-risk.

---

## Artifact Contract Safeguards

Structured artifacts are product truth.

Agents must not change artifact fields, meanings, lifecycle rules, or persistence behavior unless explicitly scoped.

Protected artifacts include:

- RefinedRequirement
- TestSuiteArtifact
- PersistedReviewResult
- ExecutionIntelligenceArtifact
- ReleaseReadinessSummary

Rules:

- artifact changes require explicit approval
- stale review behavior must remain deterministic
- execution evidence must not mutate test design quality
- release readiness must remain derived unless persistence is explicitly approved
- prompt text must not become an artifact schema

---

## Roadmap Safeguards

Agents must not implement future roadmap scope unless explicitly approved.

Current roadmap boundaries:

- V1.0/V1.1 product-readiness work may include trials, credits, onboarding, landing page, domain setup, Cloudflare/protection, and launch readiness.
- V1.2+ may include additional bounded product capabilities.
- V2 remains reserved for deeper integrations, automation intelligence, native adapters, and platform expansion.

Do not scaffold V2 concepts during V1 unless explicitly approved.

Do not claim future capabilities are implemented when they are only planned.

---

## Review Safeguards

Review agents must not rewrite the implementation from scratch.

Review agents should return:

1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes

A review should focus on:

- scope compliance
- architecture compliance
- artifact ownership
- deterministic logic boundaries
- validation completeness
- high-risk file safety
- roadmap safety
- merge readiness

Review agents must not introduce alternative designs unless the current design is unsafe.

---

## Final Safeguard

When unsure, stop and ask:

```text
Where does product truth live?
```

If the answer is:

```text
AI text
UI-only state
chat history
prompt wording
unvalidated output
```

then the change is unsafe.

The only acceptable flow is:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```