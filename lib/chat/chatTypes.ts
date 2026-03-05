// lib/chat/chatTypes.ts
export type ExecutionMode = "coach" | "review";

/**
 * Session UX modes (persisted for cohesion + history rendering).
 * Session mode must be stable so users don't mix outputs across one thread.
 */
export type ClientMode = "coach" | "review" | "cases";

export type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

export type ChatBody = {
  message?: string;
  mode?: ClientMode;
  sessionId?: string;
  title?: string;
  sessionClientId?: string; // IDP: prevents duplicate sessions during creation
};

export function normalizeClientMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}

export function normalizePersistedMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}