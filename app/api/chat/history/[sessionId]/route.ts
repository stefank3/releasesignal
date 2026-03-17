// app/api/chat/history/[sessionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Mode = "coach" | "review" | "cases";

type Ctx =
  | { params: { sessionId: string } }
  | { params: Promise<{ sessionId: string }> };

/**
 * WHY:
 * Next.js may pass route params either as a plain object
 * or as a Promise depending on runtime / build output.
 * We normalize it here to avoid `any` casts and keep lint clean.
 */
async function resolveParams(ctx: Ctx): Promise<{ sessionId: string } | undefined> {
  const rawParams = ctx.params instanceof Promise ? await ctx.params : ctx.params;
  return rawParams;
}

function normalizeMode(m: unknown): Mode {
  // WHY (M6.1): older rows or unexpected values should not break the history UI.
  return m === "review" || m === "cases" ? m : "coach";
}

// CHANGE (M7.7 / M9): surface full session artifact for pinned requirement + persistent test suite hydration.
function readArtifact(v: unknown): Record<string, unknown> | null {
  if (!v) return null;
  if (typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

/**
 * Heuristic: detect cases plain-text output in stored assistant content.
 *
 * WHY (M6.1):
 * - Some older sessions may have persisted mode as coach but contain cases output.
 * - We do NOT rely on schema migrations to make history render correctly.
 * - If assistant output looks like strict cases plain-text, we render session as cases.
 *
 * Conservative signal:
 * - requires "TC-###" lines + at least one structure marker, OR multiple TC lines.
 */
function looksLikeCasesPlainText(text: string): boolean {
  const t = String(text ?? "").replace(/\r/g, "");

  const tcCount = (t.match(/^TC-\d{1,4}\b.*$/gim) || []).length;

  const hasMarkers =
    /(^|\n)\s*Preconditions\s*:/i.test(t) ||
    /(^|\n)\s*Test Steps\s*:/i.test(t) ||
    /(^|\n)\s*Steps\s*:/i.test(t) ||
    /(^|\n)\s*Expected Result(s)?\s*:/i.test(t) ||
    /(^|\n)\s*Priority\s*:/i.test(t) ||
    /(^|\n)\s*Type\s*:/i.test(t);

  if (tcCount >= 1 && hasMarkers) return true;
  if (tcCount >= 2) return true;

  return false;
}

/**
 * Compute the UI-effective mode for a session.
 *
 * WHY (M6.1):
 * - Must match /api/chat/history list logic for consistency.
 * - review sessions remain review (admin-only + JSON contract).
 * - cases is inferred from the latest assistant content (cheap + stable).
 */
function computeEffectiveMode(args: {
  persistedMode: Mode;
  lastMessage: null | { role: string; content: string };
}): Mode {
  // ✅ FIX: persisted "review" and persisted "cases" must remain stable.
  // Otherwise, a short/non-structured last assistant message can flip the UI mode.
  if (args.persistedMode === "review") return "review";
  if (args.persistedMode === "cases") return "cases";

  const last = args.lastMessage;
  if (last?.role === "assistant" && looksLikeCasesPlainText(last.content)) return "cases";

  return "coach";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const authSession = await auth0.getSession();
  const sub = authSession?.user?.sub;

  // SECURITY:
  // Never allow unauthenticated access to chat history.
  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await resolveParams(ctx);
  const sessionId = params?.sessionId;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  /**
   * SECURITY:
   * Prevent leaking session existence across users.
   * We verify ownership before querying messages.
   */
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, auth0Sub: sub },

    // CHANGE (M7.7): include artifactJson so UI can render pinned Refined Requirement.
    select: { id: true, mode: true, artifactJson: true, artifactUpdatedAt: true },
  });

  if (!session) {
    // Deliberately vague response to avoid ID probing
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);

  /**
   * WHY:
   * Limit is bounded to prevent abuse or accidental huge reads.
   * Default = 120, hard cap = 200.
   */
  const limitRaw = Number(url.searchParams.get("limit") ?? 120);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 120;

  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.chatMessage.findMany({
    where: { sessionId, auth0Sub: sub },

    /**
     * CURSOR:
     * Deterministic ordering is REQUIRED for correct pagination.
     * We add `id` as tie-breaker for messages created in same millisecond.
     */
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],

    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),

    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  /**
   * ✅ M6.1: Persisted mode is canonical (for mode-locking).
   */
  const persistedMode = normalizeMode(session.mode);

  /**
   * ✅ M6.1: effectiveMode inference must NOT depend on the current page.
   * If the newest assistant message is short/non-structured, page-based inference can flip modes.
   *
   * We infer from the latest message in the session (single query), matching list route logic.
   */
  const lastMessage = await prisma.chatMessage.findFirst({
    where: { sessionId, auth0Sub: sub },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { role: true, content: true },
  });

  const effectiveMode = computeEffectiveMode({
    persistedMode,
    lastMessage: lastMessage ? { role: lastMessage.role, content: lastMessage.content ?? "" } : null,
  });

  /**
   * UX:
   * Client renders messages oldest → newest.
   * We query DESC for pagination efficiency,
   * then reverse for display.
   */
  const items = page
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      // WHY: explicit ISO string avoids timezone inconsistencies in client
      createdAt: m.createdAt.toISOString(),
    }));

  return NextResponse.json({
    // ✅ M6.1: persisted session mode for deterministic client locking (canonical)
    sessionMode: persistedMode,

    // ✅ M6.1: inferred mode for correct rendering of older mis-labeled sessions
    effectiveMode,

    // CHANGE (M7.7): surface artifact for the pinned requirement card.
    // NOTE: return it as `artifact` (not artifactJson) to keep API stable even if DB field changes later.
    artifact: readArtifact(session.artifactJson),
    artifactUpdatedAt: session.artifactUpdatedAt ? session.artifactUpdatedAt.toISOString() : null,

    items,

    /**
     * CURSOR CONTRACT:
     * nextCursor references the LAST item of the DESC page
     * (not the reversed list).
     *
     * Client sends it back to fetch the next "older" page.
     */
    nextCursor: hasMore ? page[page.length - 1].id : null,

    hasMore,
  });
}

