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

```text
Are we ready to release?