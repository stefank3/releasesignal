// lib/server/chat/coachFlowService.ts
// M10 Pass 8
// Extract coach-mode orchestration from route.ts so the API route
// acts as a controller instead of owning workflow logic.

import type { SessionArtifact } from "@/lib/chat/artifact";
import { mergeArtifact } from "@/lib/chat/artifact";
import type { CoachResult } from "@/lib/framework/reviewSchema";

import {
  buildCoachContinuityArtifactPatch,
  coachToTechnicalRequirementText,
  shouldReturnTechnicalRequirement,
} from "@/lib/server/chat/coachFormatting";

import { parseCoachResponse } from "@/lib/server/chat/modelResponseParser";
import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";

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
  const coachParsed = await parseCoachResponse(args.rawReply);
  let sessionArtifact = args.sessionArtifact;
  let artifactUpdatedAtIso = args.artifactUpdatedAtIso;

  if (!coachParsed) {
    return {
      coachParsed: null,
      replyTextForUser:
        "I couldn't format the coach output this time. Please retry.",
      sessionArtifact,
      artifactUpdatedAtIso,
    };
  }

  coachParsed.optionalClarifications =
    coachParsed.optionalClarifications?.slice(0, 3) ?? [];

  if (!args.explicitRegenerationRequest) {
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

  const effectiveArtifactForReply = args.explicitRegenerationRequest
    ? null
    : sessionArtifact;

const replyTextForUser = shouldReturnTechnicalRequirement({
  guidedAnswer: args.guidedAnswer,
  artifact: effectiveArtifactForReply,
})
  ? coachToTechnicalRequirementText(
      coachParsed,
      effectiveArtifactForReply
    )
  : "I couldn't build a refined requirement from that input. Please retry.";

  return {
    coachParsed,
    replyTextForUser,
    sessionArtifact,
    artifactUpdatedAtIso,
  };
}