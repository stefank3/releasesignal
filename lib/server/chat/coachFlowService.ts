// lib/server/chat/coachFlowService.ts
// M10 Pass 8
// Extract coach-mode orchestration from route.ts so the API route
// acts as a controller instead of owning workflow logic.
//
// M12.12 CHANGE:
// - preserve legacy coach parsing compatibility
// - add locked requirement-ingestion persistence path
// - map normalized requirement output into the current artifact contract
// - prefer normalized refined requirement persistence when available
// - fall back to legacy continuity patch only when ingestion normalization is unavailable
//
// M12.12 FIX:
// - keep Risk Areas separate from Test Strategy Hooks
// - do not synthesize hooks from risk areas or coverage targets
// - persist the normalized requirement without reintroducing duplicate semantic sections
//
// M12.18 CHANGE:
// - stamp requirement version through artifact merge path
// - preserve existing suite on requirement refinement, but make lineage mismatch explicit
// - clear stale review/release-health artifacts when the requirement materially changes
// - keep the route thin and keep workflow integrity decisions in service code

import type {
  RefinedRequirement,
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import {
  getRefinedRequirementVersion,
  getTestSuiteRequirementVersion,
  mergeArtifact,
} from "@/lib/chat/artifact";
import type { CoachResult } from "@/lib/framework/reviewSchema";

import {
  buildCoachContinuityArtifactPatch,
  coachToTechnicalRequirementText,
  shouldReturnTechnicalRequirement,
} from "@/lib/server/chat/coachFormatting";

import {
  parseCoachResponse,
  parseRefinedRequirementResponse,
} from "@/lib/server/chat/modelResponseParser";
import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";

function normalizedRequirementToArtifactPatch(
  requirement: Awaited<ReturnType<typeof parseRefinedRequirementResponse>>
): Partial<RefinedRequirement> | null {
  if (!requirement) return null;

  return {
    objective: requirement.objective,
    functionalScope: requirement.functionalScope,
    businessRules: requirement.businessRules,
    acceptanceCriteria: requirement.acceptanceCriteria,
    edgeCases: requirement.edgeCasesNegativePaths,
    edgeCasesNegativePaths: requirement.edgeCasesNegativePaths,
    nonFunctionalConstraints: requirement.nonFunctionalConstraints,

    // Keep hooks distinct.
    // Do not mirror Risk Areas or Coverage Targets into this field.
    testStrategyHooks: [],

    riskAreas: requirement.testStrategyHooks.riskAreas,
    coverageTargets: requirement.testStrategyHooks.coverageTargets,
    minimalReproScenarios: requirement.minimalReproScenarios,
    openQuestions: requirement.openQuestionsClarifications,
    openQuestionsClarifications: requirement.openQuestionsClarifications,
  };
}

/**
 * M12.18:
 * Apply requirement-refinement side effects after mergeArtifact(...) has stamped
 * the new requirement version.
 *
 * Workflow decision:
 * - testSuite is preserved so the user does not lose work, but it will become
 *   explicitly stale when its basedOnRequirementVersion no longer matches
 * - reviewResult is cleared when requirement version changes because it is an
 *   authoritative derived assessment and must not survive a changed baseline
 * - releaseHealth is also cleared because it is a computed aggregate that would
 *   otherwise silently reflect outdated review/alignment state
 *
 * We intentionally do not mutate executionIntelligence here.
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

  // No effective requirement change -> preserve downstream artifacts as-is.
  if (
    previousRequirementVersion != null &&
    nextRequirementVersion != null &&
    previousRequirementVersion === nextRequirementVersion
  ) {
    return args.nextArtifact;
  }

  const previousSuite = args.previousArtifact?.testSuite ?? null;
  const nextSuite = args.nextArtifact.testSuite ?? null;
  const currentRequirementVersion = nextRequirementVersion ?? 1;

  let preservedSuite: TestSuiteArtifact | undefined = nextSuite ?? undefined;

  if (previousSuite) {
    const previousSuiteRequirementVersion =
      getTestSuiteRequirementVersion(previousSuite);

    // M12.18:
    // Do not rewrite suite lineage here.
    // Preserving the previous suite metadata ensures it remains visibly stale
    // when the requirement version advances.
    preservedSuite = {
      ...previousSuite,
      ...(typeof previousSuiteRequirementVersion === "number"
        ? { basedOnRequirementVersion: previousSuiteRequirementVersion }
        : {}),
    };
  } else if (nextSuite) {
    // Defensive fallback: if a suite somehow exists only on the merged artifact,
    // keep it and make its current lineage explicit.
    preservedSuite = {
      ...nextSuite,
      basedOnRequirementVersion:
        nextSuite.basedOnRequirementVersion ?? currentRequirementVersion,
    };
  }

  return {
    ...args.nextArtifact,
    ...(preservedSuite ? { testSuite: preservedSuite } : {}),

    // M12.18 integrity rule:
    // A changed requirement invalidates the old review baseline.
    reviewResult: undefined,

    // M12.18 integrity rule:
    // Release health is derived from artifact state and must be recomputed later.
    releaseHealth: undefined,

    ...(args.nextArtifact.featureWorkspace
      ? {
          featureWorkspace: {
            ...args.nextArtifact.featureWorkspace,
            ...(preservedSuite ? { testSuite: preservedSuite } : {}),

            // Keep workspace requirement synchronized to the merged top-level artifact.
            refinedRequirement: args.nextArtifact.refinedRequirement,

            // Clear stale derived workspace artifacts for the same reason as top-level.
            reviewResult: undefined,
            releaseHealth: undefined,
          },
        }
      : {}),
  };
}

export async function runCoachFlow(args: {
  rawReply: string;
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  message: string;
  guidedAnswer: boolean;
  weakInput: boolean;
  explicitRegenerationRequest: boolean;
}): Promise<{
  coachParsed: CoachResult | null;
  replyTextForUser: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
}> {
  const [coachParsedRaw, normalizedRequirement] = await Promise.all([
    parseCoachResponse(args.rawReply),
    parseRefinedRequirementResponse(args.rawReply),
  ]);

  const coachParsed = coachParsedRaw
    ? {
        ...coachParsedRaw,
        optionalClarifications:
          coachParsedRaw.optionalClarifications?.slice(0, 3) ?? [],
      }
    : null;

  let sessionArtifact = args.sessionArtifact;
  let artifactUpdatedAtIso = args.artifactUpdatedAtIso;

  if (!coachParsed && !normalizedRequirement) {
    return {
      coachParsed: null,
      replyTextForUser:
        "I couldn't format the coach output this time. Please retry.",
      sessionArtifact,
      artifactUpdatedAtIso,
    };
  }

  if (!args.explicitRegenerationRequest) {
    const normalizedRequirementPatch =
      normalizedRequirementToArtifactPatch(normalizedRequirement);

    if (normalizedRequirementPatch) {
      const mergedArtifact = mergeArtifact(
        sessionArtifact,
        normalizedRequirementPatch
      );

      // M12.18:
      // Merge updates the requirement artifact itself.
      // This follow-up step enforces downstream integrity rules after the
      // requirement version has been recalculated.
      const nextArtifact = applyRequirementRefinementEffects({
        previousArtifact: sessionArtifact,
        nextArtifact: mergedArtifact,
      });

      const saved = await saveSessionArtifact({
        sessionId: args.sessionId,
        artifact: nextArtifact,
      });

      sessionArtifact = saved.artifact;
      artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
    } else if (coachParsed) {
      const continuityPatch = buildCoachContinuityArtifactPatch({
        existingArtifact: sessionArtifact,
        coach: coachParsed,
        latestUserMessage: args.message,
        guidedAnswer: args.guidedAnswer,
        weakInput: args.weakInput,
      });

      if (continuityPatch) {
        const mergedArtifact = mergeArtifact(sessionArtifact, continuityPatch);

        // M12.18:
        // Legacy continuity patches can still materially change the requirement.
        // Apply the same downstream invalidation rules here.
        const nextArtifact = applyRequirementRefinementEffects({
          previousArtifact: sessionArtifact,
          nextArtifact: mergedArtifact,
        });

        const saved = await saveSessionArtifact({
          sessionId: args.sessionId,
          artifact: nextArtifact,
        });

        sessionArtifact = saved.artifact;
        artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
      }
    }
  }

  const effectiveArtifactForReply = args.explicitRegenerationRequest
    ? null
    : sessionArtifact;

  const replyTextForUser =
    shouldReturnTechnicalRequirement({
      guidedAnswer: args.guidedAnswer,
      artifact: effectiveArtifactForReply,
    }) && coachParsed
      ? coachToTechnicalRequirementText(coachParsed, effectiveArtifactForReply)
      : "I couldn't build a refined requirement from that input. Please retry.";

  return {
    coachParsed,
    replyTextForUser,
    sessionArtifact,
    artifactUpdatedAtIso,
  };
}