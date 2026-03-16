// lib/server/chat/artifactUpdateService.ts
// M10 Pass 11
// Centralize small artifact update workflows so route.ts no longer owns
// raw artifact patching / persistence details.
//
// SURGICAL CHANGE:
// - extract guided-answer artifact patching
// - extract persisted suite artifact writes after Cases flow
//
// M11 CHANGE:
// - classify guided requirement refinement outcome
// - return structured telemetry info to the caller
// - do NOT emit telemetry directly from this service yet
//
// M12 CHANGE:
// - add persisted review artifact writes after Review flow
// - keep route.ts orchestration-only
// - prepare artifact-driven design/review consistency
// - mirror review into featureWorkspace only when that wrapper already exists

import { type ReviewResult } from "@/lib/framework/reviewSchema";

import {
  type SessionArtifact,
  type TestSuiteArtifact,
  mergeArtifact,
  parseGuidedAnswerToRefinedRequirement,
} from "@/lib/chat/artifact";

import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";
import { withUpdatedTestSuiteArtifact } from "@/lib/server/chat/testSuiteService";

// M11:
// Structured telemetry classification for requirement refinement.
// Route.ts will later add request/session/user/org context and persist it.
export type RequirementRefinedTelemetry = {
  eventType: "requirement_refined";
  artifactType: "refinedRequirement";
  metadata: {
    hasObjective: boolean;
    hasContext: boolean;
    inScopeCount: number;
    outOfScopeCount: number;
    integrationsCount: number;
    riskFocusCount: number;
    acceptanceCriteriaCount: number;
  };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * M12:
 * Persist the latest review result as artifact state so Review is not only
 * represented as a chat response. This is the first backend step toward
 * stronger suite/review consistency.
 *
 * Notes:
 * - keeps existing top-level artifact structure intact
 * - mirrors into featureWorkspace.reviewResult only if featureWorkspace exists
 * - avoids forcing broader artifact migrations in this step
 */
function withUpdatedReviewArtifact(
  artifact: SessionArtifact | null,
  reviewResult: ReviewResult
): SessionArtifact {
  const base = isRecord(artifact) ? { ...artifact } : {};
  const next = {
    ...base,
    reviewResult,
  } as SessionArtifact & Record<string, unknown>;

  if (isRecord(base.featureWorkspace)) {
    next.featureWorkspace = {
      ...base.featureWorkspace,
      reviewResult,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  return next as SessionArtifact;
}

export async function applyGuidedArtifactPatch(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  message: string;
  guidedAnswer: boolean;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;

  // M11:
  // Non-null only when a valid guided refinement patch was parsed
  // and successfully persisted.
  requirementTelemetry: RequirementRefinedTelemetry | null;
}> {
  if (!args.guidedAnswer) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
      requirementTelemetry: null,
    };
  }

  const patch = parseGuidedAnswerToRefinedRequirement(args.message);

  if (!patch) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
      requirementTelemetry: null,
    };
  }

  const nextArtifact = mergeArtifact(args.sessionArtifact, patch);

  const saved = await saveSessionArtifact({
    sessionId: args.sessionId,
    artifact: nextArtifact,
  });

  // M11:
  // Build structured requirement telemetry only after successful persistence.
  const rr = saved.artifact?.refinedRequirement ?? {};

  const requirementTelemetry: RequirementRefinedTelemetry = {
    eventType: "requirement_refined",
    artifactType: "refinedRequirement",
    metadata: {
      hasObjective: !!rr.objective,
      hasContext: !!rr.context,
      inScopeCount: rr.inScope?.length ?? 0,
      outOfScopeCount: rr.outOfScope?.length ?? 0,
      integrationsCount: rr.integrations?.length ?? 0,
      riskFocusCount: rr.riskFocus?.length ?? 0,
      acceptanceCriteriaCount: rr.acceptanceCriteria?.length ?? 0,
    },
  };

  return {
    sessionArtifact: saved.artifact,
    artifactUpdatedAtIso: saved.artifactUpdatedAtIso,
    requirementTelemetry,
  };
}

export async function persistGeneratedSuiteArtifact(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.nextTestSuiteArtifact) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const nextArtifact = withUpdatedTestSuiteArtifact(
    args.sessionArtifact,
    args.nextTestSuiteArtifact
  );

  const saved = await saveSessionArtifact({
    sessionId: args.sessionId,
    artifact: nextArtifact,
  });

  return {
    sessionArtifact: saved.artifact,
    artifactUpdatedAtIso: saved.artifactUpdatedAtIso,
  };
}

export async function persistReviewArtifact(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  reviewResult: ReviewResult | null;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.reviewResult) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const nextArtifact = withUpdatedReviewArtifact(
    args.sessionArtifact,
    args.reviewResult
  );

  const saved = await saveSessionArtifact({
    sessionId: args.sessionId,
    artifact: nextArtifact,
  });

  return {
    sessionArtifact: saved.artifact,
    artifactUpdatedAtIso: saved.artifactUpdatedAtIso,
  };
}