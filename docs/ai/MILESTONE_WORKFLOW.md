---
type: milestone_workflow
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: milestone_execution
status: active
inherits:
  - AGENTS.md
  - docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
  - docs/ai/AI_SAFEGUARDS.md
  - docs/ai/AGENT_OPERATING_MODEL.md
---

# Release Signal Milestone Workflow

This document defines the standard kickoff-to-merge workflow for Release Signal milestones.

It exists to keep milestone execution bounded, reviewable, reversible, and aligned with the core architecture rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

No milestone may override `AGENTS.md` or the Consensus Decision Rule.

---

## Milestone Workflow Principles

Every milestone should be:

- scoped before implementation
- assigned to one active editing agent at a time
- protected from broad refactors
- validated before commit
- reviewed before merge
- closed with a clear summary
- reversible if the change causes regression

The workflow should be strict enough to protect architecture, but not so heavy that small documentation or bug-fix tasks become blocked by unnecessary process.

---

## Milestone Types

### Documentation-Only Milestone

Examples:

- governance docs
- roadmap docs
- closure docs
- setup guides
- prompt templates

Rules:

- must not touch application logic
- may touch docs and `.ai/` governance artifacts
- should run `git diff --stat`
- may run `npm run build` before merge if desired
- does not require full product regression unless docs alter operational commands

---

### Bug-Fix Milestone

Examples:

- one broken workflow
- one validation bug
- one UI display bug
- one persistence regression

Rules:

- default blast radius: 3 files
- fix only the concrete bug
- do not perform cleanup-only work
- do not add future roadmap scope
- validate the failing scenario
- run `npm run build` for application code

---

### Feature Milestone

Examples:

- trial initialization
- credit display
- onboarding flow
- landing page
- credit consumption guard

Rules:

- default blast radius: 5 files
- must define acceptance criteria
- must define forbidden changes
- must validate success and failure paths
- must not mutate unrelated artifacts or existing data
- must not introduce broad refactors

---

### Complex Feature Milestone

Examples:

- credit enforcement across AI routes
- billing/subscription behavior
- Auth0 organization lifecycle changes
- release readiness semantic changes
- artifact contract changes

Rules:

- default blast radius: 10 files only with explicit approval
- requires high-risk review
- requires clear rollback plan
- may require manual regression checklist
- may require Gemini broad-context review
- Claude Code review is strongly recommended

---

### Refactor Milestone

Examples:

- M18-style file-size reduction
- service extraction
- hook decomposition
- route boundary cleanup

Rules:

- must have dedicated branch
- must not mix with feature work
- must preserve behavior
- must define safe seams before editing
- must validate immediately after each bounded extraction
- must not change artifact contracts unless explicitly approved

---

## Standard Milestone Flow

### Phase 1: Kickoff

Owner:

```text
ChatGPT + human lead
```

Inputs:

- roadmap item
- current branch state
- relevant previous decisions
- known risks
- existing architecture rules

Outputs:

- milestone goal
- branch name
- allowed scope
- forbidden changes
- acceptance criteria
- validation plan
- high-risk areas
- rollback considerations
- review plan

Kickoff must answer:

```text
What are we changing?
What are we explicitly not changing?
Where does product truth live?
Which files or areas may be touched?
What would make this unsafe?
How do we validate it?
```

No implementation should begin before kickoff scope is clear.

---

### Phase 2: Branch Preparation

Owner:

```text
human lead or active implementation agent when explicitly instructed
```

Start from latest `master` unless continuing an approved existing branch:

```bash
git checkout master
git pull origin master
git checkout -b feature/[milestone-name]
```

For documentation/governance work, use a docs branch:

```bash
git checkout master
git pull origin master
git checkout -b docs/[docs-task-name]
```

Rules:

- never work directly on `master`
- never create a broad branch name like `feature/product-readiness`
- branch name must reflect one bounded task
- confirm `git status` after branch creation

---

### Phase 3: Scope Confirmation

Owner:

```text
active agent + human lead
```

