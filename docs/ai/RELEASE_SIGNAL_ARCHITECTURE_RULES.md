---
type: architecture_rules
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: release_signal_architecture
status: active
inherits:
  - AGENTS.md
---

# Release Signal Architecture Rules

This document defines the Release Signal product architecture, artifact ownership model, and non-negotiable system boundaries.

It expands the root governance rule from `AGENTS.md`:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

For scripts, prompts, and terminal checks, the ASCII equivalent is treated as the same rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

This file preserves the product-specific architecture context previously held in the old root `AGENTS.md`.

---

## Product Overview

Release Signal is a QA intelligence and release-risk platform.

It helps QA professionals move from raw requirements and test plans toward structured, reviewable, evidence-backed release decisions.

The current product is aimed at:

- senior QA professionals
- intermediate QA professionals
- QA leads
- technically strong testers
- teams that need better requirement analysis, test design review, execution evidence, and release-risk visibility

Release Signal is not currently:

- a full test management replacement
- a TestRail/Qase/Xray/Zephyr clone
- a native automation-code-generation platform
- a Playwright generator
- a full enterprise release governance product

Current category:

```text
QA intelligence workspace / release-risk reporting layer
```

The product is moving toward a high-tech QA intelligence layer that can sit before, around, or above traditional test management tools.

Commercial readiness work such as trials, credits, subscriptions, landing pages, onboarding, domain setup, and Cloudflare protection belongs to V1 product-readiness scope and must still preserve the architecture rule.

---

## Technical Stack

Release Signal uses:

- Next.js
- React
- TypeScript
- Next.js API routes
- Auth0 authentication
- Prisma
- database-backed persistence
- structured session artifacts
- AI provider abstraction with OpenAI currently behind internal boundaries
- Vercel-style deployment expected for production

The product is built around persisted session artifacts and deterministic service modules.

Components render artifact-backed state.

Components do not own product truth.

---

## Architecture Ownership Model

Release Signal separates responsibilities as follows:

```text
AI assistance
|
v
parsing / validation / normalization
|
v
structured artifacts
|
v
deterministic services
|
v
UI rendering and explicit user actions
```

AI may:

- assist
- generate
- clarify
- explain
- suggest improvements
- draft structured candidate content

AI must not directly own:

- workflow truth
- billing truth
- credit truth
- trial truth
- release readiness truth
- review score truth
- execution result truth
- artifact lifecycle truth
- authorization truth
- persistence contracts

Structured artifacts own product state.

Deterministic services own product decisions.

UI renders state and triggers explicit user actions.

---

## Deterministic Service Ownership

Deterministic services own:

- workflow decisions
- review scoring
- artifact validation
- file ingestion
- export logic
- execution evidence validation
- execution evidence normalization
- release readiness calculation
- billing state evaluation
- trial state evaluation
- credit balance evaluation
- credit consumption rules
- access and ownership checks

If a feature requires one of these decisions, it must be implemented in deterministic logic, not as free-form AI text or UI-only state.

---

## UI Ownership Boundary

UI may:

- render artifact-backed state
- show available user actions
- trigger explicit workflow actions
- display validation errors
- display summaries derived from deterministic services
- collect user input

UI must not:

- own product truth
- calculate authoritative billing state
- calculate authoritative credit balance
- decide release readiness
- decide review score
- infer artifact truth from chat text
- mutate artifact state without approved workflow/service paths
- bypass server-side validation
- bypass ownership checks

---

## Forbidden Architecture Drift

Never allow:

- free-form AI text to own workflow truth
- chat history to become artifact truth
- UI-only state to become business truth
- unvalidated model output to drive scoring
- AI to decide release readiness
- AI to own execution truth
- prompts to become persistence contracts
- billing or credit decisions to be made from AI text
- trial lifecycle decisions to be made by UI-only state
- authorization decisions to be made client-side only

If a proposed change moves truth, scoring, release decisions, execution truth, artifact state, billing state, credit state, trial state, or workflow control into AI text, UI state, or chat history, the agent must stop and raise a blocker.

