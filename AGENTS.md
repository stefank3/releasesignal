# AGENTS.md — Release Signal Agent Instructions

## Purpose

This file defines the working rules for Codex or any coding agent operating inside the Release Signal repository.

Read this file before making changes.

If these instructions conflict with inferred codebase patterns, follow this file and ask the human before acting.

---

## Product Overview

Release Signal is a QA intelligence and release-risk platform.

It helps QA professionals move from raw requirements and test plans toward structured, reviewable, evidence-backed release decisions.

The current product is aimed at senior/intermediate QA professionals, QA leads, and technically strong testers who need better requirement analysis, test design review, execution evidence, and release-risk visibility.

Release Signal is not currently:

- a full test management replacement
- a TestRail/Qase/Xray/Zephyr clone
- a native automation-code-generation platform
- a Playwright generator
- a billing/subscription platform
- a full enterprise release governance product

Current category:

```text
QA intelligence workspace / release-risk reporting layer
```

The product is moving toward a high-tech QA intelligence layer that can sit before, around, or above traditional test management tools.

---

## Non-Negotiable Architecture Rule

```text
AI → parsed → structured artifacts → deterministic system logic → UI
```

AI may:

- assist
- generate
- clarify
- explain
- suggest improvements

Structured artifacts own product truth.

Deterministic services own:

- workflow decisions
- review scoring
- artifact validation
- file ingestion
- export logic
- execution evidence validation
- release readiness calculation

UI must:

- render artifact-backed state
- trigger explicit user actions
- never own product truth

Never allow:

- free-form AI text to own workflow truth
- chat history to become artifact truth
- UI-only state to become business truth
- unvalidated model output to drive scoring
- AI to decide release readiness
- AI to own execution truth
- prompts to become persistence contracts

If a proposed change moves truth, scoring, release decisions, execution truth, artifact state, or workflow control into AI text, UI state, or chat history, stop and ask.

---

## Technical Stack

Release Signal uses:

- Next.js / React / TypeScript
- Next.js API routes
- Auth0 authentication
- Prisma / database-backed persistence
- structured session artifacts
- AI provider abstraction with OpenAI currently behind internal boundaries
- Vercel-style deployment expected for production

The product is built around persisted session artifacts and deterministic service modules. Components render artifact-backed state. They do not own it.

---

## Core Artifacts

### RefinedRequirement

Structured QA-ready requirement derived from raw input.

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

### TestSuiteArtifact

Structured test plan / test suite.

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

### PersistedReviewResult

Deterministic review of test design quality.

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

### ExecutionIntelligenceArtifact

Stores observed execution outcomes.

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

### ReleaseReadinessSummary

Derived deterministic release-readiness signal from current artifacts.

Inputs:

```text
RefinedRequirement
+ TestSuiteArtifact
+ PersistedReviewResult
+ ExecutionIntelligenceArtifact
```

Statuses:

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

---

## Completed Milestones

### M14 — File-Based Suite Ingestion — COMPLETE

Delivered:

- TXT suite upload
- structured MD suite upload
- review-mode upload gating
- deterministic parsing
- fail-closed ingestion
- SessionArtifact.testSuite creation

Rule enforced:

```text
One workspace = one test target.
Upload blocked if suite exists.
No overwrite.
No merge.
No hidden mutation.
```

Not included:

- CSV import
- JSON suite upload
- Qase/TestRail/Xray/Zephyr import
- merge/append upload

### M15 — Generic JSON/CSV Export Layer — COMPLETE

Delivered:

- generic JSON export
- generic CSV export
- export from persisted SessionArtifact.testSuite
- deterministic filenames
- metadata
- ownership protection
- read-only export
- no artifact mutation
- deterministic fallback parser for edited cases with body labels

Correct positioning:

```text
Export Release Signal test suites as clean JSON/CSV for sharing, documentation, migration, or manual mapping.
```

Do not claim:

- direct TestRail export
- direct Qase export
- direct Xray export
- direct Zephyr export
- guaranteed external-tool compatibility

