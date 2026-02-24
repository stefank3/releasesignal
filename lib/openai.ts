// lib/openai.ts
import "server-only";

import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * Central OpenAI client (server-only).
 */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * WHY (M4-B):
 * We need a tiny, deterministic wrapper to capture:
 * - model
 * - latencyMs
 * - retryCount (we do not retry here; remains 0)
 * - errorCode (if thrown)
 *
 * This adds observability without changing request/response logic.
 */
export type OpenAITrace = {
  model: string;
  latencyMs: number;
  retryCount: number; // IMPORTANT: no retries implemented here
  errorCode?: string;
};

/**
 * Internal marker we attach to thrown errors so the API layer can log trace info.
 */
type OpenAITraceError = Error & { __openaiTrace?: OpenAITrace };

/**
 * Wrap a single OpenAI call and return both result + trace.
 * - No retries (preserves deterministic behavior)
 * - No prompt/content logging (PII-safe)
 */
export async function withOpenAITrace<T>(
  fn: () => Promise<T>,
  model: string
): Promise<{ result: T; trace: OpenAITrace }> {
  const start = Date.now();

  try {
    const result = await fn();
    return {
      result,
      trace: {
        model,
        latencyMs: Date.now() - start,
        retryCount: 0,
      },
    };
  } catch (e: unknown) {
    const latencyMs = Date.now() - start;
    const errorCode = extractOpenAIErrorCode(e);

    // WHY: bubble trace up without changing the original failure path semantics
    const err: OpenAITraceError =
      e instanceof Error ? (e as OpenAITraceError) : (new Error(String(e)) as OpenAITraceError);

    err.__openaiTrace = {
      model,
      latencyMs,
      retryCount: 0,
      ...(errorCode ? { errorCode } : {}),
    };

    throw err;
  }
}

/**
 * Read trace back out of a thrown error (if it came from withOpenAITrace).
 */
export function getOpenAITraceFromError(e: unknown): OpenAITrace | null {
  if (e && typeof e === "object" && "__openaiTrace" in e) {
    const t = (e as OpenAITraceError).__openaiTrace;
    if (t && typeof t === "object") return t;
  }
  return null;
}

/**
 * Extract an OpenAI-ish error code safely.
 * We avoid depending on a specific SDK error class to keep upgrades painless.
 */
function extractOpenAIErrorCode(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;

  const record = e as Record<string, unknown>;

  // Direct code
  if (typeof record.code === "string") {
    return record.code;
  }

  // Nested error.code
  if (
    typeof record.error === "object" &&
    record.error !== null
  ) {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.code === "string") {
      return nested.code;
    }
  }

  // Fallback: status number → string
  if (typeof record.status === "number") {
    return String(record.status);
  }

  return undefined;
}