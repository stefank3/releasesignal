// /lib/env.ts
import "server-only";

/**
 * Centralized environment validation for server-side code.
 * Goal: fail fast with a clear error when Vercel/local env vars drift.
 *
 * IMPORTANT:
 * - Do not import this from client components.
 * - Safe to import from API routes and other server-only modules.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function normalizeRedisPrefix(prefix: string): string {
  const p = prefix.trim();

  // Ensure it ends with ":" so concatenations are stable and readable.
  return p.endsWith(":") ? p : `${p}:`;
}

function inferRedisStage(): "prod" | "preview" | "dev" {
  // Vercel sets VERCEL_ENV = "production" | "preview" | "development"
  const ve = (process.env.VERCEL_ENV ?? "").toLowerCase().trim();

  if (ve === "production") return "prod";
  if (ve === "preview") return "preview";

  // Local + anything else
  return "dev";
}

/**
 * WHY:
 * We must isolate Redis keys between:
 * - production
 * - preview deployments
 * - local development
 *
 * Vercel sets:
 *   VERCEL_ENV = "production" | "preview" | "development"
 *
 * We derive a stable runtime tag from that.
 */
function resolveRuntimeStage(): "prod" | "preview" | "dev" {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") return "prod";
  if (vercelEnv === "preview") return "preview";

  // Local or anything else defaults to dev
  return "dev";
}

const runtimeStage = resolveRuntimeStage();

export const env = Object.freeze({
  // Runtime DB (Pooler)
  DATABASE_URL: requireEnv("DATABASE_URL"),

  // Direct DB (migrations / maintenance)
  DIRECT_URL: requireEnv("DIRECT_URL"),

  // Auth0
  AUTH0_DOMAIN: requireEnv("AUTH0_DOMAIN"),
  AUTH0_CLIENT_ID: requireEnv("AUTH0_CLIENT_ID"),
  AUTH0_CLIENT_SECRET: requireEnv("AUTH0_CLIENT_SECRET"),
  AUTH0_SECRET: requireEnv("AUTH0_SECRET"),
  APP_BASE_URL: requireEnv("APP_BASE_URL"),

  // Lemon Squeezy checkout (server-only; disabled unless explicitly enabled)
  LEMON_SQUEEZY_ENABLED: optionalEnv("LEMON_SQUEEZY_ENABLED") ?? "false",
  LEMON_SQUEEZY_MODE: optionalEnv("LEMON_SQUEEZY_MODE"),
  LEMON_SQUEEZY_STORE_ID: optionalEnv("LEMON_SQUEEZY_STORE_ID"),
  LEMON_SQUEEZY_VARIANT_ID: optionalEnv("LEMON_SQUEEZY_VARIANT_ID"),
  LEMON_SQUEEZY_API_KEY: optionalEnv("LEMON_SQUEEZY_API_KEY"),

  // Upstash
  UPSTASH_REDIS_REST_URL: requireEnv("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: requireEnv("UPSTASH_REDIS_REST_TOKEN"),

  // OpenAI
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),

  // Diagnostics
  NODE_ENV: optionalEnv("NODE_ENV") ?? "development",
  VERCEL_ENV: optionalEnv("VERCEL_ENV"),

  // Observability / isolation
  RUNTIME_STAGE: runtimeStage,
    /**
   * WHY (M4):
   * Redis keys must be isolated per environment to prevent cross-contamination
   * between prod, preview deployments, and local dev.
   *
   * Output examples:
   * - "prod:stefans-mvp:"
   * - "preview:stefans-mvp:"
   * - "dev:stefans-mvp:"
   */
  REDIS_PREFIX: normalizeRedisPrefix(`${inferRedisStage()}:stefans-mvp:`),
});