---

## Core Artifacts

### RefinedRequirement

`RefinedRequirement` is the structured QA-ready requirement derived from raw input.

Sections include:

- Objective
- Functional Scope
- Business Rules
- Acceptance Criteria
- Edge Cases / Negative Paths
- Non-Functional Constraints
- Test Strategy Hooks
- Risk Areas
- Coverage Targets
- Minimal Repro Scenarios
- Open Questions / Clarifications

Ownership rule:

```text
The refined requirement artifact is authoritative for requirement-aware workflow actions.
```

AI may help draft or improve it, but the system must parse, validate, normalize, and persist it before treating it as product state.

---

### TestSuiteArtifact

`TestSuiteArtifact` is the structured test plan / test suite.

Case fields include:

- caseId
- title
- type
- priority
- preconditions
- steps
- expectedResults
- tags
- notes
- body

Ownership rules:

```text
TestSuiteArtifact is authoritative for current test plan state.
```

```text
Generate Tests = create a new suite.
Next Batch = append-only expansion.
Improve Test Plan = preserve, enhance, clarify, and fill gaps.
Regenerate Test Plan = future separate destructive/restructure action unless explicitly scoped.
```

Improve Test Plan must not silently compress a large suite into a smaller generic suite.

Suite reduction is allowed only when cases are duplicate, invalid, malformed, or materially repetitive, and the reduction must be explainable.

---

### PersistedReviewResult

`PersistedReviewResult` is the deterministic review of test design quality.

Dimensions include:

- business relevance
- risk coverage
- design quality
- level and scope
- diagnostic value

Hard rule:

```text
Review score measures test design quality only.
Execution results must not change the review score.
```

Review results may become stale when the requirement or test suite changes.

Stale review handling must be deterministic.

AI explanations may describe review findings, but AI explanations must not become the review score source of truth.

---

### ExecutionIntelligenceArtifact

`ExecutionIntelligenceArtifact` stores observed execution outcomes.

Supported statuses:

- passed
- failed
- skipped
- blocked
- timed_out
- unknown

Supported sources:

- manual
- playwright
- selenium
- postman
- ci
- unknown

Hard rules:

- Execution evidence does not mutate the test suite.
- Execution evidence does not mutate the review result.
- Execution evidence does not decide readiness directly.
- Execution evidence must be validated and normalized deterministically.
- Duplicate case results must be rejected.
- Empty result submissions must be rejected.
- Suite version mismatch must be rejected.
- Unknown/unmatched case IDs may be accepted only with explicit warnings if that behavior is scoped.

---

### ReleaseReadinessSummary

`ReleaseReadinessSummary` is the derived deterministic release-readiness signal from current artifacts.

Inputs:

```text
RefinedRequirement
+ TestSuiteArtifact
+ PersistedReviewResult
+ ExecutionIntelligenceArtifact
```

Known statuses:

- insufficient_data
- not_ready
- weak
- partial
- ready_with_risk
- ready
- blocked

Hard rule:

```text
ReleaseReadinessSummary is derived, not persisted as a historical artifact.
Do not add readiness persistence unless explicitly approved.
```

Release readiness must not be decided by AI free-form text.

Release readiness must not be decided by UI-only logic.

Release readiness may be displayed in the UI only after deterministic rules calculate it.

---

## Workspace Health vs Release Readiness

Release Signal distinguishes between Workspace Health and Release Readiness.

```text
Release Readiness = primary V1 release decision/reporting surface.
Workspace Health = compact workspace context signal.
```

Rules:

- Do not merge these concepts without explicit approval.
- Do not rename one into the other without explicit approval.
- Do not change readiness semantics through UI label changes.
- Do not treat Workspace Health as the final release decision.
- Release Readiness remains the primary V1 reporting signal.

---

## Billing, Trials, and Credits Architecture Boundary

V1 product-readiness work introduces or expands billing-adjacent concepts such as:

- trial initialization
- trial duration
- starting credits
- credit wallets
- credit ledgers
- credit consumption guards
- subscription state
- usage limits
- app-level abuse protection

