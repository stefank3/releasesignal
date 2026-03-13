// lib/server/telemetry/telemetryService.ts
// Centralized telemetry write service for M11.
//
// Important behavior:
// - telemetry must never break the primary user workflow
// - invalid optional values are normalized to null / undefined as appropriate
// - metadata stays structured JSON
// - service is intentionally write-only in M11 first pass
//
// NOTE:
// This service depends on the Prisma client being regenerated after the
// TelemetryEventLog model is added to schema.prisma.

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { EmitTelemetryEventInput } from "@/lib/server/telemetry/telemetryTypes";

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toNullableInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

function toOptionalJson(
  value: Prisma.InputJsonValue | null | undefined
): Prisma.InputJsonValue | undefined {
  // Prisma create input for nullable Json fields accepts:
  // - undefined (omit field)
  // - a valid JSON value
  // Plain null is not accepted here in the generated TS type.
  return value ?? undefined;
}

export async function emitTelemetryEvent(
  input: EmitTelemetryEventInput
): Promise<void> {
  try {
    await prisma.telemetryEventLog.create({
      data: {
        eventType: input.eventType,

        auth0Sub: toNullableString(input.auth0Sub),
        organizationId: toNullableString(input.organizationId),
        sessionId: toNullableString(input.sessionId),

        workflowStage: toNullableString(input.workflowStage),
        status: toNullableString(input.status),

        durationMs: toNullableInt(input.durationMs),

        tokenInput: toNullableInt(input.tokenInput),
        tokenOutput: toNullableInt(input.tokenOutput),
        tokenTotal: toNullableInt(input.tokenTotal),

        artifactType: toNullableString(input.artifactType),
        artifactVersion: toNullableInt(input.artifactVersion),

        metadataJson: toOptionalJson(input.metadataJson),
      },
    });
  } catch (error) {
    // Telemetry must never block the primary workflow.
    // We intentionally do not throw from this service.
    console.warn("[telemetry] write failed", {
      eventType: input.eventType,
      sessionId: input.sessionId ?? null,
      workflowStage: input.workflowStage ?? null,
      errorMessage:
        error instanceof Error ? error.message : "Unknown telemetry write error",
    });
  }
}