// lib/server/telemetry/telemetryQueryService.ts
//
// M11 — Telemetry Query Layer
//
// Purpose:
// Provide read access and basic aggregation over telemetry_event_logs.
// This is used for internal visibility, admin tooling, and future
// telemetry dashboards.
//
// IMPORTANT:
// - this file does NOT emit telemetry
// - this file only reads persisted telemetry events
// - keep query shapes small and predictable for the first M11 pass

import "server-only";

import { prisma } from "@/lib/prisma";

/*
---------------------------------------------------------
Types
---------------------------------------------------------
*/

// Lightweight recent-event row used by future internal telemetry views.
export type TelemetryEventRow = {
  id: string;
  createdAt: Date;
  eventType: string;
  workflowStage: string | null;
  status: string | null;
  sessionId: string | null;
  auth0Sub: string | null;
  organizationId: string | null;
  durationMs: number | null;
  tokenInput: number | null;
  tokenOutput: number | null;
  tokenTotal: number | null;
  artifactType: string | null;
  artifactVersion: number | null;
};

// Event count aggregate by event type.
export type TelemetryEventCount = {
  eventType: string;
  count: number;
};

// Workflow-stage aggregate for internal KPI visibility.
export type TelemetryWorkflowStageStats = {
  workflowStage: string | null;
  events: number;
  avgDurationMs: number | null;
  totalTokens: number;
};

// Token usage summary across the stored telemetry dataset.
export type TelemetryTokenUsageStats = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
};

/*
---------------------------------------------------------
Recent Events
---------------------------------------------------------
*/

export async function fetchRecentTelemetryEvents(
  limit = 50
): Promise<TelemetryEventRow[]> {
  // Keep bounds healthy so future UI usage cannot accidentally request
  // an excessive number of rows in the first implementation pass.
  const safeLimit = Math.max(1, Math.min(limit, 200));

  const rows = await prisma.telemetryEventLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: safeLimit,
    select: {
      id: true,
      createdAt: true,
      eventType: true,
      workflowStage: true,
      status: true,
      sessionId: true,
      auth0Sub: true,
      organizationId: true,
      durationMs: true,
      tokenInput: true,
      tokenOutput: true,
      tokenTotal: true,
      artifactType: true,
      artifactVersion: true,
    },
  });

  return rows;
}

/*
---------------------------------------------------------
Counts By Event Type
---------------------------------------------------------
*/

export async function fetchTelemetryEventCounts(): Promise<
  TelemetryEventCount[]
> {
  const grouped = await prisma.telemetryEventLog.groupBy({
    by: ["eventType"],
    _count: {
      eventType: true,
    },
    orderBy: {
      eventType: "asc",
    },
  });

  return grouped.map((row) => ({
    eventType: row.eventType,
    count: row._count.eventType,
  }));
}

/*
---------------------------------------------------------
Workflow Stage Stats
---------------------------------------------------------
*/

export async function fetchTelemetryWorkflowStageStats(): Promise<
  TelemetryWorkflowStageStats[]
> {
  const grouped = await prisma.telemetryEventLog.groupBy({
    by: ["workflowStage"],
    _count: {
      _all: true,
    },
    _avg: {
      durationMs: true,
    },
    _sum: {
      tokenTotal: true,
    },
    orderBy: {
      workflowStage: "asc",
    },
  });

  return grouped.map((row) => ({
    workflowStage: row.workflowStage,
    events: row._count._all,
    avgDurationMs: row._avg.durationMs ?? null,
    totalTokens: row._sum.tokenTotal ?? 0,
  }));
}

/*
---------------------------------------------------------
Token Usage Summary
---------------------------------------------------------
*/

export async function fetchTelemetryTokenUsageStats(): Promise<TelemetryTokenUsageStats> {
  const aggregate = await prisma.telemetryEventLog.aggregate({
    _sum: {
      tokenInput: true,
      tokenOutput: true,
      tokenTotal: true,
    },
  });

  return {
    totalInputTokens: aggregate._sum.tokenInput ?? 0,
    totalOutputTokens: aggregate._sum.tokenOutput ?? 0,
    totalTokens: aggregate._sum.tokenTotal ?? 0,
  };
}

/*
---------------------------------------------------------
Overview Bundle
---------------------------------------------------------
*/

// Small convenience helper for internal telemetry pages so they
// can fetch a compact overview in one service call.
export async function fetchTelemetryOverview(args?: { recentLimit?: number }) {
  const recentLimit = args?.recentLimit ?? 25;

  const [recentEvents, eventCounts, workflowStageStats, tokenUsage] =
    await Promise.all([
      fetchRecentTelemetryEvents(recentLimit),
      fetchTelemetryEventCounts(),
      fetchTelemetryWorkflowStageStats(),
      fetchTelemetryTokenUsageStats(),
    ]);

  return {
    recentEvents,
    eventCounts,
    workflowStageStats,
    tokenUsage,
  };
}