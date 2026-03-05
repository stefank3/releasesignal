// lib/chat/sessionStore.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClientMode, ChatBody, RateMeta } from "./chatTypes";
import { normalizePersistedMode } from "./chatTypes";
import { sessionModeMismatchResponse } from "./http";
import type { SessionArtifact } from "./artifact";

export async function loadOrCreateSession(args: {
  auth0Sub: string;
  requestId: string;
  body: ChatBody;
  clientMode: ClientMode;
  rateMeta: RateMeta | null;
}): Promise<
  | {
      ok: true;
      sessionId: string;
      sessionArtifact: SessionArtifact | null;
      artifactUpdatedAtIso: string | null;
    }
  | {
      ok: false;
      response: ReturnType<typeof sessionModeMismatchResponse>;
    }
> {
  const { auth0Sub, requestId, body, clientMode, rateMeta } = args;

  let sessionId = body?.sessionId;
  let sessionArtifact: SessionArtifact | null = null;
  let artifactUpdatedAtIso: string | null = null;

  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, auth0Sub },
      select: { id: true, mode: true, artifactJson: true, artifactUpdatedAt: true },
    });

    if (!existing) {
      sessionId = undefined;
    } else if (existing.mode && normalizePersistedMode(existing.mode) !== clientMode) {
      return {
        ok: false,
        response: sessionModeMismatchResponse({
          requestId,
          rateMeta,
          sessionMode: existing.mode,
          requestedMode: clientMode,
        }),
      };
    } else {
      sessionArtifact = (existing.artifactJson as SessionArtifact | null) ?? null;
      artifactUpdatedAtIso = existing.artifactUpdatedAt ? existing.artifactUpdatedAt.toISOString() : null;
    }
  }

  if (!sessionId) {
    const rawClientId = typeof body?.sessionClientId === "string" ? body.sessionClientId.trim() : "";
    const clientSessionId = rawClientId.length > 0 ? rawClientId : requestId;

    const sessionRow = await prisma.chatSession.upsert({
      where: { auth0Sub_clientSessionId: { auth0Sub, clientSessionId } },
      create: {
        auth0Sub,
        mode: clientMode,
        title: body?.title ?? null,
        clientSessionId,
        artifactJson: Prisma.DbNull,
        artifactUpdatedAt: null,
      },
      update: {},
      select: { id: true, mode: true, artifactJson: true, artifactUpdatedAt: true },
    });

    if (sessionRow.mode && normalizePersistedMode(sessionRow.mode) !== clientMode) {
      return {
        ok: false,
        response: sessionModeMismatchResponse({
          requestId,
          rateMeta,
          sessionMode: sessionRow.mode,
          requestedMode: clientMode,
        }),
      };
    }

    sessionId = sessionRow.id;
    sessionArtifact = (sessionRow.artifactJson as SessionArtifact | null) ?? null;
    artifactUpdatedAtIso = sessionRow.artifactUpdatedAt ? sessionRow.artifactUpdatedAt.toISOString() : null;
  }

  return { ok: true, sessionId, sessionArtifact, artifactUpdatedAtIso };
}

export async function refreshArtifact(args: { auth0Sub: string; sessionId: string; fallback: SessionArtifact | null }) {
  const sess = await prisma.chatSession.findFirst({
    where: { id: args.sessionId, auth0Sub: args.auth0Sub },
    select: { artifactJson: true, artifactUpdatedAt: true },
  });

  const artifact = (sess?.artifactJson as SessionArtifact | null) ?? args.fallback ?? null;
  const artifactUpdatedAtIso = sess?.artifactUpdatedAt ? sess.artifactUpdatedAt.toISOString() : null;

  return { artifact, artifactUpdatedAtIso };
}