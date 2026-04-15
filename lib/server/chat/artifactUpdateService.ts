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
//
// M12 Step 5 CHANGE:
// - enforce deterministic suite normalization before persist
// - validate suite before save
// - mirror testSuite into featureWorkspace only when that wrapper already exists
//
// M12 Step 7 CHANGE:
// - keep persisted review aligned with latest suite / requirement context
// - remove ad hoc artifact shape drift from returned state
//
// BUG FIX (M12.8):
// - add standalone review artifact ingestion before deterministic review
// - parse explicit structured requirement input via artifact-layer parser
// - parse pasted suite text via deterministic test suite parser
// - persist once, using artifact state as the only review input source
//
// M12.13 CHANGE:
// - add persisted execution intelligence artifact writes
// - keep execution persistence artifact-driven and deterministic
// - mirror execution state into featureWorkspace only when that wrapper already exists
//
// M12.14 CHANGE:
// - persist classification-aware execution artifacts without adding service-side rules
// - keep failure classification fully artifact-owned
// - preserve backward compatibility when execution classification is absent
//
// M12.15 CHANGE:
// - add persisted release-health artifact writes
// - keep release-health computation outside this service
// - mirror release-health state into featureWorkspace only when that wrapper already exists
// - preserve existing requirement/suite/review/execution behavior
//
// M12.18 CHANGE:
// - clear stale review/release-health when requirement changes through guided or standalone ingestion
// - preserve suite on requirement change, but do not rewrite its lineage
// - stamp persisted suites with current requirement version
// - clear stale review/release-health when a new suite is persisted

import { type ReviewResult } from "@/lib/framework/reviewSchema";

import {
  type ExecutionIntelligenceArtifact,
  type ReleaseHealthArtifact,
  type SessionArtifact,
  type TestSuiteArtifact,
  getRefinedRequirementVersion,
  getReviewRequirementVersion,
  getReviewSuiteVersion,
  getTestSuiteRequirementVersion,
  mergeArtifact,
  normalizeExecutionIntelligenceArtifact,
  normalizeReleaseHealthArtifact,
  normalizeTestCase,
  parseGuidedAnswerToRefinedRequirement,
  parseStructuredRequirementInput,
  validateTestSuite,
} from "@/lib/chat/artifact";

import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";
import {
  parseGeneratedTestCases,
  withUpdatedTestSuiteArtifact,
} from "@/lib/server/chat/testSuiteService";

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
 * M12 / Step 7:
 * Persist the latest review result as artifact state so Review is not only
 * represented as a chat response, and keep it aligned with the latest
 * requirement + suite context when featureWorkspace already exists.
 */
