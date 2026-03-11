// lib/server/chat/replayService.ts
// M10 extraction:
// Centralize replay lookup + replay response shaping so route.ts
// stays focused on request orchestration.

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

export async function tryReplayExistingAssistant(args: ReplayArgs): Promise<ReplayResult> {
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
    totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
  };

  if (args.executionMode === "review") {
    const raw = existingAssistant.content ?? "";

    try {
      const parsed = JSON.parse(extractJsonObject(raw)) as unknown;
      if (isReviewResult(parsed)) {
        return {
          hit: true,
          response: NextResponse.json(
            {
              ok: true,
              mode: args.clientMode,
              review: parsed as ReviewResult,
              sessionId: args.sessionId,
              usage,
              rate: args.rateMeta,
              replay: true,
              artifact: sessionArtifact,
              artifactUpdatedAt: artifactUpdatedAtIso,
            },
            {
              status: 200,
              headers: responseHeaders(args.requestId, args.rateMeta ?? undefined),
            }
          ),
          sessionArtifact,
          artifactUpdatedAtIso,
        };
      }
    } catch {
      // fall through to raw replay response
    }

    return {
      hit: true,
      response: NextResponse.json(
        {
          ok: true,
          mode: args.clientMode,
          raw,
          sessionId: args.sessionId,
          usage,
          rate: args.rateMeta,
          replay: true,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        },
        {
          status: 200,
          headers: responseHeaders(args.requestId, args.rateMeta ?? undefined),
        }
      ),
      sessionArtifact,
      artifactUpdatedAtIso,
    };
  }

  return {
    hit: true,
    response: NextResponse.json(
      {
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
      {
        status: 200,
        headers: responseHeaders(args.requestId, args.rateMeta ?? undefined),
      }
    ),
    sessionArtifact,
    artifactUpdatedAtIso,
  };
}