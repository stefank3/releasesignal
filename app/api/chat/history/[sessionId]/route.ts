import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx =
  | { params: { sessionId: string } }
  | { params: Promise<{ sessionId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const authSession = await auth0.getSession();
  const sub = authSession?.user?.sub;
  if (!sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // WHY: Next.js sometimes passes params as a Promise depending on runtime / build output.
  // This keeps the route stable across local + Vercel.
  const { sessionId } = await (ctx as any).params;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  // WHY: Prevent leaking existence of sessions across users.
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, auth0Sub: sub },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);

  const limitRaw = Number(url.searchParams.get("limit") ?? 120);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 120;

  const cursor = url.searchParams.get("cursor");

  const rows = await prisma.chatMessage.findMany({
    where: { sessionId, auth0Sub: sub },

    // CURSOR: Deterministic ordering is REQUIRED for cursor pagination.
    // Add id as a tie-breaker for messages created in the same millisecond.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],

    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, role: true, content: true, createdAt: true },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // UX: Client usually renders messages oldest→newest.
  // We query in DESC for efficient pagination, then reverse for display.
  const items = page
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(), // ✅ explicit + consistent
    }));

  return NextResponse.json({
    items,

    // CURSOR: nextCursor references the LAST item of the *DESC* page (not the reversed list).
    // Client sends it back to request the next "older" page.
    nextCursor: hasMore ? page[page.length - 1].id : null,
    hasMore, // ✅ explicit contract
  });
}
