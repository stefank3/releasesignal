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
  DATABASE_URL: requireEnv("postgresql://postgres.dkvipfttlvldgzjkuygm:!E9sRP&Nk!!dxE3@aws-1-us-east-1.pooler.supabase.com:5432/postgres"),

  // Direct DB (migrations / maintenance)
  DIRECT_URL: requireEnv("postgresql://postgres:!E9sRP&Nk!!dxE3@db.dkvipfttlvldgzjkuygm.supabase.co:5432/postgres"),

  // Auth0
  AUTH0_DOMAIN: requireEnv("https://dev-bejn5bhf8q0zguqw.us.auth0.com"),
  AUTH0_CLIENT_ID: requireEnv("YmFNMxpAUOaK7fdM1A3AQOsH2iRcdLFb"),
  AUTH0_CLIENT_SECRET: requireEnv("4Pcm0gg_KgIY6cu5b37_B5TEEQuzO2LtJ41itYxk6bPlwA5fPXZ2mjUzFpmGWNbJ"),
  AUTH0_SECRET: requireEnv("0bf0888aec1fca829adf602aad060633c368e7e633e2d2e68e01cf7cba0800ae"),
  APP_BASE_URL: requireEnv("http://localhost:3000"),

  // Upstash
  UPSTASH_REDIS_REST_URL: requireEnv("https://cute-urchin-35895.upstash.io"),
  UPSTASH_REDIS_REST_TOKEN: requireEnv("AYw3AAIncDI3Zjc2MmEwNzJmYTM0NjFmODA1NDdjZDdjYWFmODYxMHAyMzU4OTU"),

  // OpenAI (server only)
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),

  // Optional (handy for diagnostics)
  NODE_ENV: optionalEnv("NODE_ENV") ?? "development",
});
