---
type: prompt_templates
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: reusable_agent_prompts
status: active
inherits:
  - AGENTS.md
  - docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
  - docs/ai/AI_SAFEGUARDS.md
  - docs/ai/AGENT_OPERATING_MODEL.md
  - docs/ai/MILESTONE_WORKFLOW.md
  - docs/ai/V1_ROADMAP_EXECUTION_RULES.md
---

# Release Signal Prompt Templates

This document contains reusable prompt templates for ChatGPT, Codex, Claude Code, and Gemini CLI when working on Release Signal.

These templates exist to keep agent behavior consistent, bounded, reviewable, and aligned with the Release Signal architecture rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

No prompt in this file may override `AGENTS.md`, the Consensus Decision Rule, or the approved governance files under `docs/ai/`.

---

## Usage Rules

Use these prompts as starting points.

Do not remove the architecture rule.

Do not remove forbidden actions.

Do not remove validation requirements.

Do not remove human approval gates.

Do not convert review prompts into implementation prompts.

Do not let any AI agent self-declare a decision final.

Before using a prompt, fill in the placeholders clearly.

If a placeholder is unknown, write:

```text
not assigned
```

or stop and clarify.

---

## Universal Bootstrap Prompt

Use this at the start of any AI-assisted Release Signal work session.

```text
Read AGENTS.md and all files under docs/ai/ first.

Confirm the following before continuing:

Role:
[ChatGPT | Codex | Claude Code | Gemini CLI]

Mode:
[planning | implementation | review | documentation | validation]

Milestone:
[M-{N} or "not assigned"]

Branch:
[branch name or "not assigned"]

Allowed scope:
[list approved files/directories or "not assigned"]

Forbidden actions:
[list actions this agent must not perform in this session]

Architecture confirmation:
I will preserve the Release Signal architecture rule:

AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Consensus confirmation:
I understand that no individual AI output is final. Final decisions require consolidation and human lead approval.
```

For implementation sessions, add:

```text
I will not edit files outside the approved scope.
I will stop and raise a blocker if the scope is insufficient.
I will report changed files, validation, risks, and follow-up recommendations.
```

---

## Template 1: ChatGPT Milestone Kickoff

Use this when starting a new Release Signal milestone.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as the Release Signal architecture lead and milestone planner.

Task:
Create a milestone kickoff plan for:
[roadmap item]

Context:
[paste relevant current state, branch, previous decisions, constraints]

Milestone:
[M-{N} or "not assigned"]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Consensus rule:
No individual AI recommendation is final. Produce a consolidated proposal for human approval.

Return a milestone kickoff with:

1. Milestone name
2. Business/product goal
3. Architecture boundary
4. Branch name
5. Milestone type
   [docs-only | bug-fix | feature | complex feature | refactor]
6. Allowed scope
7. Forbidden changes
8. High-risk files or areas
9. Acceptance criteria
10. Validation plan
11. Review plan
12. Rollback/risk notes
13. Codex implementation prompt if applicable
14. Claude review prompt if applicable
15. Gemini review prompt if applicable

Do not:
- implement code
- broaden scope
- introduce V2 concepts
- move product truth into AI text or UI-only state
- claim the milestone is approved before human approval
```

---

## Template 2: Codex Implementation

Use this when Codex is the active implementation agent.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as the Codex implementation agent for Release Signal.

Mode:
implementation

Milestone:
[M-{N}]

Branch:
[branch name]

Task:
[exact implementation task]

Allowed scope:
[list files/directories Codex may edit]

Forbidden changes:
[list explicit forbidden changes]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Consensus rule:
No individual AI output is final. Do not treat your own implementation as approved for merge.

Implementation rules:
- Edit only files in the approved scope.
- Do not perform broad refactors.
- Do not mix unrelated cleanup with this task.
- Do not add dependencies unless explicitly approved.
- Do not change database schema unless explicitly approved.
- Do not change artifact contracts unless explicitly approved.
- Do not change billing, credit, trial, readiness, review, or artifact behavior outside the task.
- Stop and raise a blocker if scope is insufficient.

Validation required:
- Run npm run build for application code changes.
- Run targeted validation relevant to the changed files.
- For docs-only changes, run git diff --stat and inspect the changed docs.

Return exactly:

1. Summary
2. Files changed
3. Behavior changed
4. Behavior explicitly not changed
5. Commands run
6. Validation result
7. Risks
8. Recommended next step

If you cannot run validation, state why clearly.

Do not push.
Do not merge.
Do not rebase.
Do not delete branches.
```

