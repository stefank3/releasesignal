// lib/server/chat/releaseHealthService.ts
// M12.15:
// Deterministic release-health aggregation from persisted artifacts only.
// No AI inference, no UI logic, no hidden heuristics.

import type {
  ExecutionIntelligenceArtifact,
  FailureClassificationSummary,
  ReleaseHealthArtifact,
  ReleaseHealthCoverageStatus,
  ReleaseHealthExecutionStatus,
  ReleaseHealthFailureBurden,
  ReleaseHealthOverallStatus,
  SessionArtifact,
} from "@/lib/chat/artifact";
import { getExecutionIntelligence } from "@/lib/chat/artifact";

function hasMeaningfulRequirement(artifact: SessionArtifact | null): boolean {
  const rr = artifact?.refinedRequirement;
  if (!rr || typeof rr !== "object") return false;

  const fields = [
    rr.objective,
    rr.context,
    rr.functionalScope,
    rr.businessRules,
    rr.acceptanceCriteria,
    rr.edgeCases,
    rr.edgeCasesNegativePaths,
    rr.nonFunctionalConstraints,
    rr.testStrategyHooks,
    rr.riskAreas,
    rr.coverageTargets,
    rr.minimalReproScenarios,
    rr.openQuestions,
    rr.openQuestionsClarifications,
    rr.inScope,
    rr.integrations,
    rr.riskFocus,
  ];

  return fields.some((value) => {
    if (Array.isArray(value)) {
      return value.some((item) => String(item ?? "").trim().length > 0);
    }

    return String(value ?? "").trim().length > 0;
  });
}

function hasPersistedSuite(artifact: SessionArtifact | null): boolean {
  return !!(
    artifact?.testSuite &&
    Array.isArray(artifact.testSuite.cases) &&
    artifact.testSuite.cases.length > 0
  );
}

function hasPersistedReview(artifact: SessionArtifact | null): boolean {
  return !!(
    artifact?.reviewResult &&
    typeof artifact.reviewResult.score === "number"
  );
}

function deriveCoverageStatus(args: {
  requirementPresent: boolean;
  suitePresent: boolean;
  reviewPresent: boolean;
}): ReleaseHealthCoverageStatus {
  if (!args.requirementPresent) return "missing_requirement";
  if (!args.suitePresent) return "requirement_only";
  if (!args.reviewPresent) return "suite_ready";
  return "review_ready";
}

function deriveExecutionStatus(
  execution: ExecutionIntelligenceArtifact | null
): ReleaseHealthExecutionStatus {
  if (!execution) return "not_started";

  switch (execution.suiteStatus) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "partial":
      return "partial";
    case "blocked":
      return "blocked";
    default:
      return "unknown";
  }
}

function deriveFailureBurden(args: {
  execution: ExecutionIntelligenceArtifact | null;
  failureSummary: FailureClassificationSummary | null;
}): ReleaseHealthFailureBurden {
  const { execution, failureSummary } = args;

  if (!execution) return "unknown";

  const failedOrTimedOut =
    execution.summary.failed + execution.summary.timedOut;

  if (failedOrTimedOut === 0) {
    return "none";
  }

  const totalClassified = failureSummary?.totalClassified ?? 0;

  if (totalClassified <= 0) {
    return "unknown";
  }

  if (totalClassified === 1) return "low";
  if (totalClassified <= 3) return "medium";
  return "high";
}

function deriveOverallStatus(args: {
  coverageStatus: ReleaseHealthCoverageStatus;
  executionStatus: ReleaseHealthExecutionStatus;
  failureBurden: ReleaseHealthFailureBurden;
}): ReleaseHealthOverallStatus {
  const { coverageStatus, executionStatus, failureBurden } = args;

  if (coverageStatus === "missing_requirement") return "not_ready";
  if (coverageStatus === "requirement_only") return "not_ready";
  if (coverageStatus === "suite_ready") return "needs_review";

  if (executionStatus === "not_started") return "ready_for_execution";
  if (executionStatus === "blocked") return "blocked";

  if (
    executionStatus === "failed" ||
    executionStatus === "partial" ||
    failureBurden === "medium" ||
    failureBurden === "high"
  ) {
    return "degraded";
  }

  if (
    executionStatus === "passed" &&
    (failureBurden === "none" || failureBurden === "low")
  ) {
    return "healthy";
  }

  return "unknown";
}

