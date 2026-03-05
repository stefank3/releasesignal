// lib/chat/modes.ts
import { NextResponse } from "next/server";
import type { ClientMode, RateMeta } from "./types";
import { responseHeaders } from "./http";

export function normalizeClientMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}

export function normalizePersistedMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}

export function sessionModeMismatchResponse(args: {
  requestId: string;
  rateMeta: RateMeta | null;
  sessionMode: unknown;
  requestedMode: ClientMode;
}) {
  const sessionMode = normalizePersistedMode(args.sessionMode);

  return NextResponse.json(
    {
      ok: false,
      error: "SESSION_MODE_MISMATCH",
      sessionMode,
      requestedMode: args.requestedMode,
    },
    { status: 409, headers: responseHeaders(args.requestId, args.rateMeta ?? undefined) }
  );
}