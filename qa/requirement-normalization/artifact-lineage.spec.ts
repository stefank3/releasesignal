import { expect, test } from "@playwright/test";
import {
  getArtifactConsistencyState,
  type SessionArtifact,
} from "../../lib/chat/artifact";

const NOW = "2026-07-17T10:00:00.000Z";

function buildArtifact(args: {
  requirementVersion?: number;
  suiteVersion?: number;
  suiteRequirementVersion?: number;
  reviewRequirementVersion?: number;
  reviewSuiteVersion?: number;
}): SessionArtifact {
  const artifact: SessionArtifact = {};

  if (args.requirementVersion !== undefined) {
    artifact.refinedRequirement = {
      objective: "Characterize the current workspace lineage contract.",
      version: args.requirementVersion,
      lastUpdatedAt: NOW,
    };
  }

  if (args.suiteVersion !== undefined) {
    artifact.testSuite = {
      version: args.suiteVersion,
      basedOnRequirementVersion: args.suiteRequirementVersion,
      createdAt: NOW,
      lastUpdatedAt: NOW,
      cases: [],
    };
  }

  if (
    args.reviewRequirementVersion !== undefined ||
    args.reviewSuiteVersion !== undefined
  ) {
    artifact.reviewResult = {
      score: 80,
      verdict: "Strong",
      breakdown: {
        businessRelevance: 20,
        riskCoverage: 20,
        designQuality: 16,
        levelAndScope: 12,
        diagnosticValue: 12,
      },
      riskGaps: [],
      antiPatterns: [],
      improvements: [],
      basedOnRequirementVersion: args.reviewRequirementVersion,
      basedOnSuiteVersion: args.reviewSuiteVersion,
    };
  }

  return artifact;
}

test.describe("artifact lineage characterization", () => {
  test("classifies matching requirement, suite, and review lineage as current", () => {
    expect(
      getArtifactConsistencyState(
        buildArtifact({
          requirementVersion: 3,
          suiteVersion: 5,
          suiteRequirementVersion: 3,
          reviewRequirementVersion: 3,
          reviewSuiteVersion: 5,
        })
      )
    ).toEqual({
      requirementVersion: 3,
      suiteVersion: 5,
      suiteBasedOnRequirementVersion: 3,
      reviewBasedOnRequirementVersion: 3,
      reviewBasedOnSuiteVersion: 5,
      suiteStale: false,
      reviewStaleBecauseOfRequirement: false,
      reviewStaleBecauseOfSuite: false,
      reviewStale: false,
      hasStaleDownstream: false,
      reasons: [],
    });
  });

  test("classifies each version mismatch and preserves deterministic reasons", () => {
    expect(
      getArtifactConsistencyState(
        buildArtifact({
          requirementVersion: 4,
          suiteVersion: 7,
          suiteRequirementVersion: 3,
          reviewRequirementVersion: 2,
          reviewSuiteVersion: 6,
        })
      )
    ).toEqual({
      requirementVersion: 4,
      suiteVersion: 7,
      suiteBasedOnRequirementVersion: 3,
      reviewBasedOnRequirementVersion: 2,
      reviewBasedOnSuiteVersion: 6,
      suiteStale: true,
      reviewStaleBecauseOfRequirement: true,
      reviewStaleBecauseOfSuite: true,
      reviewStale: true,
      hasStaleDownstream: true,
      reasons: [
        "Test suite is based on requirement v3, but current requirement is v4.",
        "Review result is based on requirement v2, but current requirement is v4.",
        "Review result is based on suite v6, but current suite is v7.",
      ],
    });
  });

  test("defaults a legacy requirement to v1 while missing dependent lineage stays non-stale", () => {
    expect(
      getArtifactConsistencyState({
        refinedRequirement: {
          objective: "Legacy requirement without explicit version metadata.",
        },
        testSuite: {
          version: 2,
          cases: [],
          createdAt: NOW,
          lastUpdatedAt: NOW,
        },
        reviewResult: {
          score: 75,
          verdict: "Good",
          breakdown: {
            businessRelevance: 19,
            riskCoverage: 18,
            designQuality: 15,
            levelAndScope: 11,
            diagnosticValue: 12,
          },
          riskGaps: [],
          antiPatterns: [],
          improvements: [],
        },
      })
    ).toEqual({
      requirementVersion: 1,
      suiteVersion: 2,
      suiteBasedOnRequirementVersion: null,
      reviewBasedOnRequirementVersion: null,
      reviewBasedOnSuiteVersion: null,
      suiteStale: false,
      reviewStaleBecauseOfRequirement: false,
      reviewStaleBecauseOfSuite: false,
      reviewStale: false,
      hasStaleDownstream: false,
      reasons: [],
    });
  });

  test("returns an exact empty state when dependent artifacts are absent", () => {
    expect(
      getArtifactConsistencyState(
        buildArtifact({
          requirementVersion: 1,
        })
      )
    ).toEqual({
      requirementVersion: 1,
      suiteVersion: null,
      suiteBasedOnRequirementVersion: null,
      reviewBasedOnRequirementVersion: null,
      reviewBasedOnSuiteVersion: null,
      suiteStale: false,
      reviewStaleBecauseOfRequirement: false,
      reviewStaleBecauseOfSuite: false,
      reviewStale: false,
      hasStaleDownstream: false,
      reasons: [],
    });
  });
});
