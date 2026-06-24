// lib/billing/ensureOrgForUser.ts
import { prisma } from "@/lib/prisma";

const CREDIT_CURRENCY = "credits";
const TRIAL_DURATION_DAYS = 15;
const TRIAL_STARTING_CREDITS = 100;
const TRIAL_PLAN_CODE = "trial_v1";
const TRIAL_STATUS = "trialing";
const TRIAL_SEATS = 1;
const TRIAL_GRANT_REASON = "trial_grant";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type EnsureOrgState = {
  organizationId: string;
  role: "admin" | "member" | string; // keep flexible if you want
  wallet: { id: string; balance: number };
};

export async function ensureOrgForUser(params: {
  auth0Sub: string;
  name?: string | null;
  email?: string | null;
  isAuth0Admin?: boolean;
}): Promise<EnsureOrgState> {
  const { auth0Sub, name, isAuth0Admin = false } = params;

  const member = await prisma.orgMember.findFirst({
    where: { auth0Sub },
    select: { organizationId: true, role: true },
  });

  if (member) {
    const wallet =
      (await prisma.creditWallet.findUnique({
        where: {
          organizationId_currency: { organizationId: member.organizationId, currency: CREDIT_CURRENCY },
        },
        select: { id: true, balance: true },
      })) ??
      (await prisma.creditWallet.create({
        data: { organizationId: member.organizationId, currency: CREDIT_CURRENCY, balance: 0 },
        select: { id: true, balance: true },
      }));

    return { organizationId: member.organizationId, role: member.role, wallet };
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * DAY_IN_MS);

  return prisma.$transaction(async (tx) => {
    if (isAuth0Admin) {
      const org = await tx.organization.create({
        data: {
          name: name ? `${name}'s Admin Workspace` : "Admin Workspace",
          members: { create: { auth0Sub, role: "admin" } },
          wallets: { create: { currency: CREDIT_CURRENCY, balance: 0 } },
        },
        select: {
          id: true,
          members: { select: { role: true }, take: 1 },
          wallets: { select: { id: true, balance: true }, take: 1 },
        },
      });

      return {
        organizationId: org.id,
        role: org.members[0]?.role ?? "admin",
        wallet: org.wallets[0]!,
      };
    }

    const org = await tx.organization.create({
      data: {
        name: name ? `${name}'s Office` : "New Office",
        members: { create: { auth0Sub, role: "admin" } },
        wallets: { create: { currency: CREDIT_CURRENCY, balance: TRIAL_STARTING_CREDITS } },
        plans: {
          create: {
            status: TRIAL_STATUS,
            planCode: TRIAL_PLAN_CODE,
            seats: TRIAL_SEATS,
            monthlyCredits: TRIAL_STARTING_CREDITS,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        },
      },
      select: {
        id: true,
        members: { select: { role: true }, take: 1 },
        wallets: { select: { id: true, balance: true }, take: 1 },
      },
    });

    const wallet = org.wallets[0]!;

    await tx.creditLedger.create({
      data: {
        walletId: wallet.id,
        auth0Sub,
        delta: TRIAL_STARTING_CREDITS,
        reason: TRIAL_GRANT_REASON,
        requestId: `${TRIAL_GRANT_REASON}:${org.id}`,
      },
    });

    return {
      organizationId: org.id,
      role: org.members[0]?.role ?? "admin",
      wallet,
    };
  });
}
