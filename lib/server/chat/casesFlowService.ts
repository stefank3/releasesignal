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
//
// M12 Step 6 CHANGE:
// - add deterministic suite analysis
// - add workflow guidance derived from artifact state
//
// M12.9 Phase 2 CHANGE:
// - add workflow-action-aware cases branching
// - split generate-next-batch from generic generate-tests flow
// - enforce append-only next-batch merge behavior
// - preserve explicit no-op message when no new coverage survives dedupe
//
// M12.9 Phase 2 FIX:
// - wire regenerate_suite to strict replacement path
// - keep regenerate distinct from append-only next-batch behavior
// - preserve existing suite when no valid replacement suite is produced
//
// M12.17 CHANGE:
// - preserve artifact-enriched suite flows without changing body-driven UI behavior
// - keep changed-but-invalid suite outcomes explicit instead of looking like silent no-ops

import type {
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import { getTestSuite, validateTestSuite } from "@/lib/chat/artifact";

import type { TelemetryEventType } from "@/lib/server/telemetry/telemetryTypes";

import {
  mergeGeneratedCasesIntoSuite,
  mergeNextBatchIntoSuite,
  regenerateSuiteFromGeneratedText,
  renderTestSuiteForUser,
} from "@/lib/server/chat/testSuiteService";
import { analyzeTestSuite } from "@/lib/server/chat/suiteAnalysisService";
import { buildWorkflowGuidance } from "@/lib/server/chat/workflowAssistantService";

export type CasesWorkflowAction =
  | "generate_tests_from_requirement"
  | "generate_next_batch_of_tests"
  | "regenerate_suite"
  | "review_test_suite"
  | null;

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
    workflowAction?: CasesWorkflowAction;
    noOpReason?: "no_new_coverage" | "duplicates_only" | "no_valid_cases";
    validationBlockedRender?: boolean;
  };
};

function buildNoChangeReply(args: {
  existingSuite: TestSuiteArtifact | null;
  explicitRegenerationRequest: boolean;
  hasDuplicates: boolean;
  duplicateSkippedCount: number;
  workflowAction: CasesWorkflowAction;
  noOpReason?: "no_new_coverage" | "duplicates_only" | "no_valid_cases";
}): string {
  if (args.workflowAction === "generate_next_batch_of_tests") {
    if (args.existingSuite) {
      return [
        "No additional coverage gaps identified",
        "",
        renderTestSuiteForUser(args.existingSuite),
      ].join("\n");
    }

    return "No additional coverage gaps identified";
  }

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

  return args.noOpReason === "no_new_coverage"
    ? "No additional coverage gaps identified"
    : "No valid test cases were produced.";
}

/**
 * WHY:
 * A changed suite with validation issues should not look like a no-op.
 * We keep rendering deterministic and explicit so operators can see the
 * updated suite and understand why it needs follow-up.
 */
function buildChangedButInvalidReply(args: {
  nextSuite: TestSuiteArtifact;
  validation: ReturnType<typeof validateTestSuite>;
}): string {
  const lines: string[] = [
    "Suite updated, but validation issues were detected in the resulting suite.",
  ];

  if (args.validation.duplicateGroups.length) {
    lines.push(
      `Duplicate groups detected: ${args.validation.duplicateGroups.length}.`
    );
  }

  if (args.validation.malformedCaseIds.length) {
    lines.push(
      `Malformed cases detected: ${args.validation.malformedCaseIds.join(", ")}.`
    );
  }

  lines.push("");
  lines.push(renderTestSuiteForUser(args.nextSuite));

  return lines.join("\n");
}

