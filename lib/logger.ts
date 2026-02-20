// lib/logger.ts

export type LogLevel = "info" | "warn" | "error";

/**
 * WHY:
 * We keep your existing event taxonomy,
 * but add new structured events required for M4 observability.
 */
export type LogEvent =
  | "chat_start"
  | "chat_completed"
  | "chat_error"
  | "chat_replay_served"
  | "forbidden_review_access"
  | "rate_limit_exceeded"
  | "unauthorized"
  | "billing_failure"
  | "billing_overview_error"
  | "billing_topup_error"
  | "openai_call";

/**
 * WHY:
 * Standardized observability shape.
 * All chat requests MUST log start + end (success or failure).
 *
 * Keep fields flat for Vercel log filtering.
 */
export type LogPayload = {
  requestId: string;
  event: LogEvent;

  // Identity
  auth0Sub?: string;
  orgId?: string;
  sessionId?: string;

  // Execution context
  mode?: "coach" | "review";
  durationMs?: number;

  // OpenAI tracing
  model?: string;
  openaiLatencyMs?: number;
  openaiErrorCode?: string;
  retryCount?: number;

  // Billing tracing
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  eurCost?: number;
  reviewUnits?: number;

  walletBalance?: number;

  // Error classification
  errorType?: string;
  errorMessage?: string;

  // Optional lightweight metadata (never raw prompts or PII)
  meta?: Record<string, unknown>;
};

/**
 * WHY:
 * Every log line is one JSON object.
 * Vercel parses this cleanly.
 * No multi-line logs.
 */
export function log(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    ...payload,
  };

  console[level](JSON.stringify(entry));
}