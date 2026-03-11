// lib/artifacts/artifactMerger.ts
// M10: central place for artifact mutation/merge logic.
// This avoids ad-hoc artifact merging inside route handlers or UI code.

import type {
  RefinedRequirement,
  ReviewResult,
  SessionArtifact,
  TestCaseItem,
} from "./artifact.types";
import { normalizeArtifact } from "./artifactHelpers";

export function mergeRefinedRequirement(
  current: unknown,
  refinedRequirement: RefinedRequirement
): SessionArtifact {
  const base = normalizeArtifact(current);

  return {
    ...base,
    refinedRequirement,
  };
}

export function mergeTestSuite(
  current: unknown,
  testSuite: TestCaseItem[]
): SessionArtifact {
  const base = normalizeArtifact(current);

  return {
    ...base,
    testSuite,
    suiteVersion: (base.suiteVersion ?? 1) + 1,
  };
}

export function mergeReviewResult(
  current: unknown,
  reviewResult: ReviewResult
): SessionArtifact {
  const base = normalizeArtifact(current);

  return {
    ...base,
    reviewResult,
  };
}