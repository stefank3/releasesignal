import "server-only";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export function getRequestId(req: Request): string {
  const inbound = req.headers.get("x-request-id")?.trim();
  return inbound && inbound.length < 200 ? inbound : randomUUID();
}

export function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

export function buildInternalServerErrorResponse(args: {
  requestId: string;
  headers?: Record<string, string>;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: "Internal server error",
      reason: "server_error",
      requestId: args.requestId,
    },
    {
      status: 500,
      headers: {
        ...requestIdHeaders(args.requestId),
        ...(args.headers ?? {}),
      },
    }
  );
}
