// lib/chat/costs.ts
// 1 credit per 1000 tokens (rounded up)
export function tokensToCredits(totalTokens: number) {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens / 1000));
}

/**
 * Internal-only cost estimate. Not used for billing, only for logs.
 * EUR conversion only happens if USD_TO_EUR is provided to avoid stale FX values.
 */
export function estimateCostUsd(args: { model: string; promptTokens: number; completionTokens: number }): number | null {
  if (args.model !== "gpt-4.1-mini") return null;

  const inCostPerToken = 0.4 / 1_000_000;
  const outCostPerToken = 1.6 / 1_000_000;

  const cost = args.promptTokens * inCostPerToken + args.completionTokens * outCostPerToken;
  return Number(cost.toFixed(8));
}

export function maybeConvertUsdToEur(costUsd: number): number | null {
  const raw = process.env.USD_TO_EUR?.trim();
  if (!raw) return null;

  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Number((costUsd * rate).toFixed(8));
}