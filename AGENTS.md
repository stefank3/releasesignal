---
type: universal_governance
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: all_repo_work
status: active
---

# Release Signal AI Agent Instructions

This file is the universal entry point for all AI-assisted work in the Release Signal repository.

Every AI agent must read this file before planning, editing, reviewing, documenting, or validating repository work.

This is the repo-level operating contract.

Old product-specific context, milestone history, artifact details, roadmap history, and implementation notes are preserved in `docs/ai/` reference files. This root file stays focused on universal agent governance.

---

## Core Architecture Rule

Release Signal follows this non-negotiable architecture rule:

```text
AI → parsed → structured artifacts → deterministic system logic → UI
```

For scripts, prompts, and terminal checks, the ASCII equivalent is treated as the same rule:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

AI may assist with planning, coding, reviewing, documentation, summarization, and analysis.

AI must not become the source of product truth.

---

## Product Truth Rules

Structured data and deterministic logic are authoritative.

The following must never be controlled by free-form AI text:

- release readiness
- review scoring
- billing state
- trial state
- credit balance
- credit consumption
- workflow state
- artifact lifecycle
- access control
- organization ownership
- user entitlement
- persisted session truth

Deterministic server/client logic owns these decisions.

UI may display state and trigger actions, but UI must not own product truth.

AI output must be parsed, validated, normalized, and persisted into structured artifacts before it can influence system behavior.

---

## Consensus Decision Rule

ChatGPT, Claude Code, and Gemini CLI may each provide recommendations, but no individual AI output is final.

A decision becomes final only after the recommendations are consolidated into one Release Signal-specific rule set and approved by the human lead.

Once approved, all agents must follow that single decision and must not reinterpret or override it.

If an agent disagrees, it must stop and raise a blocker instead of implementing an alternative.

---

## Agent Responsibilities

### ChatGPT

Primary role:

- architecture lead
- milestone planner
- prompt writer
- consolidation partner
- closure-message writer
- decision-record assistant

ChatGPT is responsible for turning broad direction into scoped Release Signal work.

ChatGPT should not be treated as final authority unless the output is consolidated and approved by the human lead.

### Codex

Primary role:

- implementation agent
- focused code editor
- bounded bug-fix agent
- surgical refactor agent
- local validation runner

Codex may create or modify files only within the approved scope.

Codex must not expand scope silently.

### Claude Code

Primary role:

- architecture reviewer
- high-risk change reviewer
- refactor-risk challenger
- coupling and boundary reviewer

Claude Code is review-first by default.

Claude Code should not edit the same branch while Codex is actively editing unless the human lead explicitly assigns Claude Code as the active editing agent.

### Gemini CLI

Primary role:

- large-context analyzer
- documentation reviewer
- consistency reviewer
- product-readiness gap reviewer
- impact-analysis assistant

Gemini CLI is analysis/documentation-first by default.

Gemini CLI should not perform broad repository rewrites unless explicitly scoped and approved.

---

## Universal Agent Rules

All agents must follow these rules:

1. Work on one bounded ticket at a time.
2. Use one active editing agent per branch.
3. Do not perform broad refactors.
4. Do not mix unrelated cleanup with feature work.
5. Do not rename files, contracts, routes, or product concepts unless explicitly scoped.
6. Do not change artifact contracts unless explicitly approved.
7. Do not move deterministic logic into UI components.
8. Do not move product decisions into prompts.
9. Do not use free-form AI text as product truth.
10. Do not silently mutate existing users, organizations, subscriptions, wallets, credits, sessions, or artifacts.
11. Do not add dependencies unless explicitly scoped.
12. Do not change billing, credit, trial, readiness, review, or artifact behavior outside the approved milestone.
13. Do not edit files outside the approved scope without raising a scope blocker.

---

## One Active Editor Rule

Only one AI agent may edit repository files on a branch at a time.

Allowed:

```text
ChatGPT plans → Codex edits → Claude reviews → Codex fixes → Gemini reviews docs
```

Not allowed:

```text
Codex edits + Claude edits + Gemini edits on the same branch at the same time
```

Review agents may inspect and comment while another agent edits, but they must not modify files.

---

## Scope Discipline

Every task must have:

- branch name
- goal
- allowed files or allowed directories
- forbidden changes
- validation plan
- merge criteria

