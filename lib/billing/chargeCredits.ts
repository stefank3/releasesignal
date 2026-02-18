// lib/billing/chargeCredits.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Thrown when the wallet balance is lower than the credits required for this request.
 * We attach details so the API layer can return helpful metadata safely.
 */
export class InsufficientCreditsError extends Error {
  constructor(public details?: { required: number; balance: number }) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export type ChargeCreditsParams = {
  auth0Sub: string;
  credits: number;
  requestId: string; // REQUIRED for idempotency
};

/**
 * Internal type for Prisma transaction client.
 * Using the tx client lets callers (like /api/chat) compose billing with other writes
 * into a SINGLE atomic transaction.
 */
export type PrismaTx = Prisma.TransactionClient;

/**
 * Transactionally charges credits for a request USING an existing transaction client:
 * - Idempotent: same (walletId + reason + requestId) can be charged only once.
 * - Atomic: ledger write + wallet decrement happen within the caller transaction.
 * - Concurrency-safe: wallet row is locked to prevent overspending under races.
 *
 * Returns: wallet balance after charge (or current balance on idempotent replay).
 */
export async function chargeCreditsTx(tx: PrismaTx, params: ChargeCreditsParams) {
  const { auth0Sub, credits, requestId } = params;

  // ✅ Idempotency key must be stable across retries.
  if (!requestId || requestId.trim().length < 8) {
    throw new Error("chargeCreditsTx: requestId is required for idempotency");
  }

  // ✅ No-op for invalid / zero charges (caller can treat null as "no charge").
  if (!Number.isFinite(credits) || credits <= 0) return null;

  // ------------------------------------------------------------
  // 1) Resolve organization for the current user.
  // NOTE: if a user can belong to multiple orgs, this must become explicit.
  // ------------------------------------------------------------
  const member = await tx.orgMember.findFirst({
    where: { auth0Sub },
    select: { organizationId: true },
  });
  if (!member) throw new Error("User has no organization");

  // ------------------------------------------------------------
  // 2) Load wallet for that organization.
  // ------------------------------------------------------------
  const wallet = await tx.creditWallet.findUnique({
    where: {
      organizationId_currency: {
        organizationId: member.organizationId,
        currency: "credits",
      },
    },
    select: { id: true },
  });
  if (!wallet) throw new Error("No wallet");

  // ------------------------------------------------------------
  // 3) Lock the wallet row to prevent concurrent overspending.
  // This ensures two simultaneous charges can't both pass the balance check.
  // ------------------------------------------------------------
  await tx.$executeRaw`
    SELECT 1 FROM "CreditWallet"
    WHERE "id" = ${wallet.id}
    FOR UPDATE
  `;

  // ------------------------------------------------------------
  // 4) Idempotency fast-path:
  // If we already created the ledger entry for this request, do NOT charge again.
  // ------------------------------------------------------------
  const existing = await tx.creditLedger.findUnique({
    where: {
      walletId_reason_requestId: {
        walletId: wallet.id,
        reason: "chat_usage",
        requestId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    // Replay: return current balance (no double charge).
    const current = await tx.creditWallet.findUnique({
      where: { id: wallet.id },
      select: { balance: true },
    });
    return current?.balance ?? 0;
  }

  // ------------------------------------------------------------
  // 5) Re-read balance after acquiring the lock (important).
  // ------------------------------------------------------------
  const lockedWallet = await tx.creditWallet.findUnique({
    where: { id: wallet.id },
    select: { balance: true },
  });
  if (!lockedWallet) throw new Error("Wallet not found after lock");

  if (lockedWallet.balance < credits) {
    throw new InsufficientCreditsError({
      required: credits,
      balance: lockedWallet.balance,
    });
  }

  // ------------------------------------------------------------
  // 6) Create ledger entry (idempotency enforced by DB unique constraint).
  // If a concurrent transaction already created it, treat as replay.
  // ------------------------------------------------------------
  try {
    await tx.creditLedger.create({
      data: {
        walletId: wallet.id,
        auth0Sub,
        delta: -credits,
        reason: "chat_usage",
        requestId,
      },
      select: { id: true },
    });
  } catch (e) {
    // P2002 = unique constraint violation => another request already wrote the ledger.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const current = await tx.creditWallet.findUnique({
        where: { id: wallet.id },
        select: { balance: true },
      });
      return current?.balance ?? 0;
    }
    throw e;
  }

  // ------------------------------------------------------------
  // 7) Decrement wallet balance.
  // Safe because we're in the same transaction as the ledger create.
  // ------------------------------------------------------------
  const updated = await tx.creditWallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: credits } },
    select: { balance: true },
  });

  return updated.balance;
}

/**
 * Public API: charge credits as a standalone operation.
 * This wrapper opens its own transaction and calls chargeCreditsTx() internally.
 */
export async function chargeCredits(params: ChargeCreditsParams) {
  return prisma.$transaction(
    async (tx) => chargeCreditsTx(tx, params),
    {
      // Serializable is the safest level for financial correctness.
      // If you see contention, handle retries at the API boundary (NOT by re-calling OpenAI).
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    }
  );
}