Before editing, confirm:

- milestone type
- branch name
- files/directories allowed
- files/directories forbidden
- high-risk files involved
- validation commands
- active editing agent
- review agents
- blocker path if needed

If scope is unclear, stop and clarify.

If a high-risk file is involved, document why.

---

### Phase 4: Implementation

Owner:

```text
usually Codex
```

Implementation rules:

- edit only approved files
- do not expand scope silently
- do not perform broad refactors
- do not mix cleanup with feature work
- do not add dependencies unless explicitly approved
- do not change database schema unless explicitly approved
- stop if artifact contracts must change unexpectedly
- stop if implementation would violate architecture rules

For docs-only work:

- keep docs aligned with existing approved decisions
- do not claim future scope is implemented
- do not edit app logic

For application work:

- preserve existing behavior outside the milestone
- update tests if an existing focused test pattern is available
- validate locally where possible

---

### Phase 5: Agent Implementation Report

Owner:

```text
active implementation agent
```

Implementation report must include:

```text
1. Summary
2. Files changed
3. Behavior changed
4. Behavior explicitly not changed
5. Commands run
6. Validation result
7. Risks
8. Recommended next step
```

If validation could not be run, state why.

Do not say "done" without changed files and validation status.

---

### Phase 6: Local Review

Owner:

```text
human lead + ChatGPT
```

Run:

```bash
git status
git diff --stat
git diff
```

For documentation-only milestones, inspect changed docs.

For application milestones, inspect changed code and run required validation.

Check:

- scope respected
- no unrelated files changed
- no accidental formatting-only blast radius
- no high-risk file touched unexpectedly
- no artifact contract changed unexpectedly
- no future roadmap scope introduced
- no product truth moved into AI text or UI-only state

---

### Phase 7: High-Risk Review

Owner:

```text
Claude Code review-first
```

Required when touching:

- high-risk files listed in `AGENTS.md`
- high-risk files listed in `AI_SAFEGUARDS.md`
- billing, trials, credits, wallets, subscriptions
- Auth0 organization/user creation
- artifact contracts
- review scoring
- release readiness
- AI provider execution
- session ownership or authorization
- database schema or migrations

Claude Code should return:

```text
1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes
```

If Claude raises a blocker, implementation stops until the human lead resolves it.

---

### Phase 8: Consistency Review

Owner:

```text
Gemini CLI when needed
```

Use Gemini CLI when:

- the change touches broad documentation
- product terminology may drift
- onboarding/landing-page copy needs consistency
- roadmap references are updated
- milestone scope may affect many files
- large-context review is useful

Gemini CLI should return:

```text
1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes
```

Gemini should not rewrite from scratch unless explicitly asked.

---

### Phase 9: Fix Pass

Owner:

```text
usually Codex
```

Rules:

- fix only approved review findings
- do not add extra cleanup
- do not expand scope
- rerun relevant validation
- report changed files and validation result again

If a fix requires additional scope, stop and raise a blocker or scope amendment.

---

### Phase 10: Final Validation

Owner:

```text
human lead + active agent
```

Minimum commands for application code:

```bash
npm run build
```

Recommended commands before merge:

```bash
git status
git diff --stat
```

For QA harness changes, when `/qa` exists and the app is running:

```bash
cd qa
npm run smoke
npm run regression
```

Expected QA behavior:

- skipped tests may be acceptable when seeded session IDs are missing
- failing tests are not acceptable
- failures must be investigated or explicitly deferred

For documentation-only milestones:

```bash
git status
git diff --stat
git diff -- [changed docs]
```

Build may still be run before merge if the human lead wants a clean baseline.

---

### Phase 11: Commit

Owner:

```text
human lead unless explicitly delegated
```

Commit only approved files.

Before commit:

```bash
git status
git diff --stat
```

Example commit messages:

```text
docs(ai): add shared agent operating model
docs(ai): add release signal architecture rules
feat(v1): add trial initialization
fix(v1): guard credit balance lookup
refactor(m18): extract workspace health card
```

