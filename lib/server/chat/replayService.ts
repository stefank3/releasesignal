// lib/server/chat/replayService.ts
// M10 extraction:
// Centralize replay lookup + replay response shaping so route.ts
// stays focused on request orchestration.
//
// M13 BUG FIX:
// - prefer authoritative review artifact over stored assistant review text
// - never replay raw stored review assistant content back to the client
// - tolerate legacy polluted review assistant messages that contain JSON plus decoration
// - fail closed for review replay: return no replay hit instead of exposing raw JSON

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { responseHeaders } from "@/lib/chat/http";
import { extractJsonObject } from "@/lib/chat/json";
import { refreshArtifact } from "@/lib/chat/sessionStore";
import { isReviewResult, type ReviewResult } from "@/lib/framework/reviewSchema";
import type { ChatMetricMode } from "@/lib/metrics/chatMetrics";
import type { RateMeta } from "@/lib/chat/chatTypes";
import type { SessionArtifact } from "@/lib/chat/artifact";

type ReplayArgs = {
  auth0Sub: string;
  sessionId: string;
  requestId: string;
  clientMode: ChatMetricMode;
  executionMode: "coach" | "review";
  rateMeta: RateMeta | null;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
};

type ReplayResult =
  | {
      hit: false;
      sessionArtifact: SessionArtifact | null;
      artifactUpdatedAtIso: string | null;
    }
  | {
      hit: true;
      response: NextResponse;
      sessionArtifact: SessionArtifact | null;
      artifactUpdatedAtIso: string | null;
    };

function buildReplayResponse(args: {
  requestId: string;
  rateMeta: RateMeta | null;
  body: Record<string, unknown>;
}): NextResponse {
  return NextResponse.json(args.body, {
    status: 200,
    headers: responseHeaders(args.requestId, args.rateMeta ?? undefined),
  });
}

function tryParseStoredReview(raw: string): ReviewResult | null {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as unknown;
    return isReviewResult(parsed) ? (parsed as ReviewResult) : null;
  } catch {
    return null;
  }
}

export async function tryReplayExistingAssistant(
  args: ReplayArgs
): Promise<ReplayResult> {
  const existingAssistant = await prisma.chatMessage.findFirst({
    where: {
      sessionId: args.sessionId,
      requestId: args.requestId,
      role: "assistant",
      auth0Sub: args.auth0Sub,
    },
    select: {
      content: true,
      tokensIn: true,
      tokensOut: true,
    },
  });

  if (!existingAssistant) {
    return {
      hit: false,
      sessionArtifact: args.sessionArtifact,
      artifactUpdatedAtIso: args.artifactUpdatedAtIso,
    };
  }

  const refreshed = await refreshArtifact({
    auth0Sub: args.auth0Sub,
    sessionId: args.sessionId,
    fallback: args.sessionArtifact,
  });

  const sessionArtifact = refreshed.artifact ?? args.sessionArtifact ?? null;
  const artifactUpdatedAtIso =
    refreshed.artifactUpdatedAtIso ?? args.artifactUpdatedAtIso ?? null;

  const usage = {
    promptTokens: existingAssistant.tokensIn ?? 0,
    completionTokens: existingAssistant.tokensOut ?? 0,
    totalTokens:
      (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
  };

  if (args.executionMode === "review") {
    const raw = existingAssistant.content ?? "";

    // M13 bug fix:
    // authoritative replay source for review is the persisted artifact first,
    // not potentially polluted assistant message content.
    const artifactReview = sessionArtifact?.reviewResult ?? null;
    if (artifactReview && isReviewResult(artifactReview)) {
      return {
        hit: true,
        response: buildReplayResponse({
          requestId: args.requestId,
          rateMeta: args.rateMeta,
          body: {
            ok: true,
            mode: args.clientMode,
            review: artifactReview,
            sessionId: args.sessionId,
            usage,
            rate: args.rateMeta,
            replay: true,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          },
        }),
        sessionArtifact,
        artifactUpdatedAtIso,
      };
    }

    // Backward compatibility:
    // tolerate legacy stored review assistant content only if a clean review
    // object can still be extracted from it.
    const storedReview = tryParseStoredReview(raw);
    if (storedReview) {
      return {
        hit: true,
        response: buildReplayResponse({
          requestId: args.requestId,
          rateMeta: args.rateMeta,
          body: {
            ok: true,
            mode: args.clientMode,
            review: storedReview,
            sessionId: args.sessionId,
            usage,
            rate: args.rateMeta,
            replay: true,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          },
        }),
        sessionArtifact,
        artifactUpdatedAtIso,
      };
    }

    // Fail closed:
    // do not surface raw stored review text/json back to the client.
    return {
      hit: false,
      sessionArtifact,
      artifactUpdatedAtIso,
    };
  }

  return {
    hit: true,
    response: buildReplayResponse({
      requestId: args.requestId,
      rateMeta: args.rateMeta,
      body: {
        ok: true,
        mode: args.clientMode,
        reply: existingAssistant.content,
        sessionId: args.sessionId,
        usage,
        rate: args.rateMeta,
        replay: true,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      },
    }),
    sessionArtifact,
    artifactUpdatedAtIso,
  };
}