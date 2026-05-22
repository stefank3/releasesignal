// app/api/test-suites/export/route.ts
// M15 Generic Suite Export Layer:
// API endpoint for deterministic TestSuiteArtifact download.
//
// Supported:
// GET /api/test-suites/export?sessionId=<id>&format=json
// GET /api/test-suites/export?sessionId=<id>&format=csv
// GET /api/test-suites/export?sessionId=<id>&format=execution-csv
//
// Architecture rule:
// persisted SessionArtifact.testSuite
// -> deterministic export service
// -> downloadable JSON / CSV response.
//
// No AI calls.
// No prompt conversion.
// No artifact mutation.
// No /api/chat coupling.
// No native Qase/TestRail/Xray/Zephyr schema claims.
// No automation-report import/export compatibility claims.

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { recordChatMetric } from "@/lib/metrics/chatMetrics";
import { refreshArtifact } from "@/lib/chat/sessionStore";
import { exportTestSuiteArtifact } from "@/lib/server/export/testSuiteExportService";
import { requireAuthenticatedUser } from "@/lib/server/chat/requestGuards";
import { enforceRouteRateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildJsonError(args: {
  status: number;
  requestId: string;
  message: string;
}) {
  return NextResponse.json(
    {
      ok: false,
      requestId: args.requestId,
      error: args.message,
    },
    { status: args.status }
  );
}

function buildContentDisposition(filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `attachment; filename="${safeFilename}"`;
}

export async function GET(req: Request) {
  const requestId = randomUUID();
  const startTime = Date.now();

  const auth = await requireAuthenticatedUser({
    requestId,
    startTime,
    modeForMetric: "review",
    recordChatMetric,
  });

  if (!auth.ok) {
    return auth.response;
  }

  const rateLimit = await enforceRouteRateLimit({
    policy: "testSuiteExport",
    identifier: `user:${auth.auth0Sub}`,
    requestId,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const format = url.searchParams.get("format");

  if (!sessionId || !sessionId.trim()) {
    return buildJsonError({
      status: 400,
      requestId,
      message: "Missing sessionId for suite export.",
    });
  }

  const artifactState = await refreshArtifact({
    auth0Sub: auth.auth0Sub,
    sessionId: sessionId.trim(),
    fallback: null,
  });

  const result = exportTestSuiteArtifact({
    suite: artifactState.artifact?.testSuite,
    format,
  });

  if (!result.ok) {
    const status =
      result.reason === "unsupported_format"
        ? 400
        : result.reason === "missing_suite"
          ? 404
          : 400;

    return buildJsonError({
      status,
      requestId,
      message: result.message,
    });
  }

  return new Response(result.content, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": buildContentDisposition(result.filename),
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
