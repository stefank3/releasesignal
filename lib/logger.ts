// lib/logger.ts

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "chat_request"
  | "chat_completed"
  | "chat_replay_served"
  | "forbidden_review_access"
  | "rate_limit_exceeded"
  | "unauthorized"
  | "chat_error";

export type LogPayload = {
  requestId: string;
  event: LogEvent;

  userId?: string;
  mode?: string;

  latencyMs?: number;
  error?: string;

  // Keep meta small (avoid dumping payloads / PII)
  meta?: Record<string, unknown>;
};

export function log(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    ...payload,
  };

  // Emit JSON per line for structured logging in Vercel
  console[level](JSON.stringify(entry));
}
