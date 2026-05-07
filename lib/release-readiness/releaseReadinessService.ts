// lib/server/release-readiness/releaseReadinessService.ts
// M17 Release Readiness:
// Derived deterministic release readiness summary from persisted artifacts.
// This service is read-only: it must not mutate requirement, suite, review, or execution evidence.

import type { SessionArtifact } from "@/lib/chat/artifact";

import {
  calculateConfidence,
  chooseMostSevereStatus,
  getReviewBand,
  hasExecutionBlockers,
  hasExecutionFailures,
  hasExecutionWarnings,
  hasSuiteVersionMismatch,
  isExecutionPartial,
} from "./releaseReadinessRules";
import type {
  ReleaseReadinessFactors,
  ReleaseReadinessStatus,
  ReleaseReadinessSummary,
} from "./releaseReadinessTypes";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNestedRecord(
  source: UnknownRecord | null,
  key: string
): UnknownRecord | null {
  if (!source) return null;
  return asRecord(source[key]);
}

function getNestedNumber(
  source: UnknownRecord | null,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = readNumber(source?.[key]);
    if (typeof value === "number") return value;
  }

  return undefined;
}

function getNestedString(
  source: UnknownRecord | null,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = readString(source?.[key]);
    if (value) return value;
  }

  return undefined;
}

function extractTopReviewGaps(reviewResult: UnknownRecord | null): string[] {
  if (!reviewResult) return [];

  const possibleGapFields = [
    reviewResult.topRiskGaps,
    reviewResult.riskGaps,
    reviewResult.majorGaps,
    reviewResult.gaps,
    reviewResult.recommendations,
  ];

  for (const field of possibleGapFields) {
    if (Array.isArray(field)) {
      return field
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 5);
    }
  }

  return [];
}

function buildFactors(artifact: SessionArtifact | null): ReleaseReadinessFactors {
  const artifactRecord = asRecord(artifact);

  const requirement = artifactRecord?.refinedRequirement;
  const suite = asRecord(artifactRecord?.testSuite);
  const review = asRecord(artifactRecord?.reviewResult);
  const execution = asRecord(artifactRecord?.executionIntelligence);

  const executionSummary =
    getNestedRecord(execution, "summary") ??
    getNestedRecord(execution, "executionSummary") ??
    execution;

  const suiteCases = Array.isArray(suite?.cases) ? suite.cases : [];

  return {
    requirementPresent: !!requirement,
    suitePresent: suiteCases.length > 0,
    reviewPresent: !!review,
    executionEvidencePresent: !!execution,

    suiteVersion: readNumber(suite?.version),
    suiteCaseCount: suiteCases.length || undefined,

    reviewScore: readNumber(review?.score),
    reviewVerdict: readString(review?.verdict),

    executionSuiteVersion:
      getNestedNumber(execution, ["suiteVersion", "linkedSuiteVersion"]) ??
      getNestedNumber(executionSummary, ["suiteVersion", "linkedSuiteVersion"]),

    executionTotal: getNestedNumber(executionSummary, ["total", "totalResults"]),
    passed: getNestedNumber(executionSummary, ["passed"]),
    failed: getNestedNumber(executionSummary, ["failed"]),
    skipped: getNestedNumber(executionSummary, ["skipped"]),
    blocked: getNestedNumber(executionSummary, ["blocked"]),
    timedOut: getNestedNumber(executionSummary, ["timedOut", "timed_out"]),
    unknown: getNestedNumber(executionSummary, ["unknown"]),
    suiteStatus: getNestedString(executionSummary, ["suiteStatus", "status"]),
  };
}

function buildMissingPrerequisiteReasons(
  factors: ReleaseReadinessFactors
): string[] {
  const reasons: string[] = [];

  if (!factors.suitePresent) {
    reasons.push("A test suite artifact is required before readiness can be assessed.");
  }

  if (!factors.reviewPresent) {
    reasons.push("A persisted review result is required before readiness can be assessed.");
  }

  if (!factors.executionEvidencePresent) {
    reasons.push("Execution evidence is required before readiness can be assessed.");
  }

  return reasons;
}

function buildRecommendedActions(args: {
  factors: ReleaseReadinessFactors;
  status: ReleaseReadinessStatus;
}): string[] {
  const actions: string[] = [];

  if (!args.factors.suitePresent) {
    actions.push("Generate or upload a test suite.");
  }

  if (args.factors.suitePresent && !args.factors.reviewPresent) {
    actions.push("Run Review Suite for the current test suite.");
  }

  if (args.factors.suitePresent && !args.factors.executionEvidencePresent) {
    actions.push("Import execution evidence for the current test suite.");
  }

  if (hasSuiteVersionMismatch(args.factors)) {
    actions.push("Import execution evidence linked to the current suite version.");
  }

  if (hasExecutionBlockers(args.factors)) {
    actions.push("Resolve blocked execution results before considering release readiness.");
  }

  if (hasExecutionFailures(args.factors)) {
    actions.push("Investigate failed or timed-out execution results.");
  }

  if (args.status === "weak" || args.status === "not_ready") {
    actions.push("Improve the test suite and run review again.");
  }

  if (!actions.length && args.status === "ready_with_risk") {
    actions.push("Review remaining warnings and decide whether the residual risk is acceptable.");
  }

  if (!actions.length && args.status === "ready") {
    actions.push("Proceed with release decision using the current readiness evidence.");
  }

  return actions;
}

