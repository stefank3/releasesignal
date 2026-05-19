---
type: agent_operating_model
target_agents:
  - ChatGPT
  - Codex
  - Claude Code
  - Gemini CLI
enforcement: strict_blocking
version: 1.0.0
scope: ai_agent_roles_and_handoffs
status: active
inherits:
  - AGENTS.md
  - docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md
  - docs/ai/AI_SAFEGUARDS.md
---

# Release Signal Agent Operating Model

This document defines how ChatGPT, Codex, Claude Code, and Gemini CLI should collaborate inside the Release Signal repository.

It does not replace `AGENTS.md`.

It operationalizes agent roles, handoffs, ownership boundaries, and approval gates.

The controlling architecture rule is:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

No agent workflow may override that rule.

---

## Operating Principle

Release Signal uses multiple AI agents to speed up work, but no AI agent has final decision authority.

All AI outputs are advisory until consolidated, reviewed, and approved by the human lead.

Final approved decisions must follow the Consensus Decision Rule in `AGENTS.md`.

```text
Three AI opinions are inputs.
One consolidated human-approved decision is the source of truth.
```

---

## Agent Role Summary

| Agent | Primary Role | Default Mode | Editing Authority |
|---|---|---|---|
| ChatGPT | Architecture lead, planner, prompt writer, consolidation partner | Planning / consolidation | No repo edits by default |
| Codex | Implementation agent | Coding / validation | Edits only inside approved scope |
| Claude Code | Architecture reviewer and risk challenger | Review-first | No edits unless explicitly assigned |
| Gemini CLI | Large-context analyzer and documentation reviewer | Analysis / documentation review | No edits unless explicitly assigned |

---

## ChatGPT Role

ChatGPT is the Release Signal architecture and planning partner.

Primary responsibilities:

- convert broad goals into scoped milestones
- define branch names and milestone boundaries
- draft governance docs
- consolidate recommendations from all AI tools
- prepare prompts for Codex, Claude Code, and Gemini CLI
- produce closure messages
- challenge weak architecture decisions
- protect deterministic artifact architecture
- identify scope creep
- preserve roadmap discipline

ChatGPT may produce:

- milestone kickoff plans
- architecture decision drafts
- Codex implementation prompts
- Claude review prompts
- Gemini analysis prompts
- merge/closure messages
- documentation drafts
- risk reviews
- blocker summaries

ChatGPT must not:

- treat its own output as final without human approval
- authorize broad refactors by default
- override an approved consensus decision
- move product truth into AI text
- claim implementation is complete without repo validation

---

## Codex Role

Codex is the primary implementation agent.

Primary responsibilities:

- modify files inside approved scope
- implement bounded tickets
- fix concrete regressions
- perform small surgical refactors
- run validation commands when available
- report changed files and risks
- preserve existing behavior outside the task
- stop when scope is insufficient

Codex may edit:

- files explicitly listed in the approved task
- files explicitly listed in milestone scope
- supporting files only when the task or human lead approves them

Codex must not:

- edit outside approved scope silently
- perform broad refactors
- mix feature work with cleanup
- rename unrelated concepts
- add dependencies without approval
- change artifact contracts without approval
- change billing, trial, credit, readiness, or review semantics without approval
- push, merge, delete branches, rebase, or hard reset unless explicitly instructed

Codex must report:

1. summary
2. files changed
3. behavior changed
4. behavior explicitly not changed
5. commands run
6. validation result
7. risks
8. recommended next step

---

## Claude Code Role

Claude Code is the architecture reviewer and high-risk change challenger.

Default mode:

```text
review only
```

Primary responsibilities:

- review branch diffs
- identify architecture drift
- identify hidden coupling
- challenge unsafe refactors
- inspect high-risk file changes
- review artifact ownership
- review billing, credit, and trial safety
- review merge readiness
- return minimal actionable findings

Claude Code should review changes involving:

- high-risk files listed in `AGENTS.md`
- artifact parsing or persistence
- AI provider boundaries
- workflow orchestration
- billing, trials, credits, subscriptions, or wallets
- Auth0 organization or user creation
- release readiness
- review scoring
- database schema or migrations
- broad refactor proposals

