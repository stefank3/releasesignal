\# Release Signal — M18 Refactor Inventory and Execution Plan



Status: Inventory Complete  

Branch: feature/m18-refactor-inventory  

Milestone: M18 Architecture Cleanup / File Size Reduction / Bug Fixing / AI-Assisted Refactor Pass



\## Architecture Rule



AI → parsed → structured artifacts → deterministic system logic → UI



M18 must preserve this rule completely.



\## ChatGPT Review Decision



The Codex inventory is accepted as a baseline, but the implementation order is adjusted.



Do not start with app/api/chat/route.ts despite its size. It is high-risk and controls the primary product path. Route extraction should be deferred until safer bug-focused seams are handled.



First implementation ticket:

M18.3 Structured Field Persistence Hardening



Reason:

This is a known user-facing issue where edited/saved test cases can preserve body text but lose structured fields such as type, priority, preconditions, steps, expectedResults, tags, and notes. It has a clear validation path and supports M15 export correctness without changing artifact contracts.



Route and hook refactors remain valid inventory items but must be split into smaller later tickets.



\## Codex Refactor Inventory

Read-only audit complete. I did not modify files.



\*\*Refactor Inventory\*\*



1\. File: \[app/api/chat/route.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/api/chat/route.ts:1>)  

Current size: 1,335 lines  

Risk level: High  

Current responsibilities: auth, request parsing, billing, rate limits, session load, replay, workflow action routing, prompt construction, OpenAI execution, post-model flow, artifact persistence, release health persistence, telemetry, response shaping.  

Problem: API route is doing more than orchestration; workflow-action and freeform paths duplicate persistence, telemetry, and release-health commit logic.  

Recommended action: Extract orchestration helpers only; preserve behavior.  

Suggested extraction: `workflowActionRouter`, `workflowActionMessageBuilder`, `artifactCommitPipeline`, `chatTelemetryEmitter`.  

Behavior risk: High, because it controls the primary product path.  

Validation required: chat happy path, generate tests, next batch, regenerate, review, execution ingestion, replay bypass, billing failure, rate-limit failure.  

Priority: P0  

Decision: Do first, but in small slices.  

Reasoning: This is the main M14-M17 complexity knot and the best place to reduce future defect risk without contract changes.



2\. File: \[app/chat/hooks/useChatSession.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/chat/hooks/useChatSession.ts:1>)  

Current size: 1,450 lines  

Risk level: High  

Current responsibilities: session state, local persistence, history loading, artifact freshness, stale review pruning, workflow eligibility, workflow action execution, response classification, session CRUD, editable suite persistence.  

Problem: Hook owns workflow/product logic and duplicates server-side eligibility/classification checks.  

Recommended action: Split into client state/reducer helpers, response artifact applicator, workflow action client, and session history client.  

Suggested extraction: `useChatSessionState`, `applyArtifactResponse`, `runWorkspaceAction`, `useSessionHistory`.  

Behavior risk: Medium-high.  

Validation required: session restore, stale artifact timestamp guard, requirement refinement invalidating review, workflow buttons, retry/replay, editable suite save.  

Priority: P0  

Decision: Do early after route extraction begins.  

Reasoning: UI should trigger workflows and render artifact truth, not own workflow rules.



3\. File: \[lib/chat/artifact.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/chat/artifact.ts:1>)  

Current size: 1,679 lines  

Risk level: Very high  

Current responsibilities: artifact contracts, normalization, parsing, compatibility bridges, execution normalization, release-health normalization, lineage/stale-state helpers.  

Problem: Contract definitions are mixed with deterministic parsing and compatibility logic.  

Recommended action: Extract helpers without changing exported types or persisted artifact shape.  

Suggested extraction: `artifact.types.ts`, `requirementArtifactParser.ts`, `testSuiteArtifactRules.ts`, `executionArtifactRules.ts`, `releaseHealthArtifactRules.ts`, `artifactLineage.ts`.  

Behavior risk: High.  

Validation required: type checks, artifact merge/normalize tests, history hydration, export, review, execution, release health.  

Priority: P1 guarded  

Decision: Touch only after P0 route/hook seams exist.  

Reasoning: This is the product-truth layer; refactor is useful but must be mechanical.



4\. File: \[app/chat/cards/CasesTextCard.tsx](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/chat/cards/CasesTextCard.tsx:1>)  

Current size: 1,367 lines  

Risk level: Medium-high  

Current responsibilities: suite parsing, edit state, validation, search/filter/sort, workflow action buttons, save bridge, overview extraction, UI rendering.  

Problem: UI component owns parsing and persistence-shaping logic; edited test-case structured fields can be lost because `toPersistedCases` rebuilds only `id/title/body`. Debug `console.log` paths remain.  

Recommended action: Extract editor model/helpers and preserve structured fields during edits. No artifact contract change.  