### M16 — Execution Evidence / Import Results Layer — COMPLETE

Delivered:

- `/api/execution-evidence` endpoint
- deterministic validation and normalization
- suite version linking
- session ownership protection
- duplicate result rejection
- empty result rejection
- unknown case ID warnings
- suite version mismatch rejection
- ExecutionIntelligenceArtifact persistence
- Workspace Execution Evidence card

Not included:

- native Playwright/Postman/JUnit/Cypress parsing
- CI/CD integration
- AI-based interpretation

### M17 — Release Readiness Dashboard / Reporting — COMPLETE

Delivered:

- deterministic readiness rules/service
- derived ReleaseReadinessSummary
- collapsed/expandable Release Readiness Report panel
- readiness statuses
- confidence level
- reasons
- warnings
- recommended actions
- artifact input visibility
- review gap surfacing

Validated behavior:

- missing execution evidence shows Insufficient Data even with strong review score
- blocked execution evidence shows Blocked
- review score, execution evidence, and TestSuiteArtifact are never mutated

Not included:

- AI-based release decisions
- numeric readiness score
- persisted readiness history
- native adapters
- tool integrations
- CI/CD

---

## M18 Closure State

M18 is the V1 stabilization milestone after M14–M17.

Milestone:

```text
M18 — Architecture Cleanup / File Size Reduction / Bug Fixing / AI-Assisted Refactor Pass
```

Status:

```text
Complete, pending only normal post-merge final regression confirmation if one last manual/automated pass is desired.
```

Latest recorded master:

```text
fd3eadc docs(m18): update refactor inventory execution status
```

M18 achieved its objective:

- stabilized the V1 architecture after M14–M17
- reduced safe file bloat
- fixed known workflow-quality defects
- documented high-risk deferrals honestly
- avoided risky refactors just to reduce line count

Architecture rule preserved:

```text
AI → parsed → structured artifacts → deterministic system logic → UI
```

No workflow truth, review score, release decision, artifact state, execution result, or readiness status was moved into free-form AI text or UI-owned logic.

---

## Completed M18 Work

### M18.0 — Refactor Inventory and Execution Plan

Status: complete.

Codex inventory was accepted as a baseline, but implementation order was corrected.

Decision:

```text
Do not start with broad app/api/chat/route.ts extraction.
It is high-risk and controls the primary product path.
```

### M18.1a — Cases Card UI Controls Extraction

Status: complete.

CasesTextCard.tsx UI controls were extracted into a dedicated component.

### M18.1b — Cases Card Overview Helper Extraction

Status: complete.

Case overview/helper logic was extracted from CasesTextCard.tsx.

### M18.2 — Release Health vs Release Readiness Decision

Status: complete.

Decision:

```text
Release Readiness = primary V1 release decision/reporting surface.
Workspace Health = compact workspace context signal.
```

No status semantics, persisted contracts, or dashboard architecture were changed.

### M18.2a — Workspace Health Wording Clarification

Status: complete.

UI label changed from Release Health to Workspace Health.

This was wording only:

- no logic changed
- no status semantics changed
- no artifact contracts changed

### M18.3 — Structured Field Persistence Hardening

Status: complete.

Edited/saved test cases now preserve or deterministically rehydrate structured fields more safely.

Protected fields:

- type
- priority
- preconditions
- steps
- expectedResults
- tags
- notes

This supports correct JSON/CSV export behavior.

### M18.4 — Improve Test Plan Preservation Hardening

Status: complete.

Bad behavior before fix:

```text
33 cases → 14 cases
87/100 → 82/100
```

Fixes delivered:

- Improve / Regenerate renamed to Improve Test Plan
- prompt made preservation-first
- full existing suite content added to Improve context
- deterministic shrink guard added
- unsafe replacement rejected if generated suite is less than 80% of existing case count

Validated behavior:

```text
22 tests → 22 tests
90/100 → 90/100
```

Action semantics:

```text
Generate Tests = create new suite
Next Batch = append-only expansion
Improve Test Plan = preserve + enhance + clarify + fill gaps
Regenerate Test Plan = future separate destructive/restructure action
```

