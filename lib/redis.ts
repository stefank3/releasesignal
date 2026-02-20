// /lib/redis.ts
import "server-only";

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Central Upstash Redis client.
 * - Server-only
 * - Uses validated env vars
 */
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * WHY:
 * Redis keys MUST be isolated per environment (prod vs preview vs dev).
 * This is the single canonical way to build keys across the codebase.
 *
 * Example:
 *   key("ratelimit:chat") -> "prod:stefans-mvp:ratelimit:chat"
 */
export function key(suffix: string): string {
  // Defensive: avoid accidental double-prefixing
  if (suffix.startsWith(env.REDIS_PREFIX)) return suffix;
  return `${env.REDIS_PREFIX}${suffix}`;
}