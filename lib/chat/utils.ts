// lib/chat/utils.ts

import { Prisma } from "@prisma/client";

/**
 * Prisma helper:
 * If a request is retried with the same unique key, ChatMessage create() can throw P2002.
 * Treat as idempotent replay and continue.
 */
export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

export function responseHeaders(requestId: string, meta?: RateMeta, retryAfterSec?: number) {
  const headers: Record<string, string> = { "X-Request-Id": requestId };

  if (meta) {
    headers["X-RateLimit-Limit"] = String(meta.limit);
    headers["X-RateLimit-Remaining"] = String(meta.remaining);
    headers["X-RateLimit-Reset"] = String(meta.resetSeconds);
  }

  if (retryAfterSec && retryAfterSec > 0) headers["Retry-After"] = String(retryAfterSec);

  return headers;
}

// 1 credit per 1000 tokens (rounded up)
export function tokensToCredits(totalTokens: number) {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens / 1000));
}

/**
 * Extract first {...} JSON block from a mixed response.
 * Tolerates:
 * - prose around JSON
 * - ```json fenced JSON
 * - trailing explanations
 */
export function extractJsonObject(raw: string): string {
  const cleaned = stripCodeFences(raw).trim();

  const start = cleaned.indexOf("{");
  if (start < 0) return cleaned;

  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (depth === 0) return cleaned.slice(start, i + 1);
  }

  const end = cleaned.lastIndexOf("}");
  if (end > start) return cleaned.slice(start, end + 1);

  return cleaned;
}

function stripCodeFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return t;
}