An agent must stop and raise a blocker when:

- the requested change requires files outside the approved scope
- a schema change appears necessary but was not approved
- a dependency change appears necessary but was not approved
- a task conflicts with the architecture rule
- a task conflicts with existing approved roadmap decisions

---

## Blast Radius Rule

Default blast radius limits:

| Task Type | Default Maximum Changed Files | Rule |
|---|---:|---|
| Documentation-only task | 10 | Must not touch app logic |
| Bug fix | 3 | Must be targeted |
| Normal feature | 5 | Must stay within approved scope |
| Complex feature | 10 | Requires explicit approval |
| Refactor milestone | Approved scope only | Requires dedicated branch |

Files under `.ai/milestones/` may be excluded from blast-radius counting when they are milestone artifacts only.

Exceeding the default file limit requires explicit approval from the human lead.

---

## High-Risk Areas

Extra review is required when touching:

- `app/api/chat/route.ts`
- `app/chat/hooks/useChatSession.ts`
- `lib/chat/artifact.ts`
- `lib/server/chat/artifactUpdateService.ts`
- artifact parsing or persistence services
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
- session ownership or authorization checks
- database schema or migrations

High-risk changes require at minimum:

- clear scope
- minimal diff
- build validation
- architecture review
- explicit human approval before merge

---

## Failure Mode

When an agent encounters ambiguity, contradiction, or a rule violation, it must stop.

The agent must not guess.

The agent must not implement an alternative.

The agent must report the blocker clearly.

For milestone work, the blocker should be captured as:

```text
.ai/milestones/M-{N}/blocker.md
```

The blocker must include:

- what caused the blocker
- which rule or scope item is affected
- what decision is needed
- what the agent recommends
- what the agent did not change

Implementation may continue only after the human lead resolves the blocker.

---

## Validation Required

Every code change must report:

1. files changed
2. behavior changed
3. behavior explicitly not changed
4. commands run
5. validation result
6. risks
7. follow-up recommendations

Minimum validation for application code:

```bash
npm run build
```

Additional validation is required when touching:

- billing
- trials
- credits
- authentication
- authorization
- artifacts
- session state
- AI provider flow
- release readiness
- review scoring
- execution evidence
- exports
- onboarding
- landing page routing

---

## Merge Readiness Rule

A branch is merge-ready only when:

- the approved scope is respected
- no unrelated files are changed
- architecture rule is preserved
- build validation passes
- high-risk changes received review
- validation results are documented
- known non-blocking risks are listed
- blockers are resolved
- the human lead approves the final result

---

## Red-Flag Phrases

Agents must stop and self-review if they are about to say or do any of the following:

- "I also cleaned up..."
- "I refactored the surrounding code..."
- "I simplified the architecture..."
- "I renamed this for consistency..."
- "I changed the prompt to decide..."
- "I moved this logic into the component..."
- "I updated related files while I was there..."
- "I fixed a few other things I noticed..."

These usually indicate unauthorized scope expansion.

---

## Required Session Bootstrap

Every AI-assisted work session should begin with this instruction:

```text
Read AGENTS.md and docs/ai/*.md first.

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

AI → parsed → structured artifacts → deterministic system logic → UI
```

For implementation sessions, the agent must also confirm:

```text
I will not edit files outside the approved scope.
I will stop and raise a blocker if the scope is insufficient.
I will report changed files, validation, risks, and follow-up recommendations.
```

---

## Full Governance Reference

Additional governance files live under:

```text
docs/ai/
```

Recommended files:

- `docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md`
- `docs/ai/AI_SAFEGUARDS.md`
- `docs/ai/AGENT_OPERATING_MODEL.md`
- `docs/ai/MILESTONE_WORKFLOW.md`
- `docs/ai/V1_ROADMAP_EXECUTION_RULES.md`
- `docs/ai/PROMPT_TEMPLATES.md`

Milestone artifacts may live under:

```text
.ai/milestones/
```

Guardrail scripts may live under:

```text
.ai/bin/
```

---

## Final Rule

Three AI opinions are inputs.

One consolidated human-approved decision is the source of truth.

The Release Signal architecture rule always wins:

```text
AI → parsed → structured artifacts → deterministic system logic → UI
```