Rules:

- one commit scope
- no unrelated files
- no unapproved generated files
- no temporary inspection files
- no local secrets
- no `.env` files

---

### Phase 12: Push

Owner:

```text
human lead unless explicitly delegated
```

Push only after the human lead approves:

```bash
git push origin [branch-name]
```

Do not push automatically.

Do not force-push unless explicitly approved.

---

### Phase 13: Merge

Owner:

```text
human lead
```

Merge only after:

- scope is respected
- validation passes
- high-risk review is complete if needed
- blockers are resolved
- human lead approves

Merge pattern:

```bash
git checkout master
git pull origin master
git merge --no-ff [branch-name] -m "merge(scope): concise summary"
npm run build
git push origin master
```

Example:

```bash
git merge --no-ff docs/ai-agent-operating-model -m "merge(docs): add shared AI governance model"
```

If build fails after merge, stop and resolve before pushing.

---

### Phase 14: Closure

Owner:

```text
ChatGPT + human lead
```

Closure summary must include:

- status
- branch
- commits
- files changed
- scope delivered
- validation completed
- explicitly not implemented
- risks or follow-ups
- next recommended step

Closure should be honest.

Do not claim future scope is complete.

Do not hide skipped or failed validation.

---

## Blocker Handling

If a blocker appears at any phase:

1. stop implementation
2. document the blocker
3. identify affected rules
4. identify affected files
5. present options
6. wait for human lead decision

For milestone work, blocker file:

```text
.ai/milestones/M-{N}/blocker.md
```

Use the blocker template from:

```text
docs/ai/AI_SAFEGUARDS.md
```

Do not proceed by guessing.

---

## Scope Amendment Handling

A scope amendment is required when:

- new files outside approved scope are needed
- dependency changes are needed
- database/schema changes are needed
- artifact contracts must change
- high-risk files must be touched unexpectedly
- feature semantics need to change
- roadmap boundaries need to shift

Scope amendment must include:

- requested scope change
- why current scope is insufficient
- risk assessment
- alternatives considered
- validation impact

The human lead must approve the amendment before implementation continues.

---

## Milestone Artifact Folder

Milestone-specific artifacts may live under:

```text
.ai/milestones/M-{N}/
```

Possible files:

- `spec.md`
- `scope.md`
- `blocker.md`
- `review.md`
- `qa.md`
- `closure.md`

These files support traceability but are not required for every small task.

Do not overuse milestone artifacts for trivial changes.

---

## Docs-Only Governance Milestone Pattern

For governance docs like this branch:

```text
docs/ai-agent-operating-model
```

Use the following lightweight flow:

1. branch from latest `master`
2. update `AGENTS.md`
3. create/update `docs/ai/*.md`
4. review each file with Gemini and Claude when appropriate
5. consolidate findings through ChatGPT
6. apply only approved changes
7. run `git status`
8. run `git diff --stat`
9. optionally run `npm run build`
10. commit docs-only changes
11. merge with non-fast-forward merge

No application logic should be changed.

---

## V1 Product-Readiness Milestone Pattern

For V1 work such as trials, credits, onboarding, landing page, domain, and Cloudflare protection:

1. start with a ChatGPT milestone kickoff
2. define server-side truth boundary
3. define user-facing behavior
4. define forbidden changes
5. define validation plan
6. use Codex for implementation
7. require Claude review for billing/trial/credit/auth/high-risk code
8. use Gemini review for onboarding/landing/domain docs/copy consistency
9. validate locally
10. merge only after human approval

V1 product-readiness work must preserve:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

Public launch protection must include both:

- application-level enforcement
- deployment/edge protection where applicable

Cloudflare or domain setup does not replace server-side billing, credit, or authorization enforcement.

---

## Final Rule

A milestone is not done when an AI says it is done.

A milestone is done when:

- scope is delivered
- validation passes or exceptions are explicit
- architecture rules are preserved
- review findings are resolved
- human lead approves closure

The Release Signal workflow remains:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```