### M18.5 — Server/Service Boundary Review

Status: complete.

Decisions:

- no broad route.ts extraction in M18
- no artifactUpdateService split in M18
- export and execution evidence routes are acceptable
- route.ts remains known high-risk and deferred

### M18.6 — Hook/Session Review and Label Cleanup

Status: complete.

useChatSession.ts remains large but was classified.

Safe cleanup completed:

- Improve / Regenerate Suite unavailable → Improve Test Plan unavailable
- Improve / Regenerate Suite failed → Improve Test Plan failed

### M18.7a — WorkspaceHealthCard Extraction

Status: complete.

FeatureWorkspaceSummary.tsx reduced from approximately:

```text
861 lines → 741 lines
```

New component:

```text
app/chat/components/workspace/WorkspaceHealthCard.tsx
```

Artifact-derived logic stayed in the parent. The extracted component is presentational only.

### M18.7b — useChatSession Artifact Helper Extraction

Status: complete.

Extracted from:

```text
app/chat/hooks/useChatSession.ts
```

into:

```text
app/chat/hooks/useChatSession.artifacts.ts
```

Moved helpers:

- shouldApplyIncomingArtifact
- pruneStaleReviewItems
- pruneLiveStaleReviewItems

This preserved artifact freshness and stale-review safety.

### M18.7c — Refine Requirement Fail-Closed Regression Fix

Status: complete.

Bug found during regression:

```text
Refine Requirement on an existing refined requirement could return ok:true
with "I couldn't format the coach output this time. Please retry."
```

Fix delivered:

- Refine Requirement no longer treats coach-formatting failure as success
- requirement rendering no longer depends unnecessarily on coachParsed
- invalid model output fails closed with clear error
- existing artifact is kept unchanged

This protects artifact-driven workflow.

### M18 Inventory Status Update

Status: complete.

`docs/m18-refactor-inventory.md` reflects:

- what was done
- what was deferred
- why refactoring stops unless final regression exposes a concrete bug

---

## Explicit M18 Deferrals

The following remain known oversized or high-risk and are not being further refactored in M18:

- `app/api/chat/route.ts`
- `app/chat/hooks/useChatSession.ts`
- `lib/chat/artifact.ts`
- `lib/server/chat/artifactUpdateService.ts`
- `app/api/chat/history/[sessionId]/route.ts`
- `lib/server/chat/testSuiteService.ts`

Reason:

These files are close to workflow orchestration, artifact persistence, stale-state invalidation, parsing contracts, or product-truth behavior.

Further extraction requires dedicated bounded tickets with full regression validation.

Do not pretend these files are solved.

Do not continue refactoring them in M18 unless a concrete regression requires a targeted fix.

---

## Not Included in M18 Final Regression

These are not part of current M18 final regression because they are not active/current UI scope:

- Upload TXT suite
- Upload structured MD suite
- Execution result file upload / translator

Future scope remains:

- Execution Result Upload Translator
- Release Signal execution JSON upload
- Generic execution CSV upload
- Optional JUnit XML only if explicitly scoped

This belongs to future V1.1/V2 work, not M18.

---

## M18 Final Regression Checklist

Use this as the final M18 closure validation list:

1. Refine Requirement on existing refined requirement
2. Generate Tests
3. Review Test Suite
4. Improve Test Plan
5. Generate Next Batch
6. Edit/save a test case and confirm structured fields persist
7. Export JSON
8. Export CSV
9. Execution Evidence structured/API import
10. Release Readiness panel
11. Workspace Health card
12. Session switch
13. Page refresh / artifact rehydration
14. Requirement refinement invalidates stale review

Closure rule:

```text
If all pass, M18 is closed.
If something fails, fix only the concrete regression.
No more refactoring or cleanup in M18.
```

---

## Current Roadmap

```text
V1.0  = M14–M17 feature foundation + M18 stabilization
V1.1  = Commercial/product readiness
V1.2+ = Additional bounded product capabilities
V2    = Deeper integrations and automation intelligence
```

