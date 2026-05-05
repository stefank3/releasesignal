// lib/server/execution/executionEvidenceService.ts
// M16 Execution Evidence Layer:
// Builds a normalized ExecutionIntelligenceArtifact from validated structured input.
//
// Architecture rule:
// persisted TestSuiteArtifact
// -> structured execution input
// -> deterministic validation / normalization
// -> ExecutionIntelligenceArtifact
//
// No AI calls.
// No review-score changes.
// No release-readiness calculation.
// No TestSuiteArtifact mutation.

import type {
  ExecutionIntelligenceArtifact,
  ExecutionSuiteStatus,
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import {
  buildExecutionSummary,
  normalizeExecutionCaseResult,
  normalizeExecutionIntelligenceArtifact,
  withUpdatedExecutionIntelligenceArtifact,
} from "@/lib/chat/artifact";
import {
  validateExecutionEvidenceInput,
  type ExecutionEvidenceInput,
  type ExecutionEvidenceValidationError,
  type ExecutionEvidenceValidationWarning,
} from "@/lib/server/execution/executionEvidenceValidator";

export type BuildExecutionEvidenceResult =
  | {
      ok: true;
      artifact: ExecutionIntelligenceArtifact;
      nextSessionArtifact: SessionArtifact;
      warnings: ExecutionEvidenceValidationWarning[];
      message: string;
    }
  | {
      ok: false;
      errors: ExecutionEvidenceValidationError[];
      warnings: ExecutionEvidenceValidationWarning[];
      message: string;
    };

function deriveSuiteStatusFromSummary(
  summary: ReturnType<typeof buildExecutionSummary>
): ExecutionSuiteStatus {
  if (summary.total === 0) return "unknown";

  if (summary.passed === summary.total) return "passed";
  if (summary.blocked === summary.total) return "blocked";

  const failedOrTimedOut = summary.failed + summary.timedOut;
  if (failedOrTimedOut === summary.total) return "failed";

  if (failedOrTimedOut > 0) return "partial";
  if (summary.blocked > 0) return "partial";
  if (summary.skipped > 0) return "partial";
  if (summary.unknown > 0) return "partial";

  return "unknown";
}

export function buildExecutionEvidenceArtifact(args: {
  input: ExecutionEvidenceInput;
  currentArtifact: SessionArtifact | null;
  suite: TestSuiteArtifact | null | undefined;
  nowIso?: string;
}): BuildExecutionEvidenceResult {
  const validation = validateExecutionEvidenceInput({
    input: args.input,
    suite: args.suite,
    nowIso: args.nowIso,
  });

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
      message: "Execution evidence could not be saved because validation failed.",
    };
  }

  const normalizedCaseResults = validation.evidence.caseResults.map((result) =>
    normalizeExecutionCaseResult(result)
  );

  const summary = buildExecutionSummary(normalizedCaseResults);
  const suiteStatus = deriveSuiteStatusFromSummary(summary);

  const executionArtifact = normalizeExecutionIntelligenceArtifact({
    source: validation.evidence.source,
    suiteVersion: validation.evidence.suiteVersion,
    ...(validation.evidence.runId ? { runId: validation.evidence.runId } : {}),
    ...(validation.evidence.runLabel
      ? { runLabel: validation.evidence.runLabel }
      : {}),
    observedAt: validation.evidence.observedAt,
    suiteStatus,
    summary,
    caseResults: normalizedCaseResults,
  });

  const nextSessionArtifact = withUpdatedExecutionIntelligenceArtifact(
    args.currentArtifact,
    executionArtifact
  );

  return {
    ok: true,
    artifact: executionArtifact,
    nextSessionArtifact,
    warnings: validation.evidence.warnings,
    message: `Execution evidence saved for suite v${executionArtifact.suiteVersion ?? "unknown"} with ${executionArtifact.summary.total} result${executionArtifact.summary.total === 1 ? "" : "s"}.`,
  };
}