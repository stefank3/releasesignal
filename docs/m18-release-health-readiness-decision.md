# Release Signal — M18 Release Health vs Release Readiness Decision

Status: Decision Document  
Milestone: M18 Architecture Cleanup / File Size Reduction / Bug Fixing / AI-Assisted Refactor Pass  
Branch: feature/m18-release-health-readiness-decision

---

## Objective

Clarify the product and architecture boundary between the older **Release Health** signal and the newer **Release Readiness** report introduced in M17.

This decision is part of M18 stabilization.

The goal is not to redesign release reporting, not to change scoring, and not to introduce a new dashboard.

The goal is to prevent duplicate/confusing release signals while preserving the deterministic artifact-first architecture.

---

## Core Architecture Rule

Release Signal must continue to follow:

```text
AI → parsed → structured artifacts → deterministic system logic → UI