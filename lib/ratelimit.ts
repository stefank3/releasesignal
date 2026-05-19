// /lib/ratelimit.ts
import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

type RateLimitWindow = "60 s";

/**
 * Central rate limiter instance for /api/chat.
 * Keep config centralized and environment-isolated.
 */
export const CHAT_RATE_LIMIT = Object.freeze({
  limit: 20,
  window: "60 s" as RateLimitWindow,

  /**
   * WHY:
   * Prefix must be environment-isolated.
   * This prevents preview deployments from affecting production limits.
   */
  prefix: `${env.REDIS_PREFIX}ratelimit:chat`,
});

export const ROUTE_RATE_LIMITS = Object.freeze({
  accountStatus: {
    limit: 60,
    window: "60 s" as RateLimitWindow,
    prefix: `${env.REDIS_PREFIX}ratelimit:me`,
  },
  testSuiteExport: {
    limit: 20,
    window: "60 s" as RateLimitWindow,
    prefix: `${env.REDIS_PREFIX}ratelimit:test-suite-export`,
  },
  executionEvidence: {
    limit: 30,
    window: "60 s" as RateLimitWindow,
    prefix: `${env.REDIS_PREFIX}ratelimit:execution-evidence`,
  },
  adminMetrics: {
    limit: 30,
    window: "60 s" as RateLimitWindow,
    prefix: `${env.REDIS_PREFIX}ratelimit:admin-metrics`,
  },
  adminBillingOverview: {
    limit: 30,
    window: "60 s" as RateLimitWindow,
    prefix: `${env.REDIS_PREFIX}ratelimit:admin-billing-overview`,
  },
  adminBillingTopup: {
    limit: 10,
    window: "60 s" as RateLimitWindow,
    prefix: `${env.REDIS_PREFIX}ratelimit:admin-billing-topup`,
  },
});

export type RouteRateLimitPolicy = keyof typeof ROUTE_RATE_LIMITS;

export function createSlidingWindowRatelimit(policy: {
  limit: number;
  window: RateLimitWindow;
  prefix: string;
}) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    analytics: true,
    prefix: policy.prefix,
  });
}

export const chatRatelimit = createSlidingWindowRatelimit(CHAT_RATE_LIMIT);
