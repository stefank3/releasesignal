// lib/chat/sessionStore.ts
// Session load/create boundary for chat execution.
//
// M11 NOTE:
// This is the correct place to classify session lifecycle outcome:
// - existing session reused
// - new session created
//
// We do NOT emit telemetry directly from this file yet.
// Instead, this file returns structured lifecycle information so the route
// can emit telemetry with full request/user/org context.
//
// M12 Step 7A CHANGE:
// - remove legacy mode-locked session behavior
// - allow the same workspace session to be reused across coach / cases / review
// - treat persisted mode as last active mode, not as a hard session lock

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import type { ClientMode, ChatBody, RateMeta } from "./chatTypes";
import { normalizePersistedMode } from "./chatTypes";
import { sessionModeMismatchResponse } from "./http";
import type { SessionArtifact } from "./artifact";

// M11:
// Structured lifecycle classification returned to the caller.
// Route.ts can translate this into persisted telemetry events.
export type SessionLifecycle =
  | "session_started"
  | "session_reopened";

// CHANGE (M7.7): small helper to keep artifact hydration consistent + explicit.
// Prisma will return `null` when JSON is DbNull, but we normalize here for clarity.
function readArtifact(v: unknown): SessionArtifact | null {
  if (!v) return null;
  if (typeof v !== "object") return null;
  return v as SessionArtifact;
}

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

      // M11:
      // Indicates whether the session was newly created or an existing
      // session was reopened/reused.
      sessionLifecycle: SessionLifecycle;
    }
  | {
      ok: false;
      response: ReturnType<typeof sessionModeMismatchResponse>;
    }
> {
  const { auth0Sub, requestId, body, clientMode } = args;

  let sessionId = body?.sessionId;
  let sessionArtifact: SessionArtifact | null = null;
  let artifactUpdatedAtIso: string | null = null;

  // M11:
  // Default to "session_started" and override to "session_reopened"
  // when we successfully load an existing session.
  let sessionLifecycle: SessionLifecycle = "session_started";

  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, auth0Sub },
      select: { id: true, mode: true, artifactJson: true, artifactUpdatedAt: true },
    });

    if (!existing) {
      // If the provided session id does not exist for this user,
      // fall through into the create/upsert path below.
      sessionId = undefined;
    } else {
      // M12 Step 7A:
      // Persisted mode is now treated as the last active mode for this
      // workspace session, not as a hard lock.
      const persistedMode = existing.mode
        ? normalizePersistedMode(existing.mode)
        : null;

      if (persistedMode !== clientMode) {
        await prisma.chatSession.update({
          where: { id: existing.id },
          data: { mode: clientMode },
        });
      }

      sessionArtifact = readArtifact(existing.artifactJson);
      artifactUpdatedAtIso = existing.artifactUpdatedAt
        ? existing.artifactUpdatedAt.toISOString()
        : null;

      // M11:
      // Existing session was found and accepted.
      sessionLifecycle = "session_reopened";
    }
  }

  if (!sessionId) {
    const rawClientId =
      typeof body?.sessionClientId === "string"
        ? body.sessionClientId.trim()
        : "";

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
      update: {
        // M12 Step 7A:
        // If the same logical workspace session is reopened in another mode,
        // keep the session and update the last active mode.
        mode: clientMode,
      },
      select: { id: true, mode: true, artifactJson: true, artifactUpdatedAt: true },
    });

    sessionId = sessionRow.id;
    sessionArtifact = readArtifact(sessionRow.artifactJson);
    artifactUpdatedAtIso = sessionRow.artifactUpdatedAt
      ? sessionRow.artifactUpdatedAt.toISOString()
      : null;

    // M11:
    // This path is treated as a new session start.
    sessionLifecycle = "session_started";
  }

  return {
    ok: true,
    sessionId,
    sessionArtifact,
    artifactUpdatedAtIso,
    sessionLifecycle,
  };
}

export async function refreshArtifact(args: {
  auth0Sub: string;
  sessionId: string;
  fallback: SessionArtifact | null;
}) {
  const sess = await prisma.chatSession.findFirst({
    where: { id: args.sessionId, auth0Sub: args.auth0Sub },
    select: { artifactJson: true, artifactUpdatedAt: true },
  });

  const artifact = readArtifact(sess?.artifactJson) ?? args.fallback ?? null;
  const artifactUpdatedAtIso = sess?.artifactUpdatedAt
    ? sess.artifactUpdatedAt.toISOString()
    : null;

  return { artifact, artifactUpdatedAtIso };
}