---

## Template 3: Claude Code Architecture Review

Use this when Claude Code is reviewing a branch, diff, or proposed implementation.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as Claude Code in review-only mode for Release Signal.

Mode:
review only

Milestone:
[M-{N} or "not assigned"]

Branch:
[branch name]

Review target:
[paste diff, file list, PR summary, or implementation report]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Consensus rule:
No individual AI output is final. Your review is advisory until consolidated and approved by the human lead.

Review focus:
- scope compliance
- architecture rule compliance
- artifact ownership safety
- billing/trial/credit determinism
- UI/business-logic boundary
- high-risk file safety
- hidden coupling
- broad refactor risk
- validation completeness
- merge readiness

Check against:
- AGENTS.md
- docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
- docs/ai/AI_SAFEGUARDS.md
- docs/ai/AGENT_OPERATING_MODEL.md
- docs/ai/MILESTONE_WORKFLOW.md
- docs/ai/V1_ROADMAP_EXECUTION_RULES.md when V1 work is involved

Return only:

1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes

Do not:
- rewrite the implementation from scratch
- apply patches
- broaden the scope
- introduce alternative architecture unless the current approach is unsafe
- approve if product truth moved into AI text or UI-only state
```

---

## Template 4: Gemini CLI Large-Context Review

Use this when Gemini CLI is reviewing docs, roadmap consistency, large-context repo impact, onboarding copy, landing page copy, or broad scope.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as Gemini CLI in large-context review mode for Release Signal.

Mode:
analysis / review only

Milestone:
[M-{N} or "not assigned"]

Branch:
[branch name]

Review target:
[paste docs, file list, scope, copy, roadmap section, or implementation summary]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Consensus rule:
No individual AI output is final. Your review is advisory until consolidated and approved by the human lead.

Review focus:
- documentation consistency
- terminology drift
- roadmap boundary drift
- unsupported feature claims
- missing context
- overengineering
- unclear handoff or ownership
- contradiction with approved governance files
- V1/V2 scope separation
- public-facing copy accuracy if applicable

Check against:
- AGENTS.md
- docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
- docs/ai/AI_SAFEGUARDS.md
- docs/ai/AGENT_OPERATING_MODEL.md
- docs/ai/MILESTONE_WORKFLOW.md
- docs/ai/V1_ROADMAP_EXECUTION_RULES.md

Return only:

1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes

Do not:
- rewrite from scratch
- apply patches
- introduce new governance rules without consensus
- claim planned features are implemented
- convert future roadmap ideas into current scope
```

---

## Template 5: ChatGPT Consolidation After Reviews

Use this after receiving Claude and Gemini feedback.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as ChatGPT, the Release Signal consolidation partner.

Task:
Consolidate the following review feedback into one final decision.

Input:
- Original candidate:
[paste summary or file name]
- Claude Code review:
[paste review]
- Gemini CLI review:
[paste review]
- Human lead preference or decision:
[paste if available]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Consensus rule:
No individual AI output is final. The final decision must be consolidated and approved by the human lead.

Return:

1. Consensus result
2. Accepted changes
3. Rejected or deferred changes, with reason
4. Exact edits to apply
5. Whether human approval is still required
6. Next command or next file

