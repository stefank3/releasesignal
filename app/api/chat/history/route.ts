import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

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
  return fromHeader && fromHeader.length > 0 ? fromHeader : crypto.randomUUID();
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
      meta: {
        route: "/api/chat/history",
      },
    });

    const url = new URL(req.url);

    const limitRaw = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 50)
      : 20;

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
      },
    });

    const hasMore = sessions.length > limit;
    const page = hasMore ? sessions.slice(0, limit) : sessions;
    const sessionIds = page.map((s) => s.id);

    // Latest message per session (for preview)
    const lastMessages = await prisma.$transaction(
      sessionIds.map((sid) =>
        prisma.chatMessage.findFirst({
          where: { sessionId: sid, auth0Sub: sub },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { sessionId: true, role: true, content: true, createdAt: true },
        })
      )
    );

    const lastBySessionId = new Map(
      lastMessages.filter(Boolean).map((m) => [m!.sessionId, m!])
    );

    // Title fallback: last USER message only (never assistant)
    const lastUserMessages = await prisma.$transaction(
      sessionIds.map((sid) =>
        prisma.chatMessage.findFirst({
          where: { sessionId: sid, auth0Sub: sub, role: "user" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { sessionId: true, content: true },
        })
      )
    );

    const lastUserBySessionId = new Map(
      lastUserMessages.filter(Boolean).map((m) => [m!.sessionId, m!])
    );

    const res = NextResponse.json({
      items: page.map((s) => {
        const last = lastBySessionId.get(s.id) ?? null;
        const lastUser = lastUserBySessionId.get(s.id) ?? null;

        const computedTitle =
          s.title?.trim()
            ? sanitizeTitle(s.title)
            : lastUser?.content?.trim()
              ? sanitizeTitle(lastUser.content)
              : "New chat";

        return {
          id: s.id,
          title: computedTitle,
          mode: s.mode,
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