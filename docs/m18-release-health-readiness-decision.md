# Release Signal - M18 Release Health vs Release Readiness Decision

Status: Decision Document  
Milestone: M18 Architecture Cleanup / File Size Reduction / Bug Fixing / AI-Assisted Refactor Pass

## Decision

Release Readiness is the primary V1 release decision/reporting surface.

Release Health remains temporarily as a compact legacy workspace signal.

Do not merge Release Health and Release Readiness in M18.

Do not delete Release Health in M18.

Do not change Release Readiness status semantics in M18.

Do not change persisted artifact contracts in M18.

## Current Boundary

### Release Readiness

Release Readiness answers:

Are we ready to release?

It owns:

- readiness status
- confidence
- reasons
- warnings
- recommended actions
- blocked / insufficient data / ready states
- future release reporting direction

### Release Health

Release Health remains a compact workspace-state signal.

It owns:

- compact workspace health rollup
- persisted legacy releaseHealth display
- quick artifact-state summary
- compatibility with M12-M16 behavior

Release Health is not the final release decision surface.

## M18 Implementation Rule

For M18:

- Keep Release Readiness logic unchanged.
- Keep Release Health logic unchanged.
- Do not consolidate services.
- Do not change artifact contracts.
- Only apply small UI wording clarification if needed.

## Recommended UI Clarification

Rename the compact card label from:

Release Health

to:

Workspace Health

Reason:

- It avoids competing with Release Readiness Report.
- It makes clear this is workspace-state context.
- It does not change deterministic logic.
- It does not change persisted artifacts.

## Non-Goals

M18 must not:

- remove Release Health blindly
- merge Release Health and Release Readiness services
- persist Release Readiness as a new artifact
- introduce a readiness score
- redesign the dashboard
- change review scoring
- change execution evidence semantics
- change readiness rules
- move readiness logic into UI
- depend on AI text for release decisions
- introduce V1.1 or V2 scope

## Validation If UI Wording Changes

Validate:

- Feature workspace still renders
- Workspace summary still shows requirement, suite, review, and execution cards
- Workspace Health card still appears when releaseHealth exists
- Missing health state still renders correctly
- Release Readiness panel still appears separately
- Insufficient Data readiness state still works
- Blocked readiness state still works
- npm run build passes

## Final M18 Decision

Release Readiness is the primary V1 release decision/reporting surface.

Release Health remains temporarily as compact workspace context.

Only UI wording may change in M18.