Do not:
- treat the most recent AI answer as final
- accept overengineering by default
- reject safety findings without explaining why
- expand the task beyond the reviewed artifact
```

---

## Template 6: Blocker Report

Use this when any agent must stop.

```text
Read AGENTS.md and docs/ai/*.md first.

Create a blocker report for Release Signal.

Milestone:
[M-{N}]

Branch:
[branch name]

Agent:
[ChatGPT | Codex | Claude Code | Gemini CLI]

Blocker type:
[scope | architecture | artifact contract | billing/credit/trial | validation | dependency | roadmap | unknown]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Return this blocker in markdown:

# Blocker: [short title]

## Milestone

[M-{N}]

## Branch

[branch name]

## Agent

[agent]

## Blocker Type

[type]

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

[explicitly state what was not modified]
```

The agent must stop after producing the blocker.

Implementation may continue only after the human lead resolves the blocker.

---

## Template 7: Scope Amendment Request

Use this when the task requires expanding approved scope.

```text
Read AGENTS.md and docs/ai/*.md first.

Create a scope amendment request for Release Signal.

Milestone:
[M-{N}]

Branch:
[branch name]

Current approved scope:
[list current files/directories]

Requested additional scope:
[list new files/directories or behavior areas]

Reason:
[why current scope is insufficient]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Return:

1. Requested scope change
2. Why current scope is insufficient
3. Risk assessment
4. Alternatives considered
5. Validation impact
6. Whether this touches high-risk areas
7. Recommendation

Do not implement the expanded scope until the human lead approves it.
```

---

## Template 8: V1 Trial Initialization Kickoff

Use this when starting V1 Milestone 1.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as the Release Signal architecture lead.

Create the milestone kickoff for:

V1 Milestone 1: Trial Initialization

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Known approved V1 trial direction:
- trial duration: 15 days
- starting credits: 100
- planCode: trial_v1
- subscription status: trialing
- seats: 1
- grant reason: trial_grant
- existing organizations must not be reset or silently backfilled
- repeated login must not duplicate trial grants
- use existing Subscription + CreditWallet + CreditLedger if available
- no Stripe/Lemon Squeezy integration
- no UI work
- no /api/chat enforcement yet
- no broad refactor

Return:

1. Milestone goal
2. Branch name
3. Expected files
4. Forbidden changes
5. Acceptance criteria
6. Validation plan
7. High-risk areas
8. Codex implementation prompt
9. Claude review prompt
10. Gemini review need, if any

Do not implement code.
Do not introduce UI work.
Do not introduce provider billing.
Do not mutate existing organizations.
```

---

## Template 9: V1 Credit Consumption Guard Kickoff

Use this before implementing credit spending/enforcement.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as the Release Signal architecture lead.

Create the milestone kickoff for:

V1 Credit Consumption Guard

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Before implementation, define:

- which AI-triggering actions cost credits
- cost per action
- whether deduction happens before or after provider call
- failed provider call charge/refund policy
- duplicate request/idempotency behavior
- insufficient credit response
- UI behavior when blocked
- ledger reason/request identifier
- validation plan

Return:

1. Milestone goal
2. Branch name
3. Required decisions before coding
4. Allowed scope
5. Forbidden changes
6. Acceptance criteria
7. Validation plan
8. High-risk areas
9. Codex implementation prompt only after decisions are complete

Do not implement code.
Do not guess cost policy.
Do not allow AI text to decide billing or credit behavior.
```

---

## Template 10: Closure Message

Use this when a milestone is complete and validated.

```text
Read AGENTS.md and docs/ai/*.md first.

Act as the Release Signal closure writer.

Prepare a closure message for:

Milestone:
[M-{N} / name]

Branch:
[branch name]

Commits:
[paste commits]

Files changed:
[paste files]

Validation:
[paste commands/results]

Architecture rule:
AI -> parsed -> structured artifacts -> deterministic system logic -> UI

Return:

1. Status
2. Branch
3. Scope delivered
4. Files changed
5. Validation completed
6. Architecture confirmation
7. Explicitly not implemented
8. Risks or follow-ups
9. Next recommended step

Do not:
- claim unvalidated behavior is validated
- hide failed/skipped checks
- claim future scope is complete
- declare final approval without human lead approval
```

---

## Template 11: Docs-Only Governance Review

Use this for remaining governance file reviews.

```text
Review only. Do not rewrite from scratch.

This is the consolidated candidate for:
[file path]

It must align with:
- AGENTS.md
- docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
- docs/ai/AI_SAFEGUARDS.md
- docs/ai/AGENT_OPERATING_MODEL.md
- docs/ai/MILESTONE_WORKFLOW.md
- docs/ai/V1_ROADMAP_EXECUTION_RULES.md

Check for:
- contradiction with the Consensus Decision Rule
- contradiction with Release Signal architecture:
  AI -> parsed -> structured artifacts -> deterministic system logic -> UI
- missing safeguards
- overengineering
- unsupported implementation claims
- unsafe agent behavior
- unclear human approval gates
- broad-refactor loopholes

Return only:
1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes
```

---

## Final Prompt Rule

Every prompt used for Release Signal should preserve this operating model:

```text
ChatGPT plans and consolidates.
Codex implements.
Claude Code reviews architecture and risk.
Gemini CLI reviews large context and documentation consistency.
Human lead approves.
```

Every prompt must preserve this architecture rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

If a prompt would allow an agent to bypass scope, validation, blocker handling, or human approval, do not use it.