// /lib/ratelimit.ts
import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

/**
 * Central rate limiter instance for /api/chat.
 * Keep config centralized and environment-isolated.
 */
export const CHAT_RATE_LIMIT = Object.freeze({
  limit: 20,
  window: "60 s" as const,

  /**
   * WHY:
   * Prefix must be environment-isolated.
   * This prevents preview deployments from affecting production limits.
   */
prefix: `${env.REDIS_PREFIX}ratelimit:chat`,
 });

export const chatRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(
    CHAT_RATE_LIMIT.limit,
    CHAT_RATE_LIMIT.window
  ),

  /**
   * WHY:
   * Upstash analytics can stay enabled.
   * It does not affect behavior.
   */
  analytics: true,

  prefix: CHAT_RATE_LIMIT.prefix,
});