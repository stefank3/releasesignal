// lib/server/chat/reviewFlowService.ts
// M10 Pass 10
// Extract review-mode orchestration from route.ts so review parsing and
// response shaping do not remain inline inside the API controller.
//
// SURGICAL CHANGE:
// - centralize review parsing
// - centralize persisted assistant content selection for review mode
// - centralize success / parse-failure response shaping
//
// M11 CHANGE:
// - classify structured review telemetry outcome
// - return telemetry classification to the caller
// - do NOT emit telemetry directly from this service
//
// M12 Step 7 CHANGE:
// - make review flow artifact-aware
// - capture whether suite / requirement context existed during review
// - prepare design ↔ review consistency without changing scoring behavior yet
//
// M12 Step 7D CHANGE:
// - replace AI review parsing with deterministic artifact-driven review generation
// - review now compares structured requirement + structured suite only
// - keep response shaping stable for callers
//
// BUG FIX (M12.8): prevent null deterministic review results from being
// serialized and stored as the literal string "null"; keep persistence and
// telemetry aligned with actual review result presence.

import type { ClientMode, RateMeta } from "@/lib/chat/chatTypes";
import type { SessionArtifact } from "@/lib/chat/artifact";
import { getTestSuite } from "@/lib/chat/artifact";
import type { ReviewResult } from "@/lib/framework/reviewSchema";
import { buildDeterministicReviewResult } from "@/lib/domain/deterministicReviewService";

import {
  buildReviewParseFailureResponse,
  buildReviewSuccessResponse,
} from "@/lib/server/chat/responseBuilder";

type UsagePayload = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

// M11:
// Structured review telemetry classification returned to the caller.
// Route.ts will add request/session/user/org context and persist it.
export type ReviewFlowTelemetry = {
  eventType: "review_performed" | "review_failed";
  artifactType: "reviewResult";
  metadata: {
    parseSucceeded: boolean;
    repaired: boolean;
    suitePresent: boolean;
    requirementPresent: boolean;
    reviewContext: "artifact_aligned" | "partial_artifact_context" | "raw_only";
  };
};

function classifyReviewContext(args: {
  suitePresent: boolean;
  requirementPresent: boolean;
}): ReviewFlowTelemetry["metadata"]["reviewContext"] {
  if (args.suitePresent && args.requirementPresent) {
    return "artifact_aligned";
  }

  if (args.suitePresent || args.requirementPresent) {
    return "partial_artifact_context";
  }

  return "raw_only";
}

export async function runReviewFlow(args: {
  rawReply: string;
  sessionArtifact?: SessionArtifact | null;
}): Promise<{
  reviewObj: ReviewResult | null;
  reviewStoredJson: string | null;
  reviewRepaired: boolean;
  assistantContentToStore: string;

  // M11:
  // Structured review outcome classification.
  reviewTelemetry: ReviewFlowTelemetry;
}> {
  const suite = getTestSuite(args.sessionArtifact);
  const requirement = args.sessionArtifact?.refinedRequirement ?? null;

  const suitePresent = !!suite;
  const requirementPresent = !!requirement;

  // BUG FIX (M12 Step 7D): review must not depend on parsed AI review text.
  // Build the review deterministically from structured artifacts only.
  const reviewObj = buildDeterministicReviewResult({
    requirement,
    suite,
  });

  // BUG FIX (M12.8): only serialize when a deterministic review object exists.
  // This prevents storing the literal string "null" as structured review content.
  const reviewStoredJson = reviewObj ? JSON.stringify(reviewObj) : null;

  const reviewTelemetry: ReviewFlowTelemetry = {
    eventType: reviewObj ? "review_performed" : "review_failed",
    artifactType: "reviewResult",
    metadata: {
      // M12 Step 7D:
      // Keep telemetry shape stable for callers even though parsing is no longer used.
      parseSucceeded: !!reviewObj,
      repaired: false,
      suitePresent,
      requirementPresent,
      reviewContext: classifyReviewContext({
        suitePresent,
        requirementPresent,
      }),
    },
  };

  return {
    reviewObj,
    reviewStoredJson,
    reviewRepaired: false,

    // BUG FIX (M12.8): never persist "null" as assistant review content.
    // Deterministic review storage must contain valid review JSON or be empty.
    assistantContentToStore: reviewStoredJson ?? "",
    reviewTelemetry,
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