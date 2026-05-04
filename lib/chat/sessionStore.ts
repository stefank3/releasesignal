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
//
// M12.13 FIX:
// - honor caller-provided sessionId for manual/external workflow action testing
// - if a provided sessionId does not exist for this user, create that exact id
// - do not silently replace caller sessionId with a generated DB id
//
// M16 CHANGE:
// - add centralized deterministic artifact persistence helper for non-chat endpoints
// - keep execution evidence persistence out of /api/chat and UI layers
// - enforce ownership through auth0Sub + sessionId before writing artifactJson

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import type { ClientMode, ChatBody, RateMeta } from "./chatTypes";
import { normalizePersistedMode } from "./chatTypes";
import { sessionModeMismatchResponse } from "./http";
import type { SessionArtifact } from "./artifact";
import { prismaJsonValue } from "./artifact";

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
      sessionLifecycle: SessionLifecycle;
    }
  | {
      ok: false;
      response: ReturnType<typeof sessionModeMismatchResponse>;
    }
> {
  const { auth0Sub, requestId, body, clientMode } = args;

  const requestedSessionId =
    typeof body?.sessionId === "string" ? body.sessionId.trim() : "";

  let sessionId = requestedSessionId || undefined;
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

    if (existing) {
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
    } else {
      // M12.13 FIX:
      // Caller explicitly provided a session id that does not yet exist.
      // Create that exact session id instead of silently replacing it.
      const rawClientId =
        typeof body?.sessionClientId === "string"
          ? body.sessionClientId.trim()
          : "";

      const clientSessionId = rawClientId.length > 0 ? rawClientId : sessionId;

      const created = await prisma.chatSession.create({
        data: {
          id: sessionId,
          auth0Sub,
          mode: clientMode,
          title: body?.title ?? null,
          clientSessionId,
          artifactJson: Prisma.DbNull,
          artifactUpdatedAt: null,
        },
        select: { id: true, artifactJson: true, artifactUpdatedAt: true },
      });

      sessionId = created.id;
      sessionArtifact = readArtifact(created.artifactJson);
      artifactUpdatedAtIso = created.artifactUpdatedAt
        ? created.artifactUpdatedAt.toISOString()
        : null;

      sessionLifecycle = "session_started";
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

// M16:
// Centralized artifact persistence helper for deterministic non-chat endpoints.
// Used by execution evidence import so API route logic does not own Prisma JSON
// write details and does not bypass session ownership checks.
//
// Returns false when the session does not exist or does not belong to the user.
export async function persistArtifact(args: {
  auth0Sub: string;
  sessionId: string;
  artifact: SessionArtifact;
}): Promise<boolean> {
  const updated = await prisma.chatSession.updateMany({
    where: {
      id: args.sessionId,
      auth0Sub: args.auth0Sub,
    },
    data: {
      artifactJson: prismaJsonValue(args.artifact),
      artifactUpdatedAt: new Date(),
    },
  });

  return updated.count === 1;
}