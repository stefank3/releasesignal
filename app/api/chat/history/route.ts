// app/api/chat/history/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

type Mode = "coach" | "review" | "cases";

function sanitizeTitle(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();

  // Prevent JSON blobs from becoming titles
  if (t.startsWith("{") || t.startsWith("[")) return "New chat";

  // Keep titles short and readable
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

function getRequestId(req: Request): string {
  // WHY: allow upstream correlation, else generate locally
  const fromHeader = req.headers.get("x-request-id")?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
}

function normalizeMode(m: unknown): Mode {
  // WHY (M6.1): older rows or unexpected values should not break the history UI.
  return m === "review" || m === "cases" ? m : "coach";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * M9 CHANGE:
 * Read lightweight artifact metadata for sidebar/history badges.
 * This stays defensive because older rows may not have artifactJson at all.
 */
function readArtifactMeta(artifactJson: unknown): {
  hasPinnedRequirement: boolean;
  hasPersistentTestSuite: boolean;
  testSuiteVersion: number | null;
  testSuiteCount: number | null;
} {
  if (!isRecord(artifactJson)) {
    return {
      hasPinnedRequirement: false,
      hasPersistentTestSuite: false,
      testSuiteVersion: null,
      testSuiteCount: null,
    };
  }

  const refinedRequirement = isRecord(artifactJson.refinedRequirement)
    ? artifactJson.refinedRequirement
    : null;

  const hasPinnedRequirement = refinedRequirement
    ? Object.values(refinedRequirement).some((value) => {
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) {
          return value.some((item) => String(item ?? "").trim().length > 0);
        }
        return false;
      })
    : false;

  const rawTestSuite = isRecord(artifactJson.testSuite) ? artifactJson.testSuite : null;
  const rawCases = rawTestSuite?.cases;
  const cases = Array.isArray(rawCases) ? rawCases : null;

  const testSuiteCount = cases ? cases.length : null;
  const testSuiteVersion =
    typeof rawTestSuite?.version === "number" ? rawTestSuite.version : null;

  const hasPersistentTestSuite = !!cases && cases.length > 0;

  return {
    hasPinnedRequirement,
    hasPersistentTestSuite,
    testSuiteVersion,
    testSuiteCount,
  };
}

/**
 * Heuristic: detect cases plain-text output in stored assistant content.
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
 * - "review" sessions must always badge as review (admin-only, JSON contract).
 * - "cases" can be inferred from assistant content to handle older mis-labeled sessions.
 *
 * Backward compatibility:
 * - If persisted mode is already "cases", honor it.
 */
function computeEffectiveMode(args: {
  persistedMode: Mode;
  lastAssistantMessage: null | { role: string; content: string };
}): Mode {
  if (args.persistedMode === "review") return "review";
  if (args.persistedMode === "cases") return "cases"; // backward-compat

  const lastA = args.lastAssistantMessage;
  if (lastA?.role === "assistant" && looksLikeCasesPlainText(lastA.content)) return "cases";

  return "coach";
}

// GET /api/chat/history?cursor=...&limit=20
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const t0 = Date.now();

  try {
    const authSession = await auth0.getSession();
    const sub = authSession?.user?.sub;

    if (!sub) {
      log("warn", {
        event: "unauthorized",
        requestId,
        auth0Sub: undefined,
        errorType: "unauthorized",
        errorMessage: "Missing Auth0 session",
        durationMs: Date.now() - t0,
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    log("info", {
      event: "chat_start",
      requestId,
      auth0Sub: sub,
      meta: { route: "/api/chat/history" },
    });

    const url = new URL(req.url);

    const limitRaw = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const cursor = url.searchParams.get("cursor");

    const sessions = await prisma.chatSession.findMany({
      where: { auth0Sub: sub },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        mode: true,
        createdAt: true,
        updatedAt: true,
        // M7.7 / M9 CHANGE: sidebar/history badge metadata source
        artifactJson: true,
        artifactUpdatedAt: true,
      },
    });

    const hasMore = sessions.length > limit;
    const page = hasMore ? sessions.slice(0, limit) : sessions;
    const sessionIds = page.map((s) => s.id);

    /**
     * ✅ IMPORTANT:
     * Avoid a single prisma.$transaction([...]) with mixed return shapes.
     * That creates union types that break TS narrowing (your errors).
     *
     * Instead: run 3 separate typed transactions (each returns a clean array type).
     *
     * NOTE:
     * limit <= 50 -> 50 findFirst calls is acceptable for MVP history.
     */

    type LastMsg = { sessionId: string; role: string; content: string; createdAt: Date };
    type LastUserMsg = { sessionId: string; content: string };
    type LastAssistantMsg = { sessionId: string; role: string; content: string };

    // 1) Latest message per session (preview)
    const lastPerSession = (await prisma.$transaction(
      sessionIds.map((sid) =>
        prisma.chatMessage.findFirst({
          where: { auth0Sub: sub, sessionId: sid },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { sessionId: true, role: true, content: true, createdAt: true },
        })
      )
    )) as Array<LastMsg | null>;

    // 2) Latest USER message per session (title fallback)
    const lastUserPerSession = (await prisma.$transaction(
      sessionIds.map((sid) =>
        prisma.chatMessage.findFirst({
          where: { auth0Sub: sub, sessionId: sid, role: "user" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { sessionId: true, content: true },
        })
      )
    )) as Array<LastUserMsg | null>;

    // 3) Latest ASSISTANT message per session (effectiveMode inference)
    const lastAssistantPerSession = (await prisma.$transaction(
      sessionIds.map((sid) =>
        prisma.chatMessage.findFirst({
          where: { auth0Sub: sub, sessionId: sid, role: "assistant" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { sessionId: true, role: true, content: true },
        })
      )
    )) as Array<LastAssistantMsg | null>;

    const lastBySessionId = new Map<string, LastMsg>();
    for (const m of lastPerSession) {
      if (m) lastBySessionId.set(m.sessionId, m);
    }

    const lastUserBySessionId = new Map<string, LastUserMsg>();
    for (const m of lastUserPerSession) {
      if (m) lastUserBySessionId.set(m.sessionId, m);
    }

    const lastAssistantBySessionId = new Map<string, LastAssistantMsg>();
    for (const m of lastAssistantPerSession) {
      if (m) lastAssistantBySessionId.set(m.sessionId, m);
    }

    const res = NextResponse.json({
      items: page.map((s) => {
        const last = lastBySessionId.get(s.id) ?? null;
        const lastUser = lastUserBySessionId.get(s.id) ?? null;
        const lastAssistant = lastAssistantBySessionId.get(s.id) ?? null;

        const computedTitle =
          s.title?.trim()
            ? sanitizeTitle(s.title)
            : lastUser?.content?.trim()
              ? sanitizeTitle(lastUser.content)
              : "New chat";

        const persistedMode = normalizeMode(s.mode);

        const effectiveMode = computeEffectiveMode({
          persistedMode,
          lastAssistantMessage: lastAssistant ? { role: lastAssistant.role, content: lastAssistant.content } : null,
        });

        const artifactMeta = readArtifactMeta(s.artifactJson);

        return {
          id: s.id,
          title: computedTitle,

          // mode: persisted DB mode (kept for backward compatibility)
          mode: persistedMode,

          // effectiveMode: UI mode for badges + session consistency (M6.1)
          effectiveMode,

          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          lastActivityAt: s.updatedAt.toISOString(),
          lastMessage: last
            ? {
                role: last.role,
                content: last.content,
                createdAt: last.createdAt.toISOString(),
              }
            : null,

          // M7.7 / M9 CHANGE: sidebar/history metadata
          hasPinnedRequirement: artifactMeta.hasPinnedRequirement,
          artifactUpdatedAt: s.artifactUpdatedAt ? s.artifactUpdatedAt.toISOString() : null,
          hasPersistentTestSuite: artifactMeta.hasPersistentTestSuite,
          testSuiteVersion: artifactMeta.testSuiteVersion,
          testSuiteCount: artifactMeta.testSuiteCount,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1].id : null,
      hasMore,
    });

    log("info", {
      event: "chat_completed",
      requestId,
      auth0Sub: sub,
      durationMs: Date.now() - t0,
      meta: {
        route: "/api/chat/history",
        limit,
        hasMore,
        returned: page.length,
      },
    });

    // WHY: return requestId so you can correlate client-side issues to logs if needed
    res.headers.set("x-request-id", requestId);
    return res;
  } catch (err) {
    log("error", {
      event: "chat_error",
      requestId,
      errorType: "chat_history_error",
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
      meta: { route: "/api/chat/history" },
    });

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}