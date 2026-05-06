// lib/server/release-readiness/releaseReadinessTypes.ts
// M17 Release Readiness:
// Shared deterministic types for derived release readiness reporting.
// This layer is read-only and must not mutate source artifacts.

export type ReleaseReadinessStatus =
  | "insufficient_data"
  | "not_ready"
  | "weak"
  | "partial"
  | "ready_with_risk"
  | "ready"
  | "blocked";

export type ReleaseReadinessConfidence = "low" | "medium" | "high";

export type ReleaseReadinessFactors = {
  requirementPresent: boolean;
  suitePresent: boolean;
  reviewPresent: boolean;
  executionEvidencePresent: boolean;

  suiteVersion?: number;
  suiteCaseCount?: number;

  reviewScore?: number;
  reviewVerdict?: string;

  executionSuiteVersion?: number;
  executionTotal?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  blocked?: number;
  timedOut?: number;
  unknown?: number;
  suiteStatus?: string;
};

export type ReleaseReadinessSummary = {
  artifactType: "releaseReadiness";
  version: 1;
  generatedAt: string;

  status: ReleaseReadinessStatus;
  confidence: ReleaseReadinessConfidence;

  summary: string;
  factors: ReleaseReadinessFactors;

  reasons: string[];
  warnings: string[];
  recommendedActions: string[];
};

export type ReleaseReadinessStatusRank = {
  status: ReleaseReadinessStatus;
  severity: number;
};