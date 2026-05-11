# Release Signal - M18 Server / Service Boundary Review

Status: Boundary Review  
Milestone: M18 Architecture Cleanup / File Size Reduction / Bug Fixing / AI-Assisted Refactor Pass

## Decision

M18.5 completed a server/service boundary inspection.

No broad route extraction will be performed in this step.

The current priority remains V1 stabilization, not large architectural movement.

## Findings

### app/api/chat/route.ts

`app/api/chat/route.ts` remains the highest-risk orchestration file.

It currently owns:

- workflow action detection
- workflow action prompt construction
- artifact prerequisite checks
- OpenAI execution orchestration
- post-model flow orchestration
- suite/review/execution/release-health persistence sequencing
- telemetry emission
- response shaping

This file should not be broadly refactored during M18.5.

Future extraction is allowed only as a bounded ticket with clear validation.

Possible future extraction candidates:

- workflow action message builder
- workflow action prerequisite checks
- execution-ingestion route branch
- shared artifact persistence pipeline
- telemetry response helper

### app/api/test-suites/export/route.ts

The export route boundary is acceptable for M18.

It acts mostly as:

- auth
- request parameter parsing
- artifact refresh
- call deterministic export service
- response shaping

Export logic remains isolated in dedicated export services.

No M18.5 refactor required.

### app/api/execution-evidence/route.ts

The execution evidence route boundary is acceptable for M18.

It acts mostly as:

- auth
- JSON body parsing
- session/artifact lookup
- call deterministic execution evidence service
- persist resulting artifact
- response shaping

Execution validation and normalization remain in dedicated execution services.

No M18.5 refactor required.

### lib/server/chat/artifactUpdateService.ts

This service is sensitive and product-truth-adjacent.

It owns:

- artifact persistence wrappers
- review persistence
- execution persistence
- release-health persistence
- featureWorkspace mirroring
- stale review/release-health invalidation

Do not split this service casually.

Any future extraction must preserve deterministic artifact behavior and stale-state rules.

### lib/server/chat/testSuiteService.ts

This service remains an acceptable owner for suite parsing, suite baseline construction, append behavior, improve/regenerate replacement handling, and suite rendering.

M18.4 added:

- full existing suite content in Improve Test Plan context
- destructive shrink guard
- safer Improve Test Plan behavior

No additional M18.5 service split is required.

## M18.5 Decision

Do not extract from `app/api/chat/route.ts` during M18.5 unless a specific bug or isolated low-risk helper is identified.

Do not split `artifactUpdateService.ts` during M18.5.

Keep export and execution evidence routes as-is.

Proceed next to either:

- M18.6 hook/session orchestration review, inspection-only first
- small UX follow-up for Improve Test Plan rejection message
- final M18 regression pass if no more hardening is needed

## Closure Criteria

M18.5 can close when:

- server/service boundaries are documented
- no accidental code refactor is introduced
- high-risk files are explicitly deferred
- next safe M18 ticket is selected
- working tree is clean
