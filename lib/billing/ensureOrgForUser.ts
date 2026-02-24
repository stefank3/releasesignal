// lib/billing/ensureOrgForUser.ts
import { prisma } from "@/lib/prisma";

export type EnsureOrgState = {
  organizationId: string;
  role: "admin" | "member" | string; // keep flexible if you want
  wallet: { id: string; balance: number };
};

export async function ensureOrgForUser(params: {
  auth0Sub: string;
  name?: string | null;
  email?: string | null;
}): Promise<EnsureOrgState> {
  const { auth0Sub, name } = params;

  const member = await prisma.orgMember.findFirst({
    where: { auth0Sub },
    select: { organizationId: true, role: true },
  });

  if (member) {
    const wallet =
      (await prisma.creditWallet.findUnique({
        where: {
          organizationId_currency: { organizationId: member.organizationId, currency: "credits" },
        },
        select: { id: true, balance: true },
      })) ??
      (await prisma.creditWallet.create({
        data: { organizationId: member.organizationId, currency: "credits", balance: 0 },
        select: { id: true, balance: true },
      }));

    return { organizationId: member.organizationId, role: member.role, wallet };
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const org = await prisma.organization.create({
    data: {
      name: name ? `${name}'s Office` : "New Office",
      members: { create: { auth0Sub, role: "admin" } },
      wallets: { create: { currency: "credits", balance: 0 } },
      plans: {
        create: {
          status: "active",
          planCode: "office_50",
          seats: 5,
          monthlyCredits: 5000,
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

  return {
    organizationId: org.id,
    role: org.members[0]?.role ?? "admin",
    wallet: org.wallets[0]!,
  };
}