function buildWarnings(args: {
  factors: ReleaseReadinessFactors;
  reviewGaps: string[];
}): string[] {
  const warnings: string[] = [];

  if (!args.factors.requirementPresent) {
    warnings.push("No refined requirement is available, so readiness confidence is reduced.");
  }

  if (hasSuiteVersionMismatch(args.factors)) {
    warnings.push("Execution evidence is not linked to the current suite version.");
  }

  if (isExecutionPartial(args.factors)) {
    warnings.push("Execution evidence appears partial or incomplete.");
  }

  if (Number(args.factors.skipped ?? 0) > 0) {
    warnings.push(`${args.factors.skipped} execution result(s) were skipped.`);
  }

  if (Number(args.factors.unknown ?? 0) > 0) {
    warnings.push(`${args.factors.unknown} execution result(s) have unknown status.`);
  }

  for (const gap of args.reviewGaps) {
    warnings.push(`Review gap: ${gap}`);
  }

  return warnings.slice(0, 8);
}

function determineStatus(args: {
  factors: ReleaseReadinessFactors;
  reviewGaps: string[];
}): ReleaseReadinessStatus {
  const missingPrerequisites = buildMissingPrerequisiteReasons(args.factors);

  if (missingPrerequisites.length > 0) {
    return "insufficient_data";
  }

  const reviewBand = getReviewBand(args.factors.reviewScore);
  const candidateStatuses: ReleaseReadinessStatus[] = ["ready"];

  if (hasSuiteVersionMismatch(args.factors) || hasExecutionBlockers(args.factors)) {
    candidateStatuses.push("blocked");
  }

  if (hasExecutionFailures(args.factors)) {
    candidateStatuses.push("not_ready");
  }

  if (reviewBand.label === "weak") {
    candidateStatuses.push("weak");
  }

  if (reviewBand.label === "partial" || isExecutionPartial(args.factors)) {
    candidateStatuses.push("partial");
  }

  if (
    reviewBand.label === "acceptable" ||
    hasExecutionWarnings(args.factors) ||
    args.reviewGaps.length > 0 ||
    !args.factors.requirementPresent
  ) {
    candidateStatuses.push("ready_with_risk");
  }

  return chooseMostSevereStatus(candidateStatuses);
}

function buildSummaryText(status: ReleaseReadinessStatus): string {
  switch (status) {
    case "insufficient_data":
      return "Release readiness cannot be calculated yet because required artifacts are missing.";
    case "blocked":
      return "Release readiness is blocked by trusted evidence problems or blocking execution outcomes.";
    case "not_ready":
      return "Release readiness is not ready because execution or design quality signals require attention.";
    case "weak":
      return "Release readiness is weak because design quality or risk coverage is below the expected threshold.";
    case "partial":
      return "Release readiness is partial because the available evidence is incomplete or only partially acceptable.";
    case "ready_with_risk":
      return "Release readiness is acceptable with remaining risk.";
    case "ready":
      return "Release readiness signal is strong based on the current artifacts.";
    default:
      return "Release readiness status is unavailable.";
  }
}

function buildReasons(args: {
  factors: ReleaseReadinessFactors;
  reviewGaps: string[];
  status: ReleaseReadinessStatus;
}): string[] {
  const reasons = buildMissingPrerequisiteReasons(args.factors);

  if (reasons.length > 0) return reasons;

  const reviewBand = getReviewBand(args.factors.reviewScore);
  reasons.push(reviewBand.reason);

  if (typeof args.factors.suiteCaseCount === "number") {
    reasons.push(`Current suite contains ${args.factors.suiteCaseCount} test case(s).`);
  }

  if (typeof args.factors.executionTotal === "number") {
    reasons.push(`Execution evidence contains ${args.factors.executionTotal} result(s).`);
  }

  if (Number(args.factors.passed ?? 0) > 0) {
    reasons.push(`${args.factors.passed} execution result(s) passed.`);
  }

  if (Number(args.factors.failed ?? 0) > 0) {
    reasons.push(`${args.factors.failed} execution result(s) failed.`);
  }

  if (Number(args.factors.blocked ?? 0) > 0) {
    reasons.push(`${args.factors.blocked} execution result(s) are blocked.`);
  }

  if (Number(args.factors.timedOut ?? 0) > 0) {
    reasons.push(`${args.factors.timedOut} execution result(s) timed out.`);
  }

  if (args.status === "ready" && args.reviewGaps.length === 0) {
    reasons.push("No blocking review or execution issues were detected.");
  }

  return reasons.slice(0, 8);
}

export function buildReleaseReadinessSummary(
  artifact: SessionArtifact | null
): ReleaseReadinessSummary {
  const artifactRecord = asRecord(artifact);
  const review = asRecord(artifactRecord?.reviewResult);

  const factors = buildFactors(artifact);
  const reviewGaps = extractTopReviewGaps(review);
  const status = determineStatus({ factors, reviewGaps });
  const confidence = calculateConfidence(factors);

  return {
    artifactType: "releaseReadiness",
    version: 1,
    generatedAt: new Date().toISOString(),
    status,
    confidence,
    summary: buildSummaryText(status),
    factors,
    reasons: buildReasons({ factors, reviewGaps, status }),
    warnings: buildWarnings({ factors, reviewGaps }),
    recommendedActions: buildRecommendedActions({ factors, status }),
  };
}