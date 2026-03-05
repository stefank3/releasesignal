// lib/chat/http.ts
import { NextResponse } from "next/server";
import type { RateMeta, ClientMode } from "./chatTypes";
import { normalizePersistedMode } from "./chatTypes";

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

export function sessionModeMismatchResponse(args: {
  requestId: string;
  rateMeta: RateMeta | null;
  sessionMode: unknown;
  requestedMode: ClientMode;
}) {
  const sessionMode = normalizePersistedMode(args.sessionMode);

  return NextResponse.json(
    { ok: false, error: "SESSION_MODE_MISMATCH", sessionMode, requestedMode: args.requestedMode },
    { status: 409, headers: responseHeaders(args.requestId, args.rateMeta ?? undefined) }
  );
}