function buildReasons(args: {
  requirementPresent: boolean;
  suitePresent: boolean;
  reviewPresent: boolean;
  execution: ExecutionIntelligenceArtifact | null;
  coverageStatus: ReleaseHealthCoverageStatus;
  executionStatus: ReleaseHealthExecutionStatus;
  failureBurden: ReleaseHealthFailureBurden;
}): string[] {
  const reasons: string[] = [];
  const { execution } = args;

  if (!args.requirementPresent) {
    reasons.push("Refined requirement artifact is missing");
  }

  if (args.requirementPresent && !args.suitePresent) {
    reasons.push("Persisted test suite artifact is missing");
  }

  if (args.suitePresent && !args.reviewPresent) {
    reasons.push("Persisted review artifact is missing");
  }

  if (!execution) {
    reasons.push("Execution intelligence artifact is missing");
  } else {
    if (args.executionStatus === "blocked") {
      reasons.push("Latest execution is blocked");
    }

    if (args.executionStatus === "failed") {
      reasons.push("Latest execution failed");
    }

    if (args.executionStatus === "partial") {
      reasons.push("Latest execution is partial");
    }

    if (args.failureBurden === "medium") {
      reasons.push("Failure burden is medium");
    }

    if (args.failureBurden === "high") {
      reasons.push("Failure burden is high");
    }

    if (args.failureBurden === "unknown") {
      reasons.push("Failure burden could not be fully determined");
    }
  }

  if (
    args.coverageStatus === "review_ready" &&
    args.executionStatus === "passed" &&
    args.failureBurden === "none"
  ) {
    reasons.push("Coverage artifacts are complete and latest execution passed");
  }

  return reasons;
}

export function buildReleaseHealthArtifact(
  artifact: SessionArtifact | null
): ReleaseHealthArtifact {
  const requirementPresent = hasMeaningfulRequirement(artifact);
  const suitePresent = hasPersistedSuite(artifact);
  const reviewPresent = hasPersistedReview(artifact);

  const execution = getExecutionIntelligence(artifact);
  const executionPresent = !!execution;
  const failureSummary = execution?.failureSummary ?? null;
  const failureClassificationPresent =
    !!failureSummary && failureSummary.totalClassified > 0;

  const coverageStatus = deriveCoverageStatus({
    requirementPresent,
    suitePresent,
    reviewPresent,
  });

  const executionStatus = deriveExecutionStatus(execution);
  const failureBurden = deriveFailureBurden({
    execution,
    failureSummary,
  });

  const overallStatus = deriveOverallStatus({
    coverageStatus,
    executionStatus,
    failureBurden,
  });

  return {
    computedAt: new Date().toISOString(),
    coverageStatus,
    executionStatus,
    failureBurden,
    overallStatus,
    requirementPresent,
    suitePresent,
    reviewPresent,
    executionPresent,
    failureClassificationPresent,
    suiteVersion: artifact?.testSuite?.version ?? null,
    reviewScore:
      typeof artifact?.reviewResult?.score === "number"
        ? artifact.reviewResult.score
        : null,
    executionTotal: execution?.summary.total ?? 0,
    executionFailed: execution?.summary.failed ?? 0,
    executionTimedOut: execution?.summary.timedOut ?? 0,
    totalClassifiedFailures: failureSummary?.totalClassified ?? 0,
    reasons: buildReasons({
      requirementPresent,
      suitePresent,
      reviewPresent,
      execution,
      coverageStatus,
      executionStatus,
      failureBurden,
    }),
  };
}