export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  createLemonSqueezyCheckout,
  evaluateCheckoutEligibility,
} from "@/lib/server/billing/lemonSqueezyCheckout";

export async function POST() {
  let auth0Sub: string | undefined;

  try {
    const session = await auth0.getSession();
    auth0Sub = session?.user?.sub;
  } catch {
    return NextResponse.json({ error: "checkout_unavailable" }, { status: 503 });
  }

  const result = await createLemonSqueezyCheckout({
    auth0Sub,
    environment: {
      runtimeStage: env.RUNTIME_STAGE,
      enabled: env.LEMON_SQUEEZY_ENABLED,
      mode: env.LEMON_SQUEEZY_MODE,
      storeId: env.LEMON_SQUEEZY_STORE_ID,
      variantId: env.LEMON_SQUEEZY_VARIANT_ID,
      apiKey: env.LEMON_SQUEEZY_API_KEY,
      appBaseUrl: env.APP_BASE_URL,
    },
    dependencies: {
      findMemberships: (authenticatedSubject) =>
        prisma.orgMember.findMany({
          where: { auth0Sub: authenticatedSubject },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 2,
          select: { organizationId: true },
        }),
      checkoutEligible: async (organizationId) => {
        const [wallet, subscription] = await Promise.all([
          prisma.creditWallet.findUnique({
            where: { organizationId_currency: { organizationId, currency: "credits" } },
            select: { balance: true },
          }),
          prisma.subscription.findFirst({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            select: { status: true, currentPeriodEnd: true },
          }),
        ]);
        return evaluateCheckoutEligibility({ organizationId, subscription, wallet }).ok;
      },
      fetchProvider: fetch,
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
