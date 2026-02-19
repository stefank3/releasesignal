import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/chat/history?cursor=...&limit=20
export async function GET(req: Request) {
  const authSession = await auth0.getSession();
  const sub = authSession?.user?.sub;
  if (!sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);

  // WHY: Keep limit bounded to avoid abuse + accidental huge reads
  const limitRaw = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  const cursor = url.searchParams.get("cursor");

  // CURSOR: Stable ordering is REQUIRED for correct cursor pagination.
  // If we sort only by updatedAt and two rows share the same updatedAt, pages can drift → duplicates/missing.
  // Fix: add a unique tie-breaker (id) as the 2nd orderBy.
  const sessions = await prisma.chatSession.findMany({
    where: { auth0Sub: sub },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], // ✅ deterministic order
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), // CURSOR: cursor uses unique id (safe)
    select: {
      id: true,
      title: true,
      mode: true,
      createdAt: true,
      updatedAt: true, // ✅ used for lastActivityAt + matches sort order
    },
  });

  const hasMore = sessions.length > limit;
  const page = hasMore ? sessions.slice(0, limit) : sessions;
  const sessionIds = page.map((s) => s.id);

  // 2) Fetch latest message per session (portable, stable)
  // NOTE: This is N queries but OK for beta scale. We'll optimize later if needed.
  const lastMessages = await prisma.$transaction(
    sessionIds.map((sid) =>
      prisma.chatMessage.findFirst({
        where: { sessionId: sid, auth0Sub: sub },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], // ✅ deterministic tie-break
        select: { sessionId: true, role: true, content: true, createdAt: true },
      })
    )
  );

  const lastBySessionId = new Map(
    lastMessages.filter(Boolean).map((m) => [m!.sessionId, m!])
  );

  return NextResponse.json({
    items: page.map((s) => {
      const last = lastBySessionId.get(s.id) ?? null;

      // ✅ Single source of truth:
      // Ordering is based on updatedAt, so lastActivityAt must reflect updatedAt too.
      const lastActivity = s.updatedAt;

      return {
        id: s.id,
        title: s.title ?? null,
        mode: s.mode,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(), // ✅ useful for debugging + future UX
        lastActivityAt: lastActivity.toISOString(),
        lastMessage: last
          ? {
              role: last.role,
              content: last.content,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
      };
    }),

    // CURSOR: nextCursor must reference the last item in THIS returned page.
    // Client sends it back to get the next page.
    nextCursor: hasMore ? page[page.length - 1].id : null,
    hasMore, // ✅ explicit contract (helps UI + debugging)
  });
}
