// /lib/redis.ts
import "server-only";

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Central Upstash Redis client.
 * - Server-only
 * - Uses validated env vars (Step 2)
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});
