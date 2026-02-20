import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
  const rawParams =
    ctx.params instanceof Promise ? await ctx.params : ctx.params;

  return rawParams;
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
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  /**
   * SECURITY:
   * Prevent leaking session existence across users.
   * We verify ownership before querying messages.
   */
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, auth0Sub: sub },
    select: { id: true },
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
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 200)
    : 120;

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