### V1.1 future scope

May include:

- domain setup
- onboarding/demo polish
- simple subscription/usage tracking
- possible execution result upload translator

### V2 future scope

May include:

- Qase/TestRail/Xray/Zephyr interoperability
- Automation Candidate Analysis
- native execution report adapters
- Playwright/API/Postman draft generation
- CI/CD integration
- team/project model
- advanced dashboards
- historical readiness
- enterprise governance

Do not implement, scaffold, or anticipate V1.1/V2 concepts during M18 or unrelated tasks unless explicitly approved.

---

## High-Risk Files — Do Not Touch Without Explicit Approval

| File | Why risky | Disposition |
|---|---|---|
| `app/api/chat/route.ts` | Controls workflow routing, prompt construction, model execution, persistence, telemetry | Deferred. Any extraction requires specific seam approval. |
| `app/chat/hooks/useChatSession.ts` | Session state, workflow execution, send flow, artifact freshness | Core remains deferred. Only approved bounded helper extraction is allowed. |
| `lib/chat/artifact.ts` | Product-truth contract layer | Deferred. Do not split casually. |
| `lib/server/chat/artifactUpdateService.ts` | Stale-state invalidation and artifact persistence | Deferred. Do not split casually. |
| `app/api/chat/history/[sessionId]/route.ts` | Session history behavior | Deferred. |
| `lib/server/chat/testSuiteService.ts` | Test-suite generation/service behavior | Deferred. |

---

## General Agent Rules

Never work directly on master.

Use:

```text
one branch
one ticket
one bounded change
one commit scope
validate before moving on
```

Before making any change:

1. State which file(s) will be changed.
2. State what behavior is being preserved.
3. State the validation steps to run.
4. Confirm the task is not excluded scope.
5. Confirm the task does not touch high-risk files without explicit approval.

After making any change:

1. Run relevant validation.
2. Run `npm run build` when application code changes.
3. Run the relevant QA suite if `/qa` exists and the task affects UI/workflow behavior.
4. List all changed files.
5. Do not push unless explicitly instructed.

Never:

- modify files not explicitly included in the task
- perform broad refactors
- rewrite large files from scratch
- change artifact contracts
- change deterministic review scoring
- change execution evidence semantics
- move readiness logic into UI
- move product truth into AI text
- scaffold V2 concepts
- combine unrelated changes in one commit

Git safety:

- Do not push to remote unless explicitly instructed.
- Do not merge branches unless explicitly instructed.
- Do not delete local or remote branches unless explicitly instructed.
- Do not rebase unless explicitly instructed.
- All implementation tickets must start from latest master unless explicitly continuing an approved existing branch.

---

## Codex-Specific Rules

For QA framework tasks:

- only create or modify files under `/qa` unless explicitly approved
- do not modify `app/`, `lib/`, `prisma/`, root `package.json`, root configs, or existing app source
- after the task, run `git diff --stat`
- confirm only `/qa` files changed
- do not push
- do not merge

For M18 closure/final regression:

- do not start more refactoring
- if a regression is found, fix only the concrete regression
- no more cleanup-only work in M18

---

## Build and Validation

Application build:

```bash
npm run build
```

If `/qa` Playwright framework exists:

```bash
cd qa
npm run smoke
npm run regression
```

Expected QA behavior:

- skipped tests are acceptable when required seeded session IDs are missing
- failing tests are not acceptable
- no app source files should be changed by the `/qa` test harness task

---

## Final M18 Assessment

M18 was successful.

It delivered:

- real bug fixes
- real file-size reductions
- artifact-safety improvements
- clear product semantics
- clear high-risk deferrals
- no architecture drift

Most important outcomes:

- Improve Test Plan is now safe
- structured test-case fields are better preserved
- Workspace Health vs Release Readiness is clarified
- Refine Requirement fails closed instead of returning false success
- useChatSession and FeatureWorkspaceSummary were reduced safely
- M18 inventory reflects reality
