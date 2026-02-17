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

// If you truly want DIRECT_URL optional at runtime, change to optionalEnv()
// But given your stated contract (pooler + direct everywhere), keep it required.
function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

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

  // Upstash
  UPSTASH_REDIS_REST_URL: requireEnv("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: requireEnv("UPSTASH_REDIS_REST_TOKEN"),

  // OpenAI (server only)
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),

  // Optional (handy for diagnostics)
  NODE_ENV: optionalEnv("NODE_ENV") ?? "development",
});
