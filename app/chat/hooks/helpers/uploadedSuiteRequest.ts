// app/chat/hooks/helpers/uploadedSuiteRequest.ts
// M14:
// Client-side helper for uploaded suite request shaping.
// This file is intentionally narrow and does NOT own chat/session orchestration.
// It only:
// - validates supported upload formats
// - builds uploadedSuite request payloads
// - builds compact upload marker text for optimistic UI / history rendering
// - falls back to normal message payloads for standard chat sends

export type UploadedSuiteClientFormat = "txt" | "md" | "csv";

export type PendingUploadedSuite = {
  filename: string;
  content: string;
  format: UploadedSuiteClientFormat;
};

export type StandardChatRequestBody = {
  message: string;
  mode: "coach" | "review" | "cases";
  sessionId?: string;
  sessionClientId?: string;
};

export type UploadedSuiteChatRequestBody = {
  mode: "coach" | "review" | "cases";
  sessionId?: string;
  sessionClientId?: string;
  uploadedSuite: {
    filename: string;
    format: UploadedSuiteClientFormat;
    content: string;
  };
};

export type ChatSendRequestBody =
  | StandardChatRequestBody
  | UploadedSuiteChatRequestBody;

/**
 * M14:
 * Keep initial upload support intentionally narrow.
 * Do not broaden beyond locked formats here.
 */
export function getUploadedSuiteFormatFromFilename(
  filename: string
): UploadedSuiteClientFormat | null {
  const normalized = String(filename ?? "").trim().toLowerCase();

  if (normalized.endsWith(".txt")) return "txt";
  if (normalized.endsWith(".md")) return "md";
  if (normalized.endsWith(".csv")) return "csv";

  return null;
}

/**
 * M14:
 * Normalize upload content before it leaves the client.
 * This is basic hygiene only, not parsing or truth creation.
 */
export function normalizeUploadedSuiteContent(content: string): string {
  return String(content ?? "").replace(/\r/g, "").trim();
}

/**
 * M14:
 * Build a safe pending upload object from raw client file data.
 * Returns null when the file is unsupported or empty.
 */
export function buildPendingUploadedSuite(args: {
  filename: string;
  content: string;
}): PendingUploadedSuite | null {
  const filename = String(args.filename ?? "").trim();
  const format = getUploadedSuiteFormatFromFilename(filename);
  const content = normalizeUploadedSuiteContent(args.content);

  if (!filename || !format || !content) {
    return null;
  }

  return {
    filename,
    format,
    content,
  };
}

/**
 * M14:
 * Never show the raw uploaded suite body as the optimistic user chat message.
 * Use a compact marker instead.
 */
export function buildUploadedSuiteMarkerMessage(
  uploadedSuite: PendingUploadedSuite
): string {
  return [
    `Uploaded test suite file: ${uploadedSuite.filename}`,
    `Format: ${uploadedSuite.format}`,
    "Purpose: file-based large suite ingestion",
  ].join("\n");
}

/**
 * Build the request body for a normal send or an uploaded-suite send.
 * Ordinary chat remains message-driven.
 * Uploaded suites travel through the explicit uploadedSuite contract.
 */
export function buildChatSendRequestBody(args: {
  text: string;
  mode: "coach" | "review" | "cases";
  sessionId?: string;
  sessionClientId?: string;
  pendingUploadedSuite?: PendingUploadedSuite | null;
}): ChatSendRequestBody {
  const {
    text,
    mode,
    sessionId,
    sessionClientId,
    pendingUploadedSuite,
  } = args;

  if (pendingUploadedSuite) {
    return {
      mode,
      ...(sessionId ? { sessionId } : {}),
      ...(sessionClientId ? { sessionClientId } : {}),
      uploadedSuite: {
        filename: pendingUploadedSuite.filename,
        format: pendingUploadedSuite.format,
        content: pendingUploadedSuite.content,
      },
    };
  }

  return {
    message: text,
    mode,
    ...(sessionId ? { sessionId } : {}),
    ...(sessionClientId ? { sessionClientId } : {}),
  };
}