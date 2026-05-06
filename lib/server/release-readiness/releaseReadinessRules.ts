// lib/server/release-readiness/releaseReadinessRules.ts
// M17 Release Readiness:
// Deterministic readiness rule helpers.
// No AI calls, no prompt text, no artifact mutation.

import type {
  ReleaseReadinessConfidence,
  ReleaseReadinessFactors,
  ReleaseReadinessStatus,
} from "./releaseReadinessTypes";

export function getReviewBand(score: number | undefined): {
  label: "missing" | "weak" | "partial" | "acceptable" | "strong";
  reason: string;
} {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return {
      label: "missing",
      reason: "Review score is not available.",
    };
  }

  if (score < 50) {
    return {
      label: "weak",
      reason: `Review score is weak at ${score}.`,
    };
  }

  if (score < 70) {
    return {
      label: "partial",
      reason: `Review score is partial at ${score}.`,
    };
  }

  if (score < 85) {
    return {
      label: "acceptable",
      reason: `Review score is acceptable at ${score}.`,
    };
  }

  return {
    label: "strong",
    reason: `Review score is strong at ${score}.`,
  };
}

export function hasExecutionFailures(factors: ReleaseReadinessFactors): boolean {
  return (
    Number(factors.failed ?? 0) > 0 ||
    Number(factors.timedOut ?? 0) > 0
  );
}

export function hasExecutionBlockers(factors: ReleaseReadinessFactors): boolean {
  return Number(factors.blocked ?? 0) > 0;
}

export function hasExecutionWarnings(factors: ReleaseReadinessFactors): boolean {
  return (
    Number(factors.skipped ?? 0) > 0 ||
    Number(factors.unknown ?? 0) > 0 ||
    String(factors.suiteStatus ?? "").toLowerCase() === "partial"
  );
}

export function hasSuiteVersionMismatch(
  factors: ReleaseReadinessFactors
): boolean {
  if (
    typeof factors.suiteVersion !== "number" ||
    typeof factors.executionSuiteVersion !== "number"
  ) {
    return false;
  }

  return factors.suiteVersion !== factors.executionSuiteVersion;
}

export function isExecutionPartial(factors: ReleaseReadinessFactors): boolean {
  const suiteCount = Number(factors.suiteCaseCount ?? 0);
  const executionTotal = Number(factors.executionTotal ?? 0);
  const suiteStatus = String(factors.suiteStatus ?? "").toLowerCase();

  if (suiteStatus === "partial") return true;
  if (suiteCount > 0 && executionTotal > 0 && executionTotal < suiteCount) {
    return true;
  }

  return false;
}

export function calculateConfidence(
  factors: ReleaseReadinessFactors
): ReleaseReadinessConfidence {
  if (
    !factors.suitePresent ||
    !factors.reviewPresent ||
    !factors.executionEvidencePresent
  ) {
    return "low";
  }

  if (!factors.requirementPresent || isExecutionPartial(factors)) {
    return "medium";
  }

  return "high";
}

export function chooseMostSevereStatus(
  statuses: ReleaseReadinessStatus[]
): ReleaseReadinessStatus {
  const severityByStatus: Record<ReleaseReadinessStatus, number> = {
    insufficient_data: 100,
    blocked: 90,
    not_ready: 80,
    weak: 70,
    partial: 60,
    ready_with_risk: 40,
    ready: 10,
  };

  return statuses.reduce<ReleaseReadinessStatus>((mostSevere, current) => {
    return severityByStatus[current] > severityByStatus[mostSevere]
      ? current
      : mostSevere;
  }, "ready");
}