/**
 * DELETE /api/chat/history/:sessionId
 * SECURITY:
 * - Requires Auth0 session
 * - Only deletes sessions owned by the current user
 * - Does not leak whether session exists for other users
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const authSession = await auth0.getSession();
  const sub = authSession?.user?.sub;

  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await resolveParams(ctx);
  const sessionId = params?.sessionId;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Delete messages first (works even if you don't have ON DELETE CASCADE)
  const result = await prisma.$transaction(async (tx) => {
    // Ownership check (no leaks)
    const owned = await tx.chatSession.findFirst({
      where: { id: sessionId, auth0Sub: sub },
      select: { id: true },
    });

    if (!owned) return { deleted: false as const };

    await tx.chatMessage.deleteMany({ where: { sessionId, auth0Sub: sub } });
    await tx.chatSession.delete({ where: { id: sessionId } });

    return { deleted: true as const };
  });

  if (!result.deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * PATCH /api/chat/history/:sessionId/artifact
 *
 * M12 Step 4B:
 * Persist updated SessionArtifact (e.g. editable test suite)
 *
 * SECURITY:
 * - Requires Auth0 session
 * - Only allows updating own session
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const authSession = await auth0.getSession();
  const sub = authSession?.user?.sub;

  if (!sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await resolveParams(ctx);
  const sessionId = params?.sessionId;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const artifact = (body as any)?.artifact;

  if (!artifact || typeof artifact !== "object") {
    return NextResponse.json(
      { error: "Invalid artifact payload" },
      { status: 400 }
    );
  }

  try {
    // SECURITY: ownership check
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, auth0Sub: sub },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        artifactJson: artifact,
        artifactUpdatedAt: new Date(),
      },
      select: {
        artifactJson: true,
        artifactUpdatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      artifact: readArtifact(updated.artifactJson),
      artifactUpdatedAt: updated.artifactUpdatedAt
        ? updated.artifactUpdatedAt.toISOString()
        : null,
    });
  } catch (err) {
    console.error("Artifact update failed", err);

    return NextResponse.json(
      { error: "Failed to update artifact" },
      { status: 500 }
    );
  }
}