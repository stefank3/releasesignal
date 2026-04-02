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

import type { RefinedRequirement, SessionArtifact } from "@/lib/chat/artifact";
import { mergeArtifact } from "@/lib/chat/artifact";
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

  const testStrategyHooks = Array.from(
    new Set(
      [
        ...requirement.testStrategyHooks.riskAreas.map(
          (item) => `Risk area: ${item}`
        ),
        ...requirement.testStrategyHooks.coverageTargets.map(
          (item) => `Coverage target: ${item}`
        ),
      ]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  return {
    objective: requirement.objective,
    functionalScope: requirement.functionalScope,
    businessRules: requirement.businessRules,
    acceptanceCriteria: requirement.acceptanceCriteria,
    edgeCases: requirement.edgeCasesNegativePaths,
    nonFunctionalConstraints: requirement.nonFunctionalConstraints,
    testStrategyHooks,
    riskAreas: requirement.testStrategyHooks.riskAreas,
    coverageTargets: requirement.testStrategyHooks.coverageTargets,
    minimalReproScenarios: requirement.minimalReproScenarios,
    openQuestions: requirement.openQuestionsClarifications,
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
      // M12.12:
      // Persist the normalized requirement using the existing artifact contract.
      const nextArtifact = mergeArtifact(
        sessionArtifact,
        normalizedRequirementPatch
      );

      const saved = await saveSessionArtifact({
        sessionId: args.sessionId,
        artifact: nextArtifact,
      });

      sessionArtifact = saved.artifact;
      artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
    } else if (coachParsed) {
      // Legacy fallback:
      // Keep existing strategy flow behavior when only coach-shaped output exists.
      const continuityPatch = buildCoachContinuityArtifactPatch({
        existingArtifact: sessionArtifact,
        coach: coachParsed,
        latestUserMessage: args.message,
        guidedAnswer: args.guidedAnswer,
        weakInput: args.weakInput,
      });

      if (continuityPatch) {
        const nextArtifact = mergeArtifact(sessionArtifact, continuityPatch);

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