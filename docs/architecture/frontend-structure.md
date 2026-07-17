# Release Signal Frontend Structure

## 1. Purpose

This document defines the approved frontend responsibility boundaries for Release Signal. It records mode-specific versus shared UI ownership, the current protected structure, the approved direction for future extraction, and the rules agents must follow before proposing structural changes.

It describes the repository as it exists today. Future extraction targets in this document are not claims that those refactors have already happened.

## 2. Protected Frontend Baseline

The current beta-ready behavior and visual hierarchy are protected. Structural work must preserve:

- the Strategy, Test Design, and Test Review flows;
- Feature Workspace, Review Score, and Release Readiness;
- artifact rows, expanded artifact surfaces, and disclosures;
- action visibility, enablement, keyboard behavior, and handlers;
- recent activity and guided onboarding;
- user-scoped session behavior; and
- current dark- and light-theme behavior.

The default rule is:

> **Move and preserve first — redesign only through an explicit product decision.**

A structural ticket does not authorize visual, semantic, or workflow changes. Existing working behavior must not be removed or classified as obsolete without tracing every mode and call site and receiving human approval.

## 3. Current Frontend Responsibility Map

### `app/chat/components/ChatPanel.tsx`

`ChatPanel` is the current workspace composition boundary. It routes the three modes, composes shared workspace sections, and contains private mode-specific surfaces for Strategy, Test Design, and Test Review. It also coordinates placement of Feature Workspace, Release Readiness, artifact documents, onboarding guidance, and recent activity without owning their product truth.

### `app/chat/components/FeatureWorkspaceSummary.tsx`

`FeatureWorkspaceSummary` renders the shared Feature Workspace summary. It presents artifact-status cards and mode-aware workspace status using artifact-backed and deterministically derived inputs. Its mode-aware presentation must not become a second source of readiness, review, lineage, or workflow truth.

### `app/chat/cards/CasesTextCard.tsx`

`CasesTextCard` owns test-suite presentation, editing, validation of the editable view, filtering and search, and suite-specific controls. It preserves structured test-case fields when mapping edits back to the existing artifact contract. Parent-owned workflow actions remain explicit inputs.

### `app/chat/cards/ReviewCard.tsx`

`ReviewCard` renders the detailed persisted Review Result, including score presentation, findings, lineage context, exports, and Review-to-Design actions supplied by its caller. It does not calculate the authoritative review score.

### `app/chat/components/ReleaseReadinessPanel.tsx`

`ReleaseReadinessPanel` presents the deterministic Release Readiness summary and its supporting evidence. Release Readiness remains separate from Review Score and is decision-support rather than automatic approval.

### `app/chat/components/workspace/ArtifactDocumentSurface.tsx`

`ArtifactDocumentSurface` composes shared requirement, suite, review, and execution document surfaces. It coordinates presentation and explicit open/close behavior while delegating artifact-specific rendering and actions to the relevant components.

### `app/chat/hooks/useChatSession.ts`

`useChatSession` is the current primary client-side session and workflow orchestration boundary. It coordinates user-scoped session state, history and artifact hydration, workflow action eligibility and execution, transient input behavior, and client-side artifact application. Server-owned and persisted truth must not be reconstructed in this hook.

These files are large and deserve deliberate maintenance. File size is a warning signal, not proof of incorrect architecture and not a current beta blocker.

## 4. Mode-Specific Ownership

Release Signal currently has three workspace modes:

- Strategy
- Test Design
- Test Review

Mode-specific UI should live in mode-specific modules where practical. The approved future extraction target is:

```text
app/chat/components/workspace/
  strategy/
  testDesign/
  testReview/
  shared/
```

This is a direction, not the current structure. Extraction must be mechanical, incremental, and protected by characterization coverage. It must not become a broad rewrite or a reason to redesign the workspace.

## 5. Shared Component Rules

Shared components must represent genuine shared product or presentation behavior.

- Prefer composition over growing configuration matrices.
- Do not turn shared components into containers for accumulating mode-specific conditionals.
- Avoid speculative abstractions.
- Do not extract code only to reduce line count.
- Keep small, tightly coupled helpers local when that keeps ownership clearer.
- Introduce a shared abstraction only after a stable repeated product concept is proven.

## 6. Mode Representation

Multiple booleans representing one conceptual mode are a warning sign. When the model is stable and clearly simpler, prefer a discriminated mode or a resolved view model over another independent mode flag.

This does not require immediate conversion of the current code. A new fourth mode-specific flag, or equivalent growth in a shared component, must prompt architectural reassessment before another boolean prop is added.

## 7. Derived State and Product Rules

Components render derived product state; they do not recreate authoritative rules.

- Artifact lineage, Release Readiness, Review Score, billing, authorization, and workflow eligibility remain owned by deterministic functions, services, and server-backed state.
- Shared product rules must not be copied into separate UI branches.
- UI state may control presentation, disclosure, and transient input, but it must not become product truth.
- Historical chat text and unvalidated model output are never authoritative artifacts.

The controlling direction remains:

```text
AI -> parsed -> structured artifacts -> deterministic system logic -> UI
```

## 8. Safe Frontend Decomposition Sequence

The approved future sequence is:

1. Add characterization tests.
2. Extract Strategy-specific private components.
3. Extract Test Design-specific private components.
4. Extract Test Review-specific private components.
5. Extract remaining genuinely shared private helpers.
6. Reassess shared-component mode flags only if change pressure returns.

This is a future roadmap. It is not implementation scope for PR #66.

## 9. High-Risk Areas

Before proposing changes to high-risk orchestration, artifact, or service files, read:

- [`docs/m18-refactor-inventory.md`](../m18-refactor-inventory.md)
- [`docs/m18-server-service-boundary-review.md`](../m18-server-service-boundary-review.md)

Those documents record current deferrals and validation expectations. This document does not duplicate or override them.

## 10. Related Documents

- [`AGENTS.md`](../../AGENTS.md)
- [`docs/ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md`](../ai/RELEASE_SIGNAL_ARCHITECTURE_RULES.md)
- [`docs/ai/AGENT_OPERATING_MODEL.md`](../ai/AGENT_OPERATING_MODEL.md)
- [`docs/architecture/coding-standards.md`](coding-standards.md)
- [`docs/m18-refactor-inventory.md`](../m18-refactor-inventory.md)
- [`docs/m18-server-service-boundary-review.md`](../m18-server-service-boundary-review.md)
