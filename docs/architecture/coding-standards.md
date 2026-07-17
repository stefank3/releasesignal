# Release Signal Coding Standards

## 1. Purpose and Authority

This file contains approved repository-specific coding standards for Release Signal. It complements [`AGENTS.md`](../../AGENTS.md), the Release Signal architecture rules, the agent operating model, and the M18 refactor inventory.

Higher-level product-truth, authority, agent, and approval rules remain governed by those documents. These standards do not authorize work outside an approved ticket.

## 2. Components

- Give each component one clear primary responsibility.
- Place mode-specific components in mode-specific modules where practical.
- Use shared components only for genuine shared product or presentation behavior.
- Prefer composition over growing configuration matrices.
- Avoid adding boolean props when a discriminated mode or resolved view model is clearer.
- Three independent mode or configuration booleans on a shared component are a warning threshold. A fourth comparable flag requires architectural reassessment.
- Private nested components are acceptable when they are small and tightly coupled to their owner.
- Split by responsibility, not arbitrary line count.
- Calculate derived values once where practical and pass resolved values to rendering code.
- Render logic must not own billing, Auth0, Release Readiness, artifact lineage, review scoring, authorization, or workflow authority.
- Preserve accessibility, focus, keyboard behavior, action visibility, and action enablement during structural changes.

## 3. Hooks

- Hooks own reusable client state and side-effect orchestration.
- `useChatSession` remains the current primary client orchestration boundary. Do not create a second competing universal session hook.
- Extract new hook logic only when it has a distinct, stable responsibility.
- Identity-aware persistence must remain user-scoped.
- Tie state-clearing and state-seeding effects to explicit transitions.
- Avoid effects that run because of broad or ambiguous dependency changes.
- Do not reconstruct server-owned truth in hooks.
- Expose clear actions and resolved state rather than leaking internal implementation details through hook return values.

## 4. Server Code

- Route handlers should validate, authorize, sequence operations, and shape responses.
- Deterministic parsing, normalization, scoring, persistence, and artifact derivation belong in services.
- Auth0, billing, trial, credit, admin, account, and organization authority must remain server-owned.
- No client flag may bypass a server check.
- Provider calls must remain behind the provider abstraction.
- Error classes and failure responses should be explicit and actionable.
- Preserve idempotency, replay handling, and sequencing behavior.
- Route sequencing is high risk and must not be refactored without characterization tests.
- Service extraction must be bounded and separately approved.

See [`docs/m18-server-service-boundary-review.md`](../m18-server-service-boundary-review.md) and [`docs/m18-refactor-inventory.md`](../m18-refactor-inventory.md) for current boundaries and deferrals.

## 5. Artifact Boundaries

- Artifact types and shapes are product contracts.
- Do not change artifact contracts during structural refactors.
- Keep parsing, validation, normalization, versioning, lineage, and deterministic derivation centralized.
- UI components consume artifacts; they do not invent artifact truth.
- Review Score and Release Readiness are separate signals.
- Release Readiness is deterministic decision-support only; it does not approve a release.
- Generated requirements and tests require human review.
- AI output must be parsed and validated before it becomes product state.
- Historical chat text is never authoritative product state.

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

## 6. Comments

Comments are required when:

- a conditional protects a product rule;
- a mode changes semantic behavior rather than styling alone;
- a server/client authority boundary might be misunderstood;
- duplication is intentional for safety or compatibility; or
- a non-obvious constraint protects artifact lineage, billing, Auth0, or readiness behavior.

Comments should explain why the constraint exists. They should not narrate obvious JSX or TypeScript syntax. Remove or update stale historical comments when the related behavior changes.

## 7. File Splitting

- Split by responsibility, not line count.
- Treat line count as a warning signal, not an automatic defect.
- Change frequency, coupling, risk, and ownership matter more than size.
- Do not split high-risk files casually.
- Perform mechanical extraction before cleanup or redesign.
- Keep move-only work and behavior-changing work in separate pull requests unless explicitly approved together.
- Preserve exported contracts during extraction.
- Add characterization coverage before large-file work.

Current high-risk examples include:

```text
app/api/chat/route.ts
app/chat/hooks/useChatSession.ts
lib/chat/artifact.ts
lib/server/chat/artifactUpdateService.ts
```

These examples are warnings, not directions to modify the files.

## 8. Naming

- Use established domain names consistently.
- Preserve current internal mode names unless a product-approved migration exists.
- Match artifact names to their contracts.
- Name booleans as positive, unambiguous states.
- Avoid near-identical names in the same scope.
- Use `resolve`, `build`, `normalize`, `validate`, `persist`, and `render` consistently with the responsibility performed.
- Name handlers for the user or workflow action they execute.
- Avoid generic names such as `data`, `state`, `manager`, or `helper` when a precise domain term exists.

## 9. Testing

- Characterize current behavior before refactoring.
- Use Playwright for user-visible workflow contracts.
- Use unit or service tests for deterministic artifact and state logic.
- Use API or integration tests for authorization, billing, persistence, and server sequencing.
- Do not rely primarily on brittle visual snapshots.
- Structural pull requests must pass the same behavior tests before and after extraction.
- Add regression coverage for every bug fixed.
- Treat user-scoped sessions and Auth0 identity transitions as protected behavior.
- Cover the separation between Review Score and Release Readiness explicitly.

Recommended characterization areas before future frontend decomposition are:

- empty Strategy visual hierarchy;
- Test Design suite collapsed by default;
- Test Review prerequisites and disabled actions;
- Review-to-Design action visibility;
- artifact lineage classification;
- mode-transition input behavior; and
- onboarding-tour target integrity.

These tests are recommended future work and are not part of PR #66.

## 10. Pull Request Standards

Every pull request must define:

- its goal;
- bounded scope and affected files or areas;
- behavior preserved;
- behavior intentionally changed;
- out-of-scope items;
- primary risks;
- validation performed; and
- known non-blocking risks.

Structural and product changes should normally be separate pull requests. The default blast radius remains governed by `AGENTS.md`, and high-risk files require explicit approval.

Within approved scope, Codex may implement, validate, commit, push, and open a pull request. Codex must not merge or close a pull request without explicit instruction. Claude Code should review architecture, security, or semantic changes. The human lead remains the final approval and merge authority.

## 11. Refactor Standard

> **Move and preserve first — redesign only through an explicit product decision.**

- Prefer reversible extractions.
- Avoid broad rewrites.
- Do not combine naming cleanup, formatting, extraction, redesign, and product changes in one pull request.
- Do not remove behavior because it appears redundant without tracing all modes and call sites.
- Do not classify current working behavior as obsolete without human approval.

## 12. Related Documents

- [`AGENTS.md`](../../AGENTS.md)
- [`docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md`](../ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md)
- [`docs/ai/AGENT_OPERATING_MODEL.md`](../ai/AGENT_OPERATING_MODEL.md)
- [`docs/architecture/frontend-structure.md`](frontend-structure.md)
- [`docs/m18-refactor-inventory.md`](../m18-refactor-inventory.md)
- [`docs/m18-server-service-boundary-review.md`](../m18-server-service-boundary-review.md)
