import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Partial mitigation for completed wallet-scoped debit IDs reused in another
 * session. This lookup does not claim an ID or close the guard-to-charge race.
 * Same-session payload/action equivalence remains the existing caller's policy.
 */
export async function checkCompletedRequestId(args: {
  auth0Sub: string;
  sessionId: string;
  requestId: string;
  organizationId: string | undefined;
  walletId: string;
}): Promise<{ ok: boolean }> {
  // Match chargeCreditsTx's deterministic membership/wallet resolution. A
  // changed association since billing preflight must not authorize another wallet.
  const member = await prisma.orgMember.findFirst({
    where: { auth0Sub: args.auth0Sub },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { organizationId: true },
  });
  if (!member || member.organizationId !== args.organizationId) return { ok: false };

  const wallet = await prisma.creditWallet.findUnique({
    where: { organizationId_currency: { organizationId: member.organizationId, currency: 'credits' } },
    select: { id: true },
  });
  if (!wallet || wallet.id !== args.walletId) return { ok: false };

  const debit = await prisma.creditLedger.findUnique({
    where: { walletId_reason_requestId: {
      walletId: wallet.id, reason: 'chat_usage', requestId: args.requestId,
    } },
    select: { auth0Sub: true },
  });
  // Zero-debit completions and requests still in flight are explicitly outside
  // this ticket. Do not turn a wallet-scoped key into a global request-ID key.
  if (!debit) return { ok: true };
  if (debit.auth0Sub !== args.auth0Sub) return { ok: false };

  const currentAssistant = await prisma.chatMessage.findFirst({
    where: { sessionId: args.sessionId, auth0Sub: args.auth0Sub,
      requestId: args.requestId, role: 'assistant', session: { auth0Sub: args.auth0Sub } },
    select: { id: true },
  });
  if (!currentAssistant) return { ok: false };

  // The ledger has no session FK. Fail closed on ambiguous historical
  // associations, including other members sharing this wallet; return no IDs.
  const members = await prisma.orgMember.findMany({
    where: { organizationId: member.organizationId }, select: { auth0Sub: true },
  });
  const otherAssistant = await prisma.chatMessage.findFirst({
    where: { requestId: args.requestId, role: 'assistant',
      sessionId: { not: args.sessionId }, auth0Sub: { in: members.map(m => m.auth0Sub) } },
    select: { id: true },
  });
  return { ok: !otherAssistant };
}