Claude Code must not:

- rewrite the implementation from scratch during review
- edit while Codex is the active editor
- introduce alternative designs unless the current design is unsafe
- approve a change that violates the architecture rule
- silently accept scope expansion

Claude Code review output should be:

1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes

---

## Gemini CLI Role

Gemini CLI is the large-context analyzer and documentation/consistency reviewer.

Default mode:

```text
analysis and documentation review
```

Primary responsibilities:

- perform repo-wide or docs-wide consistency analysis
- check documentation drift
- review terminology consistency
- identify missing context
- review product-readiness gaps
- inspect long files or broad areas without editing
- validate whether docs align with implementation claims
- review milestone scope for missing impacted files

Gemini CLI may be used for:

- large-context analysis
- documentation review
- roadmap consistency checks
- onboarding and landing-page copy review
- release notes review
- impact analysis before implementation

Gemini CLI must not:

- perform broad repository rewrites by default
- edit the same branch while Codex is active editor
- introduce alternate governance rules without consensus
- treat documentation preference as architecture requirement
- claim implementation facts without code or human confirmation

Gemini CLI review output should be:

1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes

---

## Human Lead Role

The human lead is the final decision authority.

The human lead must approve:

- final consolidated decisions
- milestone kickoff scope
- branch creation when needed
- scope expansion
- high-risk file changes
- schema changes
- dependency changes
- billing, credit, trial, or subscription behavior changes
- merge readiness
- final branch merge

The human lead may override AI recommendations, but the approved decision should be recorded clearly before implementation continues.

No AI agent may treat another AI's recommendation as final without human approval.

---

## Default Handoff Flow

The default multi-AI flow is:

```text
Human lead defines direction
ChatGPT scopes and consolidates
Gemini CLI reviews broad context if needed
Codex implements inside approved scope
Codex reports validation and risks
Claude Code reviews architecture/high-risk safety
Gemini CLI reviews documentation/consistency if needed
ChatGPT consolidates review findings
Codex applies only approved fixes
Human lead validates and approves merge
```

This flow may be shortened for simple docs-only or low-risk tasks, but the rules in `AGENTS.md` still apply.

---

## One Active Editor Flow

Only one AI agent may edit files on a branch at a time.

Allowed:

```text
Codex edits implementation files.
Claude Code reviews without editing.
Gemini CLI reviews docs without editing.
ChatGPT consolidates findings.
Codex applies approved fixes.
```

Not allowed:

```text
Codex edits files.
Claude Code edits the same branch independently.
Gemini CLI rewrites docs independently.
No single consolidated decision exists.
```

If the active editor changes, the human lead must explicitly say so.

---

## Review-Only Mode

When an agent is assigned review-only mode, it must not edit files.

Review-only agents may:

- inspect diffs
- inspect file contents
- compare against governance rules
- identify blockers
- suggest minimal changes
- recommend approval or rejection

Review-only agents must not:

- rewrite files
- apply patches
- create alternate full versions unless requested
- expand scope
- modify unrelated docs
- resolve blockers without human approval

---

## Implementation Mode

When an agent is assigned implementation mode, it must:

- confirm the approved scope
- confirm forbidden actions
- modify only approved files
- stop when scope is insufficient
- report all changed files
- run required validation where possible
- report risks honestly

Implementation mode is normally assigned to Codex.

Claude Code or Gemini CLI may enter implementation mode only when explicitly assigned by the human lead.

---

## Documentation Mode

Documentation mode may be assigned to ChatGPT, Codex, Claude Code, or Gemini CLI, but only one agent may edit docs at a time.

Documentation changes must still respect:

- Consensus Decision Rule
- architecture rule
- existing approved terminology
- roadmap boundaries
- implementation truth

Documentation must not claim features are implemented when they are future scope.

Documentation must not rewrite product positioning without approval.

Documentation-only work must not touch application logic.

---

## Validation Mode

Validation mode focuses on checking, not changing.

Validation may include:

