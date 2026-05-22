// app/api/execution-evidence/route.ts
// M16 Execution Evidence Layer:
// API endpoint for deterministic structured execution-result import.
//
// Supported:
// POST /api/execution-evidence
//
// Architecture rule:
// persisted SessionArtifact.testSuite
// -> structured execution result input
// -> deterministic validation / normalization
// -> ExecutionIntelligenceArtifact
// -> persisted SessionArtifact.executionIntelligence
//
// No AI calls.
// No prompt conversion.
// No review-score changes.
// No release-readiness calculation.
// No /api/chat coupling.

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { refreshArtifact, persistArtifact } from "@/lib/chat/sessionStore";
import { recordChatMetric } from "@/lib/metrics/chatMetrics";
import { requireAuthenticatedUser } from "@/lib/server/chat/requestGuards";
import { buildExecutionEvidenceArtifact } from "@/lib/server/execution/executionEvidenceService";
import type { ExecutionEvidenceInput } from "@/lib/server/execution/executionEvidenceValidator";
import {
  buildExecutionEvidenceInputFromCsvUpload,
  readExecutionEvidenceImportRequest,
} from "@/lib/server/execution-upload";
import { enforceRouteRateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildJsonError(args: {
  status: number;
  requestId: string;
  message: string;
  details?: unknown;
}) {
  return NextResponse.json(
    {
      ok: false,
      requestId: args.requestId,
      error: args.message,
      ...(args.details ? { details: args.details } : {}),
    },
    { status: args.status }
  );
}

export async function POST(req: Request) {
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
    policy: "executionEvidence",
    identifier: `user:${auth.auth0Sub}`,
    requestId,
  });

  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const requestInput = await readExecutionEvidenceImportRequest(req);

  if (!requestInput.ok) {
    return buildJsonError({
      status: requestInput.status,
      requestId,
      message: requestInput.message,
    });
  }

  const artifactState = await refreshArtifact({
    auth0Sub: auth.auth0Sub,
    sessionId: requestInput.sessionId,
    fallback: null,
  });

  const currentArtifact = artifactState.artifact;

  if (!currentArtifact?.testSuite?.cases?.length) {
    return buildJsonError({
      status: 404,
      requestId,
      message:
        "Execution evidence requires an existing persisted test suite artifact.",
    });
  }

  let input: ExecutionEvidenceInput;

  if (requestInput.kind === "json") {
    input = requestInput.input;
  } else {
    const csvInput = buildExecutionEvidenceInputFromCsvUpload({
      sessionId: requestInput.sessionId,
      csvText: requestInput.csvText,
      suite: currentArtifact.testSuite,
    });

    if (!csvInput.ok) {
      return buildJsonError({
        status: 400,
        requestId,
        message: csvInput.message,
        details: {
          errors: csvInput.errors,
          warnings: csvInput.warnings,
        },
      });
    }

    input = csvInput.input;
  }

  const result = buildExecutionEvidenceArtifact({
    input,
    currentArtifact,
    suite: currentArtifact.testSuite,
  });

  if (!result.ok) {
    return buildJsonError({
      status: 400,
      requestId,
      message: result.message,
      details: {
        errors: result.errors,
        warnings: result.warnings,
      },
    });
  }

  const persisted = await persistArtifact({
    auth0Sub: auth.auth0Sub,
    sessionId: requestInput.sessionId,
    artifact: result.nextSessionArtifact,
  });

  if (!persisted) {
    return buildJsonError({
      status: 404,
      requestId,
      message:
        "Execution evidence could not be saved because the session was not found for the current user.",
    });
  }

  return NextResponse.json(
    {
      ok: true,
      requestId,
      message: result.message,
      executionIntelligence: result.artifact,
      warnings: result.warnings,
      artifactUpdatedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    }
  );
}
