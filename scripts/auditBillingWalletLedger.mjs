#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const CREDIT_CURRENCY = "credits";
const RECENT_ACTIVITY_DAYS = 90;
const HIGH_RISK_LIMIT = 10;

function sslConfig() {
  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : undefined;
}

function shortId(value) {
  if (!value) return "unknown";
  return String(value).slice(0, 8);
}

function hashRef(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function reasonCounts(ledger) {
  return ledger.reduce((acc, entry) => {
    acc[entry.reason] = (acc[entry.reason] ?? 0) + 1;
    return acc;
  }, {});
}

function hasReasonPrefix(ledger, prefix) {
  return ledger.some((entry) => entry.reason === prefix || entry.reason.startsWith(`${prefix}:`));
}

function isActiveSubscription(subscription, now) {
  if (!subscription) return false;
  if (!["active", "trialing"].includes(subscription.status)) return false;
  return subscription.currentPeriodEnd >= now;
}

function isLegacyOrHistoricalPlan(subscription) {
  if (!subscription) return false;
  // standard_trial_v1 is intentionally not treated as live until the plan is
  // assigned to accounts; update this classifier when standardTrial becomes active.
  return !["trial_v1", "standard_v1"].includes(subscription.planCode);
}

function classifyMismatch({ wallet, ledgerSum, latestSubscription, activity, now }) {
  const ledger = wallet.ledger;
  const balance = wallet.balance;
  const hasTrialGrant = ledger.some((entry) => entry.reason === "trial_grant");
  const hasChatUsage = ledger.some((entry) => entry.reason === "chat_usage");
  const hasAdminTopUp = ledger.some((entry) => entry.reason.startsWith("admin_adjust"));
  const activeSubscription = isActiveSubscription(latestSubscription, now);
  const legacyPlan = isLegacyOrHistoricalPlan(latestSubscription);
  const hasActivity =
    activity.chatSessionCount > 0 ||
    activity.chatMessageCount > 0 ||
    activity.telemetryCount > 0;
  const hasRecentActivity =
    activity.hasRecentChatSession ||
    activity.hasRecentChatMessage ||
    activity.hasRecentTelemetry;

  if (activeSubscription && (hasActivity || hasRecentActivity)) {
    return "active non-admin risk";
  }

  if (ledger.length === 0 && balance !== 0) {
    return "wallet-only historical balance suspected";
  }

  if (balance > ledgerSum && balance > 0 && !hasTrialGrant && !hasAdminTopUp) {
    return "missing grant ledger suspected";
  }

  if (balance < ledgerSum && !hasChatUsage) {
    return "missing charge ledger suspected";
  }

  if (legacyPlan || hasAdminTopUp || (!activeSubscription && !hasRecentActivity)) {
    return "admin/test/historical suspected";
  }

  return "insufficient evidence";
}

function summarizeByCategory(rows) {
  return rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
}

async function activityForOrganization(prisma, organizationId, auth0Subs, recentSince) {
  const telemetry = await prisma.telemetryEventLog.aggregate({
    where: { organizationId },
    _count: { _all: true },
    _max: { createdAt: true },
  });

  if (auth0Subs.length === 0) {
    return {
      chatSessionCount: 0,
      chatMessageCount: 0,
      telemetryCount: telemetry._count._all,
      hasRecentChatSession: false,
      hasRecentChatMessage: false,
      hasRecentTelemetry:
        telemetry._max.createdAt != null && telemetry._max.createdAt >= recentSince,
    };
  }

  const [chatSessions, chatMessages] = await Promise.all([
    prisma.chatSession.aggregate({
      where: { auth0Sub: { in: auth0Subs } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.chatMessage.aggregate({
      where: { auth0Sub: { in: auth0Subs } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);

  return {
    chatSessionCount: chatSessions._count._all,
    chatMessageCount: chatMessages._count._all,
    telemetryCount: telemetry._count._all,
    hasRecentChatSession:
      chatSessions._max.updatedAt != null && chatSessions._max.updatedAt >= recentSince,
    hasRecentChatMessage:
      chatMessages._max.createdAt != null && chatMessages._max.createdAt >= recentSince,
    hasRecentTelemetry:
      telemetry._max.createdAt != null && telemetry._max.createdAt >= recentSince,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the read-only billing audit.");
  }

  console.log("Release Signal billing wallet/ledger classifier");
  console.log("Mode: diagnostic read-only. This script does not mutate data.");
  console.log("Auth0 admin status: unknown from DB; verify manually before cleanup.");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig(),
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error", "warn"],
  });

  try {
    const now = new Date();
    const recentSince = new Date(now.getTime() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000);

    const wallets = await prisma.creditWallet.findMany({
      where: { currency: CREDIT_CURRENCY },
      include: {
        ledger: {
          orderBy: { createdAt: "asc" },
        },
        organization: {
          include: {
            members: {
              select: {
                auth0Sub: true,
                role: true,
              },
            },
            plans: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const rows = [];

    for (const wallet of wallets) {
      const ledgerSum = wallet.ledger.reduce((sum, entry) => sum + entry.delta, 0);
      if (wallet.balance === ledgerSum) continue;

      const auth0Subs = [
        ...new Set(wallet.organization.members.map((member) => member.auth0Sub)),
      ];
      const latestSubscription = wallet.organization.plans[0] ?? null;
      const activity = await activityForOrganization(
        prisma,
        wallet.organizationId,
        auth0Subs,
        recentSince,
      );
      const reasons = reasonCounts(wallet.ledger);
      const category = classifyMismatch({
        wallet,
        ledgerSum,
        latestSubscription,
        activity,
        now,
      });

      rows.push({
        orgRef: shortId(wallet.organizationId),
        orgHash: hashRef(wallet.organizationId),
        walletRef: shortId(wallet.id),
        walletBalance: wallet.balance,
        ledgerSum,
        delta: wallet.balance - ledgerSum,
        ledgerEntryCount: wallet.ledger.length,
        ledgerReasons: Object.keys(reasons).sort(),
        hasChatUsage: wallet.ledger.some((entry) => entry.reason === "chat_usage"),
        hasTrialGrant: wallet.ledger.some((entry) => entry.reason === "trial_grant"),
        hasAdminTopUp: hasReasonPrefix(wallet.ledger, "admin_adjust"),
        hasActiveSubscription: isActiveSubscription(latestSubscription, now),
        latestPlanCode: latestSubscription?.planCode ?? "missing",
        latestSubscriptionStatus: latestSubscription?.status ?? "missing",
        memberCount: wallet.organization.members.length,
        storedOrgAdminCount: wallet.organization.members.filter((member) => member.role === "admin")
          .length,
        activity,
        adminStatus: "unknown from DB",
        category,
      });
    }

    const totalWallets = wallets.length;
    const walletsWithBalance1000 = wallets.filter((wallet) => wallet.balance === 1000).length;
    const mismatchesWithNoLedgerEntries = rows.filter((row) => row.ledgerEntryCount === 0).length;
    const mismatchesWithLedgerEntriesWrongBalance = rows.filter(
      (row) => row.ledgerEntryCount > 0,
    ).length;
    const activeNonAdminRiskRows = rows.filter(
      (row) => row.category === "active non-admin risk",
    );
    const highRiskRows = [...rows]
      .sort((a, b) => {
        const riskA = a.category === "active non-admin risk" ? 1 : 0;
        const riskB = b.category === "active non-admin risk" ? 1 : 0;
        if (riskA !== riskB) return riskB - riskA;
        return Math.abs(b.delta) - Math.abs(a.delta);
      })
      .slice(0, HIGH_RISK_LIMIT);

    console.log("");
    console.log("Summary");
    console.table({
      totalWallets,
      totalMismatches: rows.length,
      walletsWithBalance1000,
      mismatchesWithActiveNonAdminEvidence: activeNonAdminRiskRows.length,
      mismatchesWithNoLedgerEntries,
      mismatchesWithLedgerEntriesWrongBalance,
    });

    console.log("");
    console.log("Mismatches by category");
    console.table(summarizeByCategory(rows));

    console.log("");
    console.log("Highest-risk rows requiring manual review");
    console.table(
      highRiskRows.map((row) => ({
        category: row.category,
        orgRef: row.orgRef,
        orgHash: row.orgHash,
        walletRef: row.walletRef,
        walletBalance: row.walletBalance,
        ledgerSum: row.ledgerSum,
        delta: row.delta,
        ledgerEntryCount: row.ledgerEntryCount,
        ledgerReasons: row.ledgerReasons.join(", ") || "none",
        latestPlanCode: row.latestPlanCode,
        latestSubscriptionStatus: row.latestSubscriptionStatus,
        hasActiveSubscription: row.hasActiveSubscription,
        chatUsage: row.hasChatUsage,
        trialGrant: row.hasTrialGrant,
        adminTopUp: row.hasAdminTopUp,
        chatSessions: row.activity.chatSessionCount,
        chatMessages: row.activity.chatMessageCount,
        telemetry: row.activity.telemetryCount,
        adminStatus: row.adminStatus,
      })),
    );

    console.log("");
    console.log("Recommendation guide");
    console.log("- Option A: only after manual Auth0/runtime review proves mismatches are admin/test/historical.");
    console.log("- Option B: use if active non-admin risk rows remain after review.");
    console.log("- Option C: use when DB-only evidence is insufficient; this is the default for unknown admin status.");
    console.log("- Option D: use only if reviewed evidence points to a current billing write-path defect.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Read-only billing audit failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
