import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx =
  | { params: { sessionId: string } }
  | { params: Promise<{ sessionId: string }> };

const MAX_TITLE_LEN = 80;

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const authSession = await auth0.getSession();
  const sub = authSession?.user?.sub;
  if (!sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // WHY: params may be a Promise depending on runtime/build output.
  const { sessionId } = await (ctx as any).params;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Safe JSON parsing (don’t throw 500 on bad JSON)
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  // Normalize title:
  // - trim whitespace
  // - empty string => null (allows “clear title”)
  // - enforce max length
  const raw = typeof body?.title === "string" ? body.title : "";
  const trimmed = raw.trim();
  const normalizedTitle = trimmed.length === 0 ? null : trimmed;

  if (normalizedTitle && normalizedTitle.length > MAX_TITLE_LEN) {
    return NextResponse.json(
      { error: `Invalid title (max ${MAX_TITLE_LEN} chars)` },
      { status: 400 }
    );
  }

  try {
    // WHY: Do ownership check + update atomically in ONE statement via where-clause.
    // This avoids race conditions and prevents “exists but belongs to someone else” leaks.
    const updated = await prisma.chatSession.updateMany({
      where: { id: sessionId, auth0Sub: sub },
      data: {
        title: normalizedTitle,
        titleUpdatedAt: new Date(), // UX: deterministic rename ordering

        // If you have a titleUpdatedAt field, update it here as well.
        // titleUpdatedAt: new Date(),
      },
    });

    // updateMany returns count. If 0, either not found or not owned.
    if (updated.count === 0) {
      // Keep response conservative (don’t reveal whether session exists for another user)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return canonical session shape for the sidebar (UI-friendly)
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, auth0Sub: sub },
      select: { id: true, title: true, mode: true, createdAt: true },
    });

    return NextResponse.json({
      ok: true,
      session: session
        ? {
            id: session.id,
            title: session.title ?? null,
            mode: session.mode,
            createdAt: session.createdAt.toISOString(),
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