These are deterministic product state.

They must not be owned by:

- AI prompts
- AI responses
- UI-only calculations
- local-only browser state
- marketing copy
- chat messages

Rules:

- New trial state must be created server-side.
- Credit balance must come from server/database-owned truth.
- Credit consumption must be deterministic and ledger-backed if a ledger exists.
- Existing organizations must not be silently reset or backfilled unless explicitly scoped.
- AI usage must be gated server-side when credit enforcement is introduced.
- Cloudflare or other edge protection does not replace server-side credit enforcement.
- Frontend hiding does not replace server-side authorization or usage checks.

---

## File Ingestion Boundary

File ingestion must remain deterministic.

Rules:

- Uploads must be parsed into structured artifacts before becoming product state.
- Unsupported formats must fail clearly.
- Parser failures must fail closed.
- Existing test suites must not be overwritten, merged, or hidden-mutated unless explicitly scoped.
- AI must not be used as the structural parser for uploaded test-suite truth.

Known historical behavior:

```text
TXT and structured MD were supported in M14.
CSV, JSON suite upload, Qase/TestRail/Xray/Zephyr import, and merge/append upload were not part of M14.
```

Do not claim unsupported import formats as implemented.

---

## Export Boundary

Export logic must remain deterministic.

Rules:

- Exports must read from persisted structured artifacts.
- Exports must not mutate artifacts.
- Exports must not call AI.
- Generic JSON/CSV exports must not be marketed as guaranteed direct TestRail/Qase/Xray/Zephyr compatibility.
- Tool-specific exports require explicit scoped implementation.

Known historical behavior:

```text
M15 delivered generic JSON and CSV export for Release Signal test suites.
```

Correct positioning:

```text
Export Release Signal test suites as clean JSON/CSV for sharing, documentation, migration, or manual mapping.
```

---

## Execution Evidence Boundary

Execution evidence must remain separate from test design quality.

Rules:

- Execution evidence does not alter review score.
- Execution evidence does not alter test cases.
- Execution evidence is used as an input to deterministic readiness.
- Execution result import must validate status, source, case ID, suite version, and duplicates.
- AI may summarize execution evidence only after deterministic normalization.

Known historical behavior:

```text
M16 delivered structured execution JSON submission through /api/execution-evidence.
```

Native Playwright/Postman/JUnit/Cypress parsing and CI/CD integrations are future scope unless explicitly implemented.

---

## Review and Readiness Boundary

Review and readiness are separate signals.

Review answers:

```text
How strong is the test design?
```

Readiness answers:

```text
Based on requirement, test design, review result, and execution evidence, what is the release risk signal?
```

Rules:

- Strong review score does not automatically mean ready.
- Missing execution evidence can produce insufficient data.
- Blocked execution can produce blocked readiness.
- Review score must not be changed by execution results.
- Readiness must not be calculated from AI explanation text.

---

## Provider Boundary

Release Signal may use AI providers behind an internal provider abstraction.

Rules:

- Provider-specific implementation must remain behind internal boundaries.
- Product logic must not depend on provider-specific free-form text.
- Provider output must be parsed and validated before use.
- Prompt text must not become a persistence contract.
- Adding or changing providers must not change artifact truth semantics.

---

## Architecture Blockers

An agent must stop and raise a blocker if a requested change would:

- move product truth into AI text
- move product truth into UI state
- bypass parsing or validation
- bypass artifact persistence rules
- change artifact contracts without approval
- change review scoring semantics without approval
- change release readiness semantics without approval
- mutate execution evidence into test design truth
- mutate existing billing/trial/credit state without approval
- require schema changes outside approved scope
- require dependency changes outside approved scope
- touch high-risk files without explicit scope

For milestone work, blockers should be captured as:

```text
.ai/milestones/M-{N}/blocker.md
```

---

## Final Architecture Rule

When in doubt, preserve this flow:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

ASCII equivalent:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

If a change cannot explain where truth lives in this flow, do not implement it.