Suggested extraction: `suiteTextParser`, `suiteEditorReducer`, `suiteEditPersistenceMapper`, `SuiteEditorToolbar`, `SuiteCaseEditor`.  

Behavior risk: Medium.  

Validation required: edit Done saves, structured fields persist after edit, invalid suite blocks save, review/next batch/regenerate buttons still parent-driven.  

Priority: P0  

Decision: Do first group because it directly addresses edited structured field persistence.  

Reasoning: This is a UI/product-logic boundary leak with a known user-facing data preservation risk.



5\. File: \[lib/server/chat/testSuiteService.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/server/chat/testSuiteService.ts:1>)  

Current size: 836 lines  

Risk level: Medium-high  

Current responsibilities: generated-suite parsing, structured field extraction, duplicate detection, merge, next batch, regenerate replacement, render-to-user output.  

Problem: Parsing, merge policy, replacement policy, and rendering are in one service; “Improve Test Plan over-compression” likely sits across regenerate prompt wording and strict dedupe/sanitize behavior.  

Recommended action: Extract deterministic parsing/rendering from merge policies; adjust over-compression only through prompt/policy ticket with explicit acceptance criteria.  

Suggested extraction: `generatedCaseParser`, `suiteMergePolicy`, `suiteRegenerationPolicy`, `suiteRenderer`.  

Behavior risk: Medium-high.  

Validation required: parse generated cases, append-only next batch, regenerate replacement, duplicate skip, malformed case drop, rendered suite compatibility.  

Priority: P1  

Decision: Do after CasesTextCard persistence fix.  

Reasoning: Important, but changes can alter suite size/coverage behavior if not isolated.



6\. File: \[lib/server/chat/promptBuilder.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/server/chat/promptBuilder.ts:1>) and route-local `buildWorkflowActionMessage` in \[app/api/chat/route.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/api/chat/route.ts:207>)  

Current size: 255 lines plus route-local prompt builder  

Risk level: Medium  

Current responsibilities: cases/coach/review instructions, continuity baseline, workflow-action prompts.  

Problem: Test-plan generation instructions are split between promptBuilder and route; regenerate includes “Prefer a tighter, cleaner suite over a larger suite,” which may contribute to over-compression.  

Recommended action: Centralize workflow action prompt construction; make over-compression fix a narrow prompt-policy ticket.  

Suggested extraction: `workflowPromptBuilder`.  

Behavior risk: Medium.  

Validation required: initial generation, next batch, regenerate suite, no duplicate prompt regression, output contract unchanged.  

Priority: P1  

Decision: Do with testSuiteService planning, not as a style cleanup.  

Reasoning: This affects AI output but must still respect AI -> parsed -> structured artifacts -> deterministic system logic -> UI.



7\. File: \[lib/server/chat/artifactUpdateService.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/server/chat/artifactUpdateService.ts:1>)  

Current size: 651 lines  

Risk level: High  

Current responsibilities: guided requirement patches, standalone review ingestion, suite persistence effects, review persistence, execution persistence, release-health persistence, featureWorkspace mirroring, stale downstream clearing.  

Problem: Artifact persistence, lineage invalidation, and stale compatibility mirrors are mixed.  

Recommended action: Extract invalidation/mirroring helpers; keep persistence API stable.  

Suggested extraction: `artifactInvalidationRules`, `featureWorkspaceMirror`, `artifactPersistenceFlows`.  

Behavior risk: High.  

Validation required: requirement refinement clears review/release health, suite save clears stale review, execution persists, featureWorkspace mirror remains compatible.  

Priority: P1 guarded  

Decision: Defer until route pipeline is clearer.  

Reasoning: This is close to artifact truth and stale-state behavior.



8\. File: \[app/api/chat/history/\[sessionId]/route.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/api/chat/history/\[sessionId]/route.ts:1>)  

Current size: 350 lines  

Risk level: Medium-high  

Current responsibilities: history fetch, legacy mode inference, polluted review suppression, delete, raw artifact PATCH from UI.  

Problem: PATCH accepts a full artifact object from client and writes it directly; stale compatibility paths and edit persistence are mixed into history route.  

Recommended action: Move artifact PATCH through a server artifact-update service with normalization and stale-state effects.  

Suggested extraction: `sessionArtifactPatchService`; route remains auth + params + response.  

Behavior risk: High if changed carelessly.  

Validation required: editable suite save, ownership checks, artifactUpdatedAt behavior, stale review/release health invalidation.  

Priority: P0/P1  

Decision: Pair with CasesTextCard structured persistence fix.  

Reasoning: This is the server half of the edited test-case persistence issue.



9\. File: \[lib/server/export/testSuiteBodyFieldParser.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/server/export/testSuiteBodyFieldParser.ts:1>) plus exporters  

Current size: small modules, export folder total moderate  

Risk level: Medium  

Current responsibilities: export-only fallback parsing for structured fields from body.  

