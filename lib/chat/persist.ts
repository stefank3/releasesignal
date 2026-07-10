// lib/chat/persist.ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chargeCreditsTx, InsufficientCreditsError } from "@/lib/billing/chargeCredits";

export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function persistUserMessageIdempotent(args: {
  sessionId: string;
  auth0Sub: string;
  requestId: string;
  content: string;
}) {
  await prisma.chatMessage
    .create({
      data: { sessionId: args.sessionId, auth0Sub: args.auth0Sub, role: "user", content: args.content, requestId: args.requestId },
    })
    .catch((e) => {
      if (isUniqueViolation(e)) return null;
      throw e;
    });
}

export async function persistAssistantWithBillingTx(args: {
  sessionId: string;
  auth0Sub: string;
  requestId: string;
  creditsCharged: number;
  assistantContentToStore: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const creditsRemaining = await prisma.$transaction(
    async (tx) => {
      const remainingBal = await chargeCreditsTx(tx, {
        auth0Sub: args.auth0Sub,
        credits: args.creditsCharged,
        requestId: args.requestId,
      });

      await tx.chatMessage
        .create({
          data: {
            sessionId: args.sessionId,
            auth0Sub: args.auth0Sub,
            role: "assistant",
            content: args.assistantContentToStore,
            tokensIn: args.promptTokens,
            tokensOut: args.completionTokens,
            requestId: args.requestId,
          },
        })
        .catch((e) => {
          if (isUniqueViolation(e)) return null;
          throw e;
        });

      return remainingBal;
    },
    { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 }
  );

  return creditsRemaining;
}

export { InsufficientCreditsError };
