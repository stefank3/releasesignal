import "server-only";

import { NextResponse } from "next/server";

import {
  createSlidingWindowRatelimit,
  ROUTE_RATE_LIMITS,
  type RouteRateLimitPolicy,
} from "@/lib/ratelimit";

type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      response: NextResponse;
    };

const routeLimiters = {
  accountStatus: createSlidingWindowRatelimit(ROUTE_RATE_LIMITS.accountStatus),
  testSuiteExport: createSlidingWindowRatelimit(
    ROUTE_RATE_LIMITS.testSuiteExport
  ),
  executionEvidence: createSlidingWindowRatelimit(
    ROUTE_RATE_LIMITS.executionEvidence
  ),
  adminMetrics: createSlidingWindowRatelimit(ROUTE_RATE_LIMITS.adminMetrics),
  adminBillingOverview: createSlidingWindowRatelimit(
    ROUTE_RATE_LIMITS.adminBillingOverview
  ),
  adminBillingTopup: createSlidingWindowRatelimit(
    ROUTE_RATE_LIMITS.adminBillingTopup
  ),
} satisfies Record<
  RouteRateLimitPolicy,
  ReturnType<typeof createSlidingWindowRatelimit>
>;

function getResetSeconds(reset: unknown) {
  return typeof reset === "number"
    ? Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    : 60;
}

function buildRateLimitHeaders(args: {
  requestId: string;
  limit: number;
  remaining: number;
  resetSeconds: number;
}) {
  return {
    "X-Request-Id": args.requestId,
    "X-RateLimit-Limit": String(args.limit),
    "X-RateLimit-Remaining": String(args.remaining),
    "X-RateLimit-Reset": String(args.resetSeconds),
    "Retry-After": String(args.resetSeconds),
  };
}

export async function enforceRouteRateLimit(args: {
  policy: RouteRateLimitPolicy;
  identifier: string;
  requestId: string;
}): Promise<RateLimitResult> {
  const policy = ROUTE_RATE_LIMITS[args.policy];
  const limiter = routeLimiters[args.policy];
  const { success, reset } = await limiter.limit(args.identifier);
  const resetSeconds = getResetSeconds(reset);

  if (success) {
    return { ok: true };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded",
        reason: "rate_limited",
        limit: policy.limit,
        remaining: 0,
        resetSeconds,
      },
      {
        status: 429,
        headers: buildRateLimitHeaders({
          requestId: args.requestId,
          limit: policy.limit,
          remaining: 0,
          resetSeconds,
        }),
      }
    ),
  };
}