- `git status`
- `git diff --stat`
- `git diff`
- `npm run build`
- targeted tests
- QA smoke/regression commands when applicable
- manual scenario checks
- artifact consistency checks

Validation agents must report:

- command run
- result
- failure details
- whether failure blocks merge
- recommended next step

Validation agents must not hide failures.

---

## Scope Expansion Protocol

If a task requires more files than approved, the agent must stop.

The agent must raise a blocker or request a scope amendment.

Scope expansion is required for:

- new files outside approved folders
- schema/database changes
- dependency changes
- high-risk file changes not listed in scope
- artifact contract changes
- billing/credit/trial semantic changes
- roadmap expansion
- UI behavior change beyond requested feature

Scope expansion must be approved by the human lead before implementation continues.

---

## High-Risk Review Protocol

High-risk changes require explicit review before merge.

High-risk changes include work touching:

- files listed in `AGENTS.md` High-Risk Areas
- files listed in `docs/ai/AI_SAFEGUARDS.md` High-Risk File Safeguards
- artifact lifecycle logic
- billing, trial, credit, or subscription logic
- Auth0 org/user creation
- review scoring
- release readiness
- AI provider execution
- session authorization
- database schema or migrations

Minimum review expectation:

```text
Claude Code review strongly recommended.
Human approval required before merge.
```

For very high-risk changes, Gemini CLI may also perform a broad context review.

---

## Consensus Decision Workflow

When more than one AI is consulted on the same decision:

1. Each AI may provide recommendations.
2. No individual AI output is final.
3. ChatGPT consolidates overlapping or conflicting recommendations.
4. Claude Code reviews the consolidated version for architecture and safety.
5. Gemini CLI reviews the consolidated version for consistency and missing context.
6. The human lead approves or rejects the final consolidated decision.
7. Once approved, all agents must follow it.

If an agent disagrees after approval, it must raise a blocker rather than implement an alternative.

---

## Milestone Work Pattern

Each milestone should follow this pattern:

1. define milestone goal
2. define branch name
3. define allowed scope
4. define forbidden changes
5. define validation plan
6. create or update milestone docs if needed
7. implement with one active editor
8. validate
9. review
10. apply approved fixes only
11. validate again
12. human approves merge
13. produce closure summary

Milestone artifacts may live under:

```text
.ai/milestones/M-{N}/
```

---

## Agent Report Format

All agents should report in a structured format.

For implementation:

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

For review:

```text
1. Approve / Needs changes / Blocker
2. Specific findings
3. Minimal suggested changes
```

For validation:

```text
1. Commands run
2. Results
3. Failures
4. Merge impact
5. Recommended next step
```

---

## Forbidden Multi-Agent Patterns

The following patterns are not allowed:

- multiple agents editing the same branch without a handoff
- one agent overriding another without consolidation
- Codex applying Claude/Gemini suggestions without human approval
- Gemini or Claude rewriting GPT's consolidated docs from scratch during review
- ChatGPT treating its own draft as final without human approval
- any agent reopening an approved decision without a blocker
- any agent implementing a future roadmap item during unrelated work
- any agent using AI text as product truth

---

## Recommended Use by Work Type

| Work Type | Primary Agent | Reviewer |
|---|---|---|
| roadmap planning | ChatGPT | Gemini CLI if large-context needed |
| milestone kickoff | ChatGPT | Claude Code for high-risk scope |
| implementation | Codex | Claude Code |
| bug fix | Codex | Claude Code if high-risk |
| docs/governance | ChatGPT or Codex | Gemini CLI + Claude Code |
| large-context analysis | Gemini CLI | ChatGPT |
| architecture review | Claude Code | ChatGPT |
| UI copy/onboarding copy | ChatGPT | Gemini CLI |
| merge/closure message | ChatGPT | Human lead |

---

## Final Operating Model

Use AI agents as follows:

```text
ChatGPT = plan and consolidate
Codex = implement
Claude Code = review architecture and risk
Gemini CLI = analyze broad context and documentation consistency
Human lead = approve final decisions and merges
```

The model is designed to speed up Release Signal development without weakening the architecture.

The final constraint remains:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```