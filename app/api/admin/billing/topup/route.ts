// app/api/admin/billing/topup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { auth0 } from "@/lib/auth0";
import { isAdminFromAccessToken } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { enforceRouteRateLimit } from "@/lib/server/rateLimit";
import { buildInternalServerErrorResponse } from "@/lib/server/apiErrorResponse";

/**
 * Standard response headers for request correlation.
 * NOTE: you already use x-request-id inbound, we echo back X-Request-Id.
 */
function responseHeaders(requestId: string) {
  return { "X-Request-Id": requestId };
}

/**
 * Prisma unique violation detector.
 * WHY: we want topup to be idempotent on replays (same requestId).
 */
function isPrismaKnownErrorWithCode(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e && typeof (e as { code?: unknown }).code === "string";
}

function isUniqueViolation(e: unknown): boolean {
  return isPrismaKnownErrorWithCode(e) && e.code === "P2002";
}
type Body = {
  amount: number; // required, positive integer
  organizationId?: string; // optional, defaults to admin’s org
  note?: string; // optional, stored in reason suffix
};

export async function POST(req: Request) {
  // ✅ Correlation id: accept inbound header, else generate.
  const inbound = req.headers.get("x-request-id");
  const requestId = inbound && inbound.length < 200 ? inbound : randomUUID();

  try {
    // 1) Auth: must be logged in
    const session = await auth0.getSession();
    if (!session?.user?.sub) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: responseHeaders(requestId) });
    }

    // 2) RBAC: must be admin
    const isAdmin = await isAdminFromAccessToken();
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: responseHeaders(requestId) });
    }

    const auth0Sub = session.user.sub as string;

    const rateLimit = await enforceRouteRateLimit({
      policy: "adminBillingTopup",
      identifier: `admin:${auth0Sub}`,
      requestId,
    });

    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    // 3) Parse + validate body
    const body = (await req.json()) as Body;
    const amountRaw = body?.amount;

    // Validate amount as positive integer
    const amount = Number.isFinite(amountRaw) ? Math.trunc(amountRaw) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid amount (must be a positive integer)" },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }
    if (amount > 1_000_000) {
      return NextResponse.json({ ok: false, error: "Amount too large" }, { status: 400, headers: responseHeaders(requestId) });
    }

    // 4) Resolve organizationId (optional param; default to admin’s org)
    let organizationId = body?.organizationId;

    if (!organizationId) {
      const member = await prisma.orgMember.findFirst({
        where: { auth0Sub },
        select: { organizationId: true },
      });
      if (!member) {
        return NextResponse.json(
          { ok: false, error: "Admin has no organization" },
          { status: 400, headers: responseHeaders(requestId) }
        );
      }
      organizationId = member.organizationId;
    }

    // ✅ Hard narrow
    const orgId = organizationId;
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "Missing organizationId" }, { status: 400, headers: responseHeaders(requestId) });
    }

    // 5) Reason normalization
    // NOTE: Reason participates in the unique constraint with requestId for idempotency.
    const reason = body?.note?.trim()
      ? `admin_adjust:${body.note.trim().slice(0, 60)}`
      : "admin_adjust";

    /**
     * 6) Transaction: make the operation fully retry-safe.
     *
     * IDP rules:
     * - If ledger row for (walletId, reason, requestId) exists => treat as replay => return current balance
     * - Else create ledger row, then increment wallet.
     *
     * WHY ledger first:
     * - Prevents wallet increment without ledger in crash/timeout scenarios.
     */
    const result = await prisma.$transaction(async (tx) => {
      // Ensure wallet exists
      const wallet =
        (await tx.creditWallet.findUnique({
          where: { organizationId_currency: { organizationId: orgId, currency: "credits" } },
          select: { id: true, balance: true },
        })) ??
        (await tx.creditWallet.create({
          data: { organizationId: orgId, currency: "credits", balance: 0 },
          select: { id: true, balance: true },
        }));

      // Quick replay check (cheap read)
      const existing = await tx.creditLedger.findFirst({
        where: { walletId: wallet.id, reason, requestId },
        select: { id: true },
      });

      if (existing) {
        // Replay => success (no double-credit)
        const snap = await tx.creditWallet.findUnique({
          where: { id: wallet.id },
          select: { balance: true },
        });
        return { walletId: wallet.id, balance: snap?.balance ?? wallet.balance, replay: true };
      }

      // Create ledger row first (may throw P2002 if concurrent replay hits)
      try {
        await tx.creditLedger.create({
          data: {
            walletId: wallet.id,
            auth0Sub,
            delta: amount,
            reason,
            requestId,
          },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          // Concurrent replay => treat as success
          const snap = await tx.creditWallet.findUnique({
            where: { id: wallet.id },
            select: { balance: true },
          });
          return { walletId: wallet.id, balance: snap?.balance ?? wallet.balance, replay: true };
        }
        throw e;
      }

      // Now apply wallet change
      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
        select: { balance: true },
      });

      return { walletId: wallet.id, balance: updated.balance, replay: false };
    });

    // 7) Success response
    return NextResponse.json(
      {
        ok: true,
        organizationId: orgId,
        amount,
        balance: result.balance,
        replay: result.replay,
      },
      { status: 200, headers: responseHeaders(requestId) }
    );
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";

    log("error", {
      event: "billing_topup_error",
      requestId,
      errorType: "admin_billing_topup_failed",
      errorMessage: errMsg,
    });

    return buildInternalServerErrorResponse({
      requestId,
      headers: responseHeaders(requestId),
    });
  }
}
