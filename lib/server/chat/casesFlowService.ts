// lib/server/chat/casesFlowService.ts
// M10 Pass 9
// Extract cases-mode orchestration from route.ts so the API route
// stays focused on orchestration only.
//
// M11 CHANGE:
// This service now classifies the structured cases-flow outcome so telemetry
// can be emitted from artifact state rather than rendered chat text.
//
// M12 Step 5 CHANGE:
// - validate merged suite before rendering
// - classify unchanged suite outcomes deterministically
// - surface duplicate-blocked / no-new-case outcomes safely
// - keep workflow artifact-based
// - thread suite diff summary upward for change awareness

import type {
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { getTestSuite, validateTestSuite } from "@/lib/chat/artifact";

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
    duplicateGroups?: number;
    duplicateSkippedCount?: number;
    addedCaseIds?: string[];
    previousVersion?: number | null;
    nextVersion?: number | null;
    unchanged?: boolean;
  };
};

function buildNoChangeReply(args: {
  existingSuite: TestSuiteArtifact | null;
  explicitRegenerationRequest: boolean;
  hasDuplicates: boolean;
  duplicateSkippedCount: number;
}): string {
  if (args.existingSuite) {
    const base = renderTestSuiteForUser(args.existingSuite);

    if (args.hasDuplicates) {
      return [
        "No new cases were added because duplicate cases were detected in the generated output.",
        "",
        base,
      ].join("\n");
    }

    if (args.duplicateSkippedCount > 0) {
      return [
        `No new unique test cases were added. ${args.duplicateSkippedCount} generated case(s) matched existing suite coverage and were skipped.`,
        "",
        base,
      ].join("\n");
    }

    if (args.explicitRegenerationRequest) {
      return [
        "No valid replacement test cases were produced, so the existing suite was kept unchanged.",
        "",
        base,
      ].join("\n");
    }

    return [
      "No new unique test cases were added. The current suite remains unchanged.",
      "",
      base,
    ].join("\n");
  }

  if (args.explicitRegenerationRequest) {
    return "No valid test cases were produced for regeneration.";
  }

  if (args.hasDuplicates || args.duplicateSkippedCount > 0) {
    return "Generated output matched existing suite coverage, so no suite changes were applied.";
  }

  return "No valid test cases were produced.";
}

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
  const existingSuite = getTestSuite(args.sessionArtifact);
  const existingSuiteForMerge = args.explicitRegenerationRequest
    ? null
    : existingSuite;

  // Merge raw generated content into the structured suite artifact.
  const merged = mergeGeneratedCasesIntoSuite({
    existingSuite: existingSuiteForMerge,
    generatedText: args.rawReply.trim(),
    explicitReset: args.explicitRegenerationRequest,
  });

  const nextTestSuiteArtifact = merged.nextSuite;
  const testSuiteAddedCount = merged.addedCount;
  const diffSummary = merged.diffSummary;
  const validation = validateTestSuite(nextTestSuiteArtifact);

  // Render user-facing output from the structured suite when available.
  const replyTextForUser =
    nextTestSuiteArtifact &&
    !diffSummary.unchanged &&
    !validation.hasDuplicates
      ? renderTestSuiteForUser(nextTestSuiteArtifact)
      : buildNoChangeReply({
          existingSuite: nextTestSuiteArtifact ?? existingSuite,
          explicitRegenerationRequest: args.explicitRegenerationRequest,
          hasDuplicates: validation.hasDuplicates,
          duplicateSkippedCount: diffSummary.duplicateSkippedCount,
        });

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
        duplicateGroups: validation.duplicateGroups.length,
        duplicateSkippedCount: diffSummary.duplicateSkippedCount,
        addedCaseIds: diffSummary.addedCaseIds,
        previousVersion: diffSummary.previousVersion,
        nextVersion: diffSummary.nextVersion,
        unchanged: diffSummary.unchanged,
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