Problem: Duplicates parsing logic already present in `testSuiteService` and `CasesTextCard`; fallback exists because structured fields may not persist through edits.  

Recommended action: Keep export behavior, but reuse a shared body-field parser after edit persistence is fixed.  

Suggested extraction: `testCaseBodyFields.ts` shared deterministic parser.  

Behavior risk: Low-medium.  

Validation required: JSON export, CSV export, edited suite export with structured arrays and body fallback.  

Priority: P2  

Decision: Defer until persistence fix lands.  

Reasoning: Export fallback is useful defensive behavior; do not remove prematurely.



10\. File: \[lib/server/chat/releaseHealthService.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/server/chat/releaseHealthService.ts:1>) and \[lib/release-readiness/releaseReadinessService.ts](</c:/Users/Stefan.Kajchevski/stefans-mvp/lib/release-readiness/releaseReadinessService.ts:1>)  

Current size: 238 lines and 291 lines  

Risk level: Medium-high  

Current responsibilities: two deterministic release signals from similar artifact inputs.  

Problem: Release Health vs Release Readiness overlap: both derive status/reasons/actions from requirement, suite, review, execution; semantics differ but duplication is growing.  

Recommended action: Document boundary first; optionally extract shared artifact-factor reader only. Do not merge statuses yet.  

Suggested extraction: `releaseSignalFactors` read-only factor builder.  

Behavior risk: Medium-high.  

Validation required: health card, readiness panel, missing-artifact states, execution failed/partial/blocked states.  

Priority: P1 design, P2 implementation  

Decision: Do boundary ticket before code movement.  

Reasoning: Merging concepts could accidentally change product meaning.



11\. File: \[app/chat/components/FeatureWorkspaceSummary.tsx](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/chat/components/FeatureWorkspaceSummary.tsx:1>)  

Current size: 861 lines  

Risk level: Medium  

Current responsibilities: artifact summary cards, release-health label/tone mapping, current stage display, export action slot.  

Problem: UI is mostly read-only, but it owns status label/tone interpretation and partial-state text; card primitives are embedded in a large component.  

Recommended action: Extract presentational card components and release-health display mapping only; keep all truth artifact-derived.  

Suggested extraction: `WorkspaceSummaryCard`, `workspaceToneStyles`, `ReleaseHealthSummaryCard`.  

Behavior risk: Low-medium.  

Validation required: light/dark rendering, partial state text, ready/pending chips, export menu slot.  

Priority: P2  

Decision: Defer.  

Reasoning: Large but not the most dangerous; mostly presentational.



12\. File: \[app/chat/components/ReleaseReadinessPanel.tsx](</c:/Users/Stefan.Kajchevski/stefans-mvp/app/chat/components/ReleaseReadinessPanel.tsx:1>)  

Current size: 182 lines  

Risk level: Medium  

Current responsibilities: UI rendering plus direct call to deterministic readiness service in client component.  

Problem: Imports service logic into UI layer; currently deterministic, but it blurs the architecture boundary.  

Recommended action: Consider parent-derived readiness summary or a client-safe selector module; do not move product truth into UI.  

Suggested extraction: `buildReleaseReadinessViewModel` or pass `readiness` from parent.  

Behavior risk: Medium.  

Validation required: readiness panel status/confidence/reasons with missing and complete artifacts.  

Priority: P2  

Decision: Defer until Release Health vs Readiness boundary is decided.  

Reasoning: The current logic is deterministic, but the boundary is soft.



\*\*Recommended M18 Ticket Order\*\*



1\. Route orchestration slice: extract workflow action message/routing from `/api/chat` without behavior changes.  

2\. Editable suite persistence fix: preserve structured fields through `CasesTextCard` and route PATCH path.  

3\. Client hook split: extract artifact response application and workflow action client from `useChatSession`.  

4\. Centralize workflow prompt construction, then address Test Plan over-compression with narrow acceptance tests.  

5\. Split `testSuiteService` parser/merge/render helpers.  

6\. Release Health vs Release Readiness boundary note and shared read-only factor reader proposal.  

7\. Artifact file mechanical split, no contract changes.



\*\*Do First\*\*



\- `/api/chat` route orchestration extraction  

\- `CasesTextCard` structured field persistence  

\- history PATCH normalization/service path  

\- `useChatSession` workflow/action extraction



\*\*Defer\*\*



\- Release Health and Release Readiness consolidation  

\- broad `artifact.ts` split  

\- export parser cleanup  

\- purely visual decomposition of workspace cards  

\- review scoring internals



\*\*Do Not Touch Without Explicit Approval\*\*



\- Persisted artifact contracts in `lib/chat/artifact.ts`  

\- Review scoring logic in `lib/domain/deterministicReviewService.ts`  

\- Prisma schema/migrations for artifact storage  

\- Release Health and Release Readiness status semantics  

\- AI output contracts for requirement, suite, review, and execution parsing  

\- Any change that makes UI or free-form AI text the source of product truth

