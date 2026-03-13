// lib/server/telemetry/telemetryQueryService.ts
//
// M11 — Telemetry Query Layer
//
// Purpose:
// Provide read access and basic aggregation over telemetry_event_logs.
// This is used for internal visibility (admin pages, debugging tools,
// operational monitoring).
//
// IMPORTANT:
// This file does NOT emit telemetry.
// It only reads persisted telemetry events.
//
// Queries provided:
//
// - fetchRecentTelemetryEvents()
// - fetchEventCountsByType()
// - fetchWorkflowStageStats()
// - fetchTokenUsageStats()

import { prisma } from "@/lib/prisma";

/*
---------------------------------------------------------
Types
---------------------------------------------------------
*/

export type TelemetryEventRow = {
  id: string;
  eventType: string;
  workflowStage: string | null;
  status: string | null;
  sessionId: string | null;
  createdAt: Date;
};

export type EventCount = {
  eventType: string;
  count: number;
};

export type WorkflowStageStats = {
  workflowStage: string | null;
  events: number;
  avgDurationMs: number | null;
};

export type TokenUsageStats = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
};

/*
---------------------------------------------------------
Fetch Recent Telemetry Events
---------------------------------------------------------
*/

export async function fetchRecentTelemetryEvents(limit = 50): Promise<TelemetryEventRow[]> {
  const rows = await prisma.telemetryEventLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    select: {
      id: true,
      eventType: true,
      workflowStage: true,
      status: true,
      sessionId: true,
      createdAt: true,
    },
  });

  return rows;
}

/*
---------------------------------------------------------
Event Counts By Type
---------------------------------------------------------
*/

export async function fetchEventCountsByType(): Promise<EventCount[]> {
  const grouped = await prisma.telemetryEventLog.groupBy({
    by: ["eventType"],
    _count: {
      eventType: true,
    },
  });

  return grouped.map((g) => ({
    eventType: g.eventType,
    count: g._count.eventType,
  }));
}

/*
---------------------------------------------------------
Workflow Stage Statistics
---------------------------------------------------------
*/

export async function fetchWorkflowStageStats(): Promise<WorkflowStageStats[]> {
  const grouped = await prisma.telemetryEventLog.groupBy({
    by: ["workflowStage"],
    _count: {
      workflowStage: true,
    },
    _avg: {
      durationMs: true,
    },
  });

  return grouped.map((g) => ({
    workflowStage: g.workflowStage,
    events: g._count.workflowStage,
    avgDurationMs: g._avg.durationMs,
  }));
}

/*
---------------------------------------------------------
Token Usage Statistics
---------------------------------------------------------
*/

export async function fetchTokenUsageStats(): Promise<TokenUsageStats> {
  const agg = await prisma.telemetryEventLog.aggregate({
    _sum: {
      tokenInput: true,
      tokenOutput: true,
      tokenTotal: true,
    },
  });

  return {
    totalInputTokens: agg._sum.tokenInput ?? 0,
    totalOutputTokens: agg._sum.tokenOutput ?? 0,
    totalTokens: agg._sum.tokenTotal ?? 0,
  };
}