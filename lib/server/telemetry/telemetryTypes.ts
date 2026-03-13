// lib/server/telemetry/telemetryTypes.ts
// Shared telemetry contracts for M11.
//
// Design goals:
// - keep event naming deterministic
// - keep workflow stages explicit
// - keep payload shape small and reusable
// - support structured metadata without forcing every detail into columns

import type { Prisma } from "@prisma/client";

export type TelemetryEventType =
  | "session_started"
  | "session_reopened"
  | "requirement_refined"
  | "test_suite_generated"
  | "test_suite_extended"
  | "test_suite_regenerated"
  | "review_started"
  | "review_performed"
  | "review_failed"
  | "export_generated";

export type TelemetryWorkflowStage =
  | "strategy"
  | "test_design"
  | "test_review"
  | "session"
  | "export";

export type TelemetryStatus = "started" | "success" | "failed";

export type EmitTelemetryEventInput = {
  eventType: TelemetryEventType;

  auth0Sub?: string | null;
  organizationId?: string | null;
  sessionId?: string | null;

  workflowStage?: TelemetryWorkflowStage | null;
  status?: TelemetryStatus | null;

  durationMs?: number | null;

  tokenInput?: number | null;
  tokenOutput?: number | null;
  tokenTotal?: number | null;

  artifactType?: string | null;
  artifactVersion?: number | null;

  metadataJson?: Prisma.InputJsonValue | null;
};