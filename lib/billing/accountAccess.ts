import "server-only";

import { prisma } from "@/lib/prisma";

export type AccountAccessFailureReason =
  | "subscription_missing"
  | "subscription_inactive"
  | "trial_expired"
  | "subscription_expired"
  | "wallet_missing"
  | "insufficient_credits";

type AccountAccessSnapshot = {
  creditsRemaining: number;
  planStatus: string | null;
  currentPeriodEnd: string | null;
};

export type AccountAccessResult =
  | ({ ok: true } & AccountAccessSnapshot)
  | ({ ok: false; reason: AccountAccessFailureReason } & AccountAccessSnapshot);

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function creditsRemaining(wallet: { balance: number } | null | undefined) {
  return Math.max(0, wallet?.balance ?? 0);
}

export async function evaluateAccountAccess(params: {
  organizationId: string | undefined;
  wallet: { balance: number } | null | undefined;
  now?: Date;
}): Promise<AccountAccessResult> {
  const snapshot = {
    creditsRemaining: creditsRemaining(params.wallet),
    planStatus: null,
    currentPeriodEnd: null,
  };

  if (!params.organizationId) {
    return { ok: false, reason: "subscription_missing", ...snapshot };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: params.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      currentPeriodEnd: true,
    },
  });

  if (!subscription) {
    return { ok: false, reason: "subscription_missing", ...snapshot };
  }

  const accountState = {
    creditsRemaining: snapshot.creditsRemaining,
    planStatus: subscription.status,
    currentPeriodEnd: toIsoString(subscription.currentPeriodEnd),
  };

  const now = params.now ?? new Date();

  if (subscription.status === "trialing") {
    if (!subscription.currentPeriodEnd || subscription.currentPeriodEnd < now) {
      return { ok: false, reason: "trial_expired", ...accountState };
    }
  } else if (subscription.status === "active") {
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) {
      return { ok: false, reason: "subscription_expired", ...accountState };
    }
  } else {
    return { ok: false, reason: "subscription_inactive", ...accountState };
  }

  if (!params.wallet) {
    return { ok: false, reason: "wallet_missing", ...accountState };
  }

  if (params.wallet.balance <= 0) {
    return { ok: false, reason: "insufficient_credits", ...accountState };
  }

  return { ok: true, ...accountState };
}
