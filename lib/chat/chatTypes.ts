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

/**
 * M14:
 * Narrow initial large-suite upload format support.
 * Keep this intentionally small to avoid ingestion-format sprawl.
 */
export type UploadedSuiteFormat = "txt" | "md" | "csv";

/**
 * M14:
 * Explicit uploaded-suite payload contract.
 * This keeps large-suite ingestion distinct from ordinary chat transport.
 *
 * Hard boundary:
 * uploaded suite content is input for parsing/review only.
 * It must not silently become authoritative requirement truth.
 */
export type UploadedSuitePayload = {
  filename: string;
  format: UploadedSuiteFormat;
  content: string;
};

/**
 * Main chat request body.
 *
 * M14 change:
 * Add an explicit uploadedSuite field so file-based ingestion does not need
 * to be tunneled through the freeform `message` field.
 *
 * `message` remains valid for normal chat/prompt flows.
 * `uploadedSuite` is optional and enables a separate typed ingestion path.
 */
export type ChatBody = {
  message?: string;
  mode?: ClientMode;
  sessionId?: string;
  title?: string;
  sessionClientId?: string; // IDP: prevents duplicate sessions during creation

  // M14: explicit large-suite upload payload for file-based ingestion flows.
  uploadedSuite?: UploadedSuitePayload;
};

export function normalizeClientMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}

export function normalizePersistedMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}