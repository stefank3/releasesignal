// lib/server/chat/reviewFlowService.ts
// M10 Pass 10
// Extract review-mode orchestration from route.ts so review parsing and
// response shaping do not remain inline inside the API controller.
//
// SURGICAL CHANGE:
// - centralize review parsing
// - centralize persisted assistant content selection for review mode
// - centralize success / parse-failure response shaping

import type { ClientMode, RateMeta } from "@/lib/chat/chatTypes";
import type { SessionArtifact } from "@/lib/chat/artifact";
import type { ReviewResult } from "@/lib/framework/reviewSchema";

import { parseReviewResponse } from "@/lib/server/chat/modelResponseParser";
import {
  buildReviewParseFailureResponse,
  buildReviewSuccessResponse,
} from "@/lib/server/chat/responseBuilder";

type UsagePayload = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export async function runReviewFlow(args: {
  rawReply: string;
}): Promise<{
  reviewObj: ReviewResult | null;
  reviewStoredJson: string | null;
  reviewRepaired: boolean;
  assistantContentToStore: string;
}> {
  const parsedReview = await parseReviewResponse(args.rawReply);

  return {
    reviewObj: parsedReview.reviewObj,
    reviewStoredJson: parsedReview.reviewStoredJson,
    reviewRepaired: parsedReview.repaired,
    assistantContentToStore: parsedReview.reviewStoredJson ?? args.rawReply,
  };
}

export function buildReviewFlowResponse(args: {
  requestId: string;
  clientMode: ClientMode;
  rawReply: string;
  sessionId: string;
  creditsCharged: number;
  creditsRemaining: number | null;
  usage: UsagePayload;
  rateMeta: RateMeta | null;
  reviewObj: ReviewResult | null;
  reviewRepaired: boolean;
  artifact: SessionArtifact | null;
  artifactUpdatedAt: string | null;
}) {
  if (!args.reviewObj) {
    return buildReviewParseFailureResponse({
      requestId: args.requestId,
      clientMode: args.clientMode,
      rawReply: args.rawReply,
      sessionId: args.sessionId,
      creditsCharged: args.creditsCharged,
      creditsRemaining: args.creditsRemaining,
      usage: args.usage,
      rateMeta: args.rateMeta,
      artifact: args.artifact,
      artifactUpdatedAt: args.artifactUpdatedAt,
    });
  }

  return buildReviewSuccessResponse({
    requestId: args.requestId,
    clientMode: args.clientMode,
    review: args.reviewObj,
    sessionId: args.sessionId,
    creditsCharged: args.creditsCharged,
    creditsRemaining: args.creditsRemaining,
    usage: args.usage,
    rateMeta: args.rateMeta,
    repaired: args.reviewRepaired || undefined,
    artifact: args.artifact,
    artifactUpdatedAt: args.artifactUpdatedAt,
  });
}