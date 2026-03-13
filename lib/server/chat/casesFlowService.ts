// lib/server/chat/casesFlowService.ts
// M10 Pass 9
// Extract cases-mode orchestration from route.ts so the API route
// stays focused on orchestration only.
//
// M11 CHANGE:
// This service now classifies the structured cases-flow outcome so telemetry
// can be emitted from artifact state rather than rendered chat text.

import type {
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { getTestSuite } from "@/lib/chat/artifact";

import type { TelemetryEventType } from "@/lib/server/telemetry/telemetryTypes";

import {
  mergeGeneratedCasesIntoSuite,
  renderTestSuiteForUser,
} from "@/lib/server/chat/testSuiteService";

export type CasesFlowTelemetry = {
  eventType: Extract<
    TelemetryEventType,
    "test_suite_generated" | "test_suite_extended" | "test_suite_regenerated"
  >;
  artifactType: "testSuite";
  artifactVersion: number;
  metadata: {
    suiteSize: number;
    newCasesGenerated: number;
  };
};

export async function runCasesFlow(args: {
  rawReply: string;
  sessionArtifact: SessionArtifact | null;
  explicitRegenerationRequest: boolean;
}): Promise<{
  replyTextForUser: string;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
  testSuiteAddedCount: number;
  telemetry: CasesFlowTelemetry | null;
}> {
  // If regeneration was explicitly requested, the previous suite is ignored
  // so the next generated suite becomes a fresh baseline.
  const existingSuiteForMerge = args.explicitRegenerationRequest
    ? null
    : getTestSuite(args.sessionArtifact);

  // Merge raw generated content into the structured suite artifact.
  const merged = mergeGeneratedCasesIntoSuite({
    existingSuite: existingSuiteForMerge,
    generatedText: args.rawReply.trim(),
    explicitReset: args.explicitRegenerationRequest,
  });

  const nextTestSuiteArtifact = merged.nextSuite;
  const testSuiteAddedCount = merged.addedCount;

  // Render user-facing output from the structured suite when available.
  const replyTextForUser = nextTestSuiteArtifact
    ? renderTestSuiteForUser(nextTestSuiteArtifact)
    : args.rawReply.trim();

  // M11:
  // Build structured telemetry classification only when a suite artifact exists.
  // This avoids emitting telemetry from unstructured fallback text.
  let telemetry: CasesFlowTelemetry | null = null;

  if (nextTestSuiteArtifact) {
    const eventType: CasesFlowTelemetry["eventType"] =
      args.explicitRegenerationRequest
        ? "test_suite_regenerated"
        : existingSuiteForMerge
        ? "test_suite_extended"
        : "test_suite_generated";

    telemetry = {
      eventType,
      artifactType: "testSuite",
      artifactVersion: nextTestSuiteArtifact.version,
      metadata: {
        suiteSize: nextTestSuiteArtifact.cases.length,
        newCasesGenerated: testSuiteAddedCount,
      },
    };
  }

  return {
    replyTextForUser,
    nextTestSuiteArtifact,
    testSuiteAddedCount,
    telemetry,
  };
}