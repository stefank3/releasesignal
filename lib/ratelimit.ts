// /lib/ratelimit.ts
import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

/**
 * Central rate limiter instance for /api/chat.
 * Keep the config here so it's consistent across routes/environments.
 */
export const CHAT_RATE_LIMIT = Object.freeze({
  limit: 20,
  window: "60 s" as const,
  prefix: "stefans-mvp:chat",
});

export const chatRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(CHAT_RATE_LIMIT.limit, CHAT_RATE_LIMIT.window),
  analytics: true,
  prefix: CHAT_RATE_LIMIT.prefix,
});