function withUpdatedReviewArtifact(
  artifact: SessionArtifact | null,
  reviewResult: ReviewResult
): SessionArtifact {
  const base = isRecord(artifact) ? { ...artifact } : {};

  // M12.18:
  // Stamp lineage at persistence time so later requirement/suite evolution can
  // deterministically invalidate stale review state.
  const stampedReviewResult: ReviewResult = {
    ...reviewResult,
    ...(typeof getRefinedRequirementVersion(base.refinedRequirement) === "number"
      ? {
          basedOnRequirementVersion: getRefinedRequirementVersion(
            base.refinedRequirement
          )!,
        }
      : {}),
    ...(typeof base.testSuite?.version === "number"
      ? { basedOnSuiteVersion: base.testSuite.version }
      : {}),
  };

  const next = {
    ...base,
    reviewResult: stampedReviewResult,
  } as SessionArtifact & Record<string, unknown>;

  if (isRecord(base.featureWorkspace)) {
    next.featureWorkspace = {
      ...base.featureWorkspace,
      ...(base.refinedRequirement
        ? { refinedRequirement: base.refinedRequirement }
        : {}),
      ...(base.testSuite ? { testSuite: base.testSuite } : {}),
      reviewResult: stampedReviewResult,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  return next as SessionArtifact;
}

/**
 * M12.13 / M12.14:
 * Persist normalized execution state as the single source of truth.
 * Classification, when present, is already normalized upstream in the
 * artifact/parser layers. This service only mirrors persisted artifact state.
 */
function withUpdatedExecutionArtifact(
  artifact: SessionArtifact | null,
  executionIntelligence: ExecutionIntelligenceArtifact
): SessionArtifact {
  const base = isRecord(artifact) ? { ...artifact } : {};
  const normalizedExecution =
    normalizeExecutionIntelligenceArtifact(executionIntelligence);

  const next = {
    ...base,
    executionIntelligence: normalizedExecution,
  } as SessionArtifact & Record<string, unknown>;

  if (isRecord(base.featureWorkspace)) {
    next.featureWorkspace = {
      ...base.featureWorkspace,
      ...(base.refinedRequirement
        ? { refinedRequirement: base.refinedRequirement }
        : {}),
      ...(base.testSuite ? { testSuite: base.testSuite } : {}),
      ...(base.reviewResult ? { reviewResult: base.reviewResult } : {}),
      executionIntelligence: normalizedExecution,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  return next as SessionArtifact;
}

/**
 * M12.15:
 * Persist normalized release health as the single source of truth.
 * Release health must already be computed deterministically upstream.
 * This service only normalizes and mirrors persisted artifact state.
 */
function withUpdatedReleaseHealthState(
  artifact: SessionArtifact | null,
  releaseHealth: ReleaseHealthArtifact
): SessionArtifact {
  const base = isRecord(artifact) ? { ...artifact } : {};
  const normalizedReleaseHealth = normalizeReleaseHealthArtifact(releaseHealth);

  const next = {
    ...base,
    releaseHealth: normalizedReleaseHealth,
  } as SessionArtifact & Record<string, unknown>;

  if (isRecord(base.featureWorkspace)) {
    next.featureWorkspace = {
      ...base.featureWorkspace,
      ...(base.refinedRequirement
        ? { refinedRequirement: base.refinedRequirement }
        : {}),
      ...(base.testSuite ? { testSuite: base.testSuite } : {}),
      ...(base.reviewResult ? { reviewResult: base.reviewResult } : {}),
      ...(base.executionIntelligence
        ? { executionIntelligence: base.executionIntelligence }
        : {}),
      releaseHealth: normalizedReleaseHealth,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  return next as SessionArtifact;
}

function withFeatureWorkspaceSuiteMirror(
  artifact: SessionArtifact,
  testSuite: TestSuiteArtifact
): SessionArtifact {
  if (!isRecord(artifact.featureWorkspace)) {
    return artifact;
  }

  return {
    ...artifact,
    featureWorkspace: {
      ...artifact.featureWorkspace,
      testSuite,
      ...(artifact.refinedRequirement
        ? { refinedRequirement: artifact.refinedRequirement }
        : {}),
      ...(artifact.executionIntelligence
        ? { executionIntelligence: artifact.executionIntelligence }
        : {}),
      ...(artifact.releaseHealth ? { releaseHealth: artifact.releaseHealth } : {}),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}

function withFeatureWorkspaceRequirementMirror(
  artifact: SessionArtifact
): SessionArtifact {
  if (!isRecord(artifact.featureWorkspace)) {
    return artifact;
  }

  return {
    ...artifact,
    featureWorkspace: {
      ...artifact.featureWorkspace,
      ...(artifact.refinedRequirement
        ? { refinedRequirement: artifact.refinedRequirement }
        : {}),
      ...(artifact.testSuite ? { testSuite: artifact.testSuite } : {}),
      ...(artifact.executionIntelligence
        ? { executionIntelligence: artifact.executionIntelligence }
        : {}),
      ...(artifact.releaseHealth ? { releaseHealth: artifact.releaseHealth } : {}),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}

/**
 * M12.18:
 * Requirement refinement changes the baseline for downstream derived artifacts.
 * Preserve the suite, but clear review/release-health when the requirement
 * version advances. Do not rewrite suite lineage here; stale detection depends
 * on the mismatch remaining explicit.
 */
function applyRequirementRefinementEffects(args: {
  previousArtifact: SessionArtifact | null;
  nextArtifact: SessionArtifact;
}): SessionArtifact {
  const previousRequirementVersion = getRefinedRequirementVersion(
    args.previousArtifact?.refinedRequirement
  );
  const nextRequirementVersion = getRefinedRequirementVersion(
    args.nextArtifact.refinedRequirement
  );

  if (
    previousRequirementVersion != null &&
    nextRequirementVersion != null &&
    previousRequirementVersion === nextRequirementVersion
  ) {
    return args.nextArtifact;
  }

  const preservedSuite = args.previousArtifact?.testSuite ?? args.nextArtifact.testSuite;

  return {
    ...args.nextArtifact,
    ...(preservedSuite ? { testSuite: preservedSuite } : {}),
    reviewResult: undefined,
    releaseHealth: undefined,
    ...(isRecord(args.nextArtifact.featureWorkspace)
      ? {
          featureWorkspace: {
            ...args.nextArtifact.featureWorkspace,
            ...(preservedSuite ? { testSuite: preservedSuite } : {}),
            refinedRequirement: args.nextArtifact.refinedRequirement,
            reviewResult: undefined,
            releaseHealth: undefined,
            lastUpdatedAt: new Date().toISOString(),
          },
        }
      : {}),
  };
}

/**
 * M12.18:
 * When a suite is newly persisted or replaced, any existing review/release-health
 * is potentially stale because both are derived from suite content/version.
 */
function applySuitePersistenceEffects(args: {
  previousArtifact: SessionArtifact | null;
  nextArtifact: SessionArtifact;
}): SessionArtifact {
  const previousSuiteVersion =
    typeof args.previousArtifact?.testSuite?.version === "number"
      ? args.previousArtifact.testSuite.version
      : null;
  const nextSuiteVersion =
    typeof args.nextArtifact.testSuite?.version === "number"
      ? args.nextArtifact.testSuite.version
      : null;

  const reviewBasedOnSuiteVersion = getReviewSuiteVersion(
    args.previousArtifact?.reviewResult
  );
  const reviewBasedOnRequirementVersion = getReviewRequirementVersion(
    args.previousArtifact?.reviewResult
  );
  const currentRequirementVersion = getRefinedRequirementVersion(
    args.nextArtifact.refinedRequirement
  );

  const suiteChanged =
    previousSuiteVersion == null ||
    nextSuiteVersion == null ||
    previousSuiteVersion !== nextSuiteVersion;

  if (!suiteChanged) {
    return args.nextArtifact;
  }

  const shouldClearReview =
    !!args.previousArtifact?.reviewResult &&
    (
      reviewBasedOnSuiteVersion == null ||
      nextSuiteVersion == null ||
      reviewBasedOnSuiteVersion !== nextSuiteVersion ||
      (
        currentRequirementVersion != null &&
        reviewBasedOnRequirementVersion != null &&
        reviewBasedOnRequirementVersion !== currentRequirementVersion
      )
    );

  return {
    ...args.nextArtifact,
    ...(shouldClearReview ? { reviewResult: undefined } : {}),
    releaseHealth: undefined,
    ...(isRecord(args.nextArtifact.featureWorkspace)
      ? {
          featureWorkspace: {
            ...args.nextArtifact.featureWorkspace,
            testSuite: args.nextArtifact.testSuite,
            ...(args.nextArtifact.refinedRequirement
              ? { refinedRequirement: args.nextArtifact.refinedRequirement }
              : {}),
            ...(shouldClearReview ? { reviewResult: undefined } : {}),
            releaseHealth: undefined,
            lastUpdatedAt: new Date().toISOString(),
          },
        }
      : {}),
  };
}

function buildFreshSuiteFromParsedCases(
  parsedCases: Array<{ title: string; body: string }>,
  basedOnRequirementVersion: number | null
): TestSuiteArtifact | null {
  if (!parsedCases.length) return null;

  const nowIso = new Date().toISOString();

  return {
    version: 1,
    createdAt: nowIso,
    lastUpdatedAt: nowIso,
    ...(typeof basedOnRequirementVersion === "number"
      ? { basedOnRequirementVersion }
      : {}),
    cases: parsedCases.map((testCase, index) =>
      normalizeTestCase({
        id: `TC-${String(index + 1).padStart(3, "0")}`,
        title: testCase.title,
        body: testCase.body,
      })
    ),
  };
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

  const mergedArtifact = withFeatureWorkspaceRequirementMirror(
    mergeArtifact(args.sessionArtifact, patch)
  );

  // M12.18:
  // Guided refinement must enforce the same invalidation rules as the main
  // coach flow, otherwise old review state survives requirement changes.
  const nextArtifact = applyRequirementRefinementEffects({
    previousArtifact: args.sessionArtifact,
    nextArtifact: mergedArtifact,
  });

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

export async function applyStandaloneReviewArtifactPatch(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  message: string;
  reviewMode: boolean;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.reviewMode) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const requirementPatch = parseStructuredRequirementInput(args.message);

  let nextArtifact: SessionArtifact =
    args.sessionArtifact && typeof args.sessionArtifact === "object"
      ? args.sessionArtifact
      : {};

  if (requirementPatch) {
    const mergedArtifact = mergeArtifact(nextArtifact, requirementPatch);
    nextArtifact = withFeatureWorkspaceRequirementMirror(mergedArtifact);
    nextArtifact = applyRequirementRefinementEffects({
      previousArtifact: args.sessionArtifact,
      nextArtifact,
    });
  }

  const requirementVersionForSuite = getRefinedRequirementVersion(
    nextArtifact.refinedRequirement
  );

  const parsedCases = parseGeneratedTestCases(args.message);
  const nextStandaloneSuite = buildFreshSuiteFromParsedCases(
    parsedCases,
    requirementVersionForSuite
  );

  if (!requirementPatch && !nextStandaloneSuite) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  if (nextStandaloneSuite) {
    validateTestSuite(nextStandaloneSuite);

    const nextArtifactBase = withUpdatedTestSuiteArtifact(
      nextArtifact,
      nextStandaloneSuite
    );

    const mirroredArtifact = withFeatureWorkspaceSuiteMirror(
      nextArtifactBase,
      nextStandaloneSuite
    );

    nextArtifact = applySuitePersistenceEffects({
      previousArtifact: args.sessionArtifact,
      nextArtifact: mirroredArtifact,
    });
  }

  const saved = await saveSessionArtifact({
    sessionId: args.sessionId,
    artifact: nextArtifact,
  });

  return {
    sessionArtifact: saved.artifact,
    artifactUpdatedAtIso: saved.artifactUpdatedAtIso,
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

  const currentRequirementVersion = getRefinedRequirementVersion(
    args.sessionArtifact?.refinedRequirement
  );

  const normalizedSuite: TestSuiteArtifact = {
    ...args.nextTestSuiteArtifact,
    ...(typeof currentRequirementVersion === "number"
      ? { basedOnRequirementVersion: currentRequirementVersion }
      : {}),
    cases: args.nextTestSuiteArtifact.cases.map((c) => normalizeTestCase(c)),
  };

  validateTestSuite(normalizedSuite);

  const nextArtifactBase = withUpdatedTestSuiteArtifact(
    args.sessionArtifact,
    normalizedSuite
  );

  const mirroredArtifact = withFeatureWorkspaceSuiteMirror(
    nextArtifactBase,
    normalizedSuite
  );

  const nextArtifact = applySuitePersistenceEffects({
    previousArtifact: args.sessionArtifact,
    nextArtifact: mirroredArtifact,
  });

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

export async function persistExecutionArtifact(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  executionIntelligence: ExecutionIntelligenceArtifact | null;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.executionIntelligence) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  // M12.14:
  // Normalize again at persistence boundary so saved execution state,
  // including optional failure classification summary, cannot drift.
  const nextArtifact = withUpdatedExecutionArtifact(
    args.sessionArtifact,
    args.executionIntelligence
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

export async function persistReleaseHealthArtifact(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  releaseHealth: ReleaseHealthArtifact | null;
}): Promise<{
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  if (!args.releaseHealth) {
    return {
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  // M12.15:
  // Normalize again at persistence boundary so saved release-health state
  // cannot drift from the locked artifact contract.
  const nextArtifact = withUpdatedReleaseHealthState(
    args.sessionArtifact,
    args.releaseHealth
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