export async function runCasesFlow(args: {
  rawReply: string;
  sessionArtifact: SessionArtifact | null;
  explicitRegenerationRequest: boolean;
  workflowAction?: CasesWorkflowAction;
}): Promise<{
  replyTextForUser: string;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
  testSuiteAddedCount: number;
  telemetry: CasesFlowTelemetry | null;
  analysis: ReturnType<typeof analyzeTestSuite>;
  guidance: ReturnType<typeof buildWorkflowGuidance>;
}> {
  const workflowAction = args.workflowAction ?? null;

  const existingSuite = getTestSuite(args.sessionArtifact);

  let nextTestSuiteArtifact: TestSuiteArtifact | null = null;
  let testSuiteAddedCount = 0;
  let diffSummary = {
    previousVersion: existingSuite?.version ?? null,
    nextVersion: existingSuite?.version ?? null,
    addedCaseIds: [] as string[],
    addedCount: 0,
    duplicateSkippedCount: 0,
    unchanged: true,
  };
  let noOpReason:
    | "no_new_coverage"
    | "duplicates_only"
    | "no_valid_cases"
    | undefined;

  if (workflowAction === "generate_next_batch_of_tests") {
    const merged = mergeNextBatchIntoSuite({
      requirementText: args.sessionArtifact?.refinedRequirement
        ? JSON.stringify(args.sessionArtifact.refinedRequirement)
        : null,
      existingSuite,
      generatedText: args.rawReply.trim(),
    });

    if (!merged.ok) {
      nextTestSuiteArtifact = existingSuite;
      testSuiteAddedCount = 0;
      noOpReason = "no_valid_cases";
    } else {
      nextTestSuiteArtifact = merged.nextSuite;
      testSuiteAddedCount = merged.addedCount;
      diffSummary = merged.diffSummary;

      if (merged.kind === "no_changes") {
        noOpReason =
          merged.diffSummary.duplicateSkippedCount > 0
            ? "duplicates_only"
            : "no_new_coverage";
      }
    }
  } else if (workflowAction === "regenerate_suite") {
    const regenerated = regenerateSuiteFromGeneratedText({
      requirementText: args.sessionArtifact?.refinedRequirement
        ? JSON.stringify(args.sessionArtifact.refinedRequirement)
        : null,
      existingSuite,
      generatedText: args.rawReply.trim(),
    });

    if (!regenerated.ok) {
      nextTestSuiteArtifact = existingSuite;
      testSuiteAddedCount = 0;
      noOpReason = "no_valid_cases";
      diffSummary = {
        previousVersion: existingSuite?.version ?? null,
        nextVersion: existingSuite?.version ?? null,
        addedCaseIds: [],
        addedCount: 0,
        duplicateSkippedCount: 0,
        unchanged: true,
      };
    } else {
      nextTestSuiteArtifact = regenerated.nextSuite;
      testSuiteAddedCount = regenerated.replacedCount;
      diffSummary = regenerated.diffSummary;
    }
  } else {
    const merged = mergeGeneratedCasesIntoSuite({
      existingSuite,
      generatedText: args.rawReply.trim(),
      explicitReset: false,
    });

    nextTestSuiteArtifact = merged.nextSuite;
    testSuiteAddedCount = merged.addedCount;
    diffSummary = merged.diffSummary;

    if (!merged.nextSuite) {
      noOpReason = "no_valid_cases";
    } else if (merged.diffSummary.unchanged) {
      noOpReason =
        merged.diffSummary.duplicateSkippedCount > 0
          ? "duplicates_only"
          : "no_valid_cases";
    }
  }

  const validation = validateTestSuite(nextTestSuiteArtifact);

  const analysis = analyzeTestSuite(nextTestSuiteArtifact);
  const guidance = buildWorkflowGuidance(analysis);

  const shouldRenderChangedSuite =
    !!nextTestSuiteArtifact && !diffSummary.unchanged && !validation.hasDuplicates;

  const shouldRenderChangedButInvalidSuite =
    !!nextTestSuiteArtifact && !diffSummary.unchanged && validation.hasDuplicates;

  let replyTextForUser: string;

  if (shouldRenderChangedSuite && nextTestSuiteArtifact) {
    replyTextForUser = renderTestSuiteForUser(nextTestSuiteArtifact);
  } else if (shouldRenderChangedButInvalidSuite && nextTestSuiteArtifact) {
    replyTextForUser = buildChangedButInvalidReply({
      nextSuite: nextTestSuiteArtifact,
      validation,
    });
  } else {
    replyTextForUser = buildNoChangeReply({
      existingSuite: nextTestSuiteArtifact ?? existingSuite,
      explicitRegenerationRequest: args.explicitRegenerationRequest,
      hasDuplicates: validation.hasDuplicates,
      duplicateSkippedCount: diffSummary.duplicateSkippedCount,
      workflowAction,
      noOpReason,
    });
  }

  let telemetry: CasesFlowTelemetry | null = null;

  if (nextTestSuiteArtifact) {
    const eventType: CasesFlowTelemetry["eventType"] =
      workflowAction === "generate_next_batch_of_tests"
        ? "test_suite_extended"
        : workflowAction === "regenerate_suite"
          ? "test_suite_regenerated"
          : existingSuite
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
        workflowAction,
        noOpReason,
        validationBlockedRender: shouldRenderChangedButInvalidSuite,
      },
    };
  }

  return {
    replyTextForUser,
    nextTestSuiteArtifact,
    testSuiteAddedCount,
    telemetry,
    analysis,
    guidance,
  };
}