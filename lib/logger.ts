// lib/logger.ts
import "server-only";

export type LogLevel = "info" | "warn" | "error";

/**
 * WHY (M4-B):
 * Keep event taxonomy explicit (union), so TypeScript prevents typos
 * and you can reliably filter logs in Vercel.
 */
export type LogEvent =
  // Chat lifecycle
  | "chat_start"
  | "chat_replay_served"
  | "chat_completed"
  | "chat_error"
  | "unauthorized"
  | "forbidden_review_access"
  | "rate_limit_exceeded"
  // OpenAI
  | "openai_call"
  | "openai_error"
  // Billing (admin)
  | "billing_overview_start"
  | "billing_overview_error"
  | "billing_topup_start"
  | "billing_topup_error"
  // Billing (chat usage)
  | "billing_charge_success"
  | "billing_failure"
  // Metrics/admin
  | "admin_metrics_error";

export type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
};

/**
 * WHY (M4-B):
 * Standard fields are top-level (fast to filter).
 * 'meta' stays small and optional for rare extra context.
 */
export type LogPayload = {
  event: LogEvent;
  requestId: string;

  // Correlation
  auth0Sub?: string;
  orgId?: string;
  sessionId?: string;
  mode?: "coach" | "review";

  // Timing / outcome
  durationMs?: number;
  statusCode?: number;

  // OpenAI trace (no prompts/content)
  model?: string;
  openaiLatencyMs?: number;
  openaiErrorCode?: string;
  retryCount?: number;

  // Usage/cost (internal only; not used for billing)
  tokenUsage?: TokenUsage;
  eurCost?: number;
  reviewUnits?: number;

  // Error shape (consistent)
  errorType?: string;
  errorMessage?: string;

  // Extra (keep tiny; never dump PII or full payloads)
  meta?: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

function parseNumberEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * WHY (M4-B):
 * - warn/error: always emit (debuggability)
 * - info: emit in dev, and sampled in prod to avoid log flooding
 *
 * Controls:
 * - ENABLE_VERBOSE_LOGS=true   -> emits all info logs in prod
 * - LOG_INFO_SAMPLE_RATE=0.10 -> emits ~10% info logs in prod (default 0.20)
 */
function shouldEmit(level: LogLevel): boolean {
  if (level === "warn" || level === "error") return true;

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return true;

  if (process.env.ENABLE_VERBOSE_LOGS === "true") return true;

  const rate = parseNumberEnv("LOG_INFO_SAMPLE_RATE", 0.2);
  if (rate >= 1) return true;
  if (rate <= 0) return false;

  return Math.random() < rate;
}

export function log(level: LogLevel, payload: LogPayload) {
  if (!shouldEmit(level)) return;

  const entry = {
    level,
    ts: nowIso(),
    ...payload,
  };

  // Emit JSON per line (Vercel structured logs)
  console[level](JSON.stringify(entry));
}