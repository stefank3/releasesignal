// lib/artifacts/artifactHelpers.ts
// Helper utilities for safely reading/writing session artifacts.

import type { SessionArtifact } from "./artifact.types";

export function emptyArtifact(): SessionArtifact {
  return {
    refinedRequirement: undefined,
    testSuite: undefined,
    reviewResult: undefined,
    suiteVersion: 1,
  };
}

export function normalizeArtifact(input: unknown): SessionArtifact {
  if (!input || typeof input !== "object") {
    return emptyArtifact();
  }

  const raw = input as Partial<SessionArtifact>;

  return {
    refinedRequirement: raw.refinedRequirement,
    testSuite: Array.isArray(raw.testSuite) ? raw.testSuite : undefined,
    reviewResult: raw.reviewResult,
    suiteVersion:
      typeof raw.suiteVersion === "number" && raw.suiteVersion > 0
        ? raw.suiteVersion
        : 1,
  };
}