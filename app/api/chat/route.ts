// app/api/chat/route.ts
import { randomUUID } from "crypto";

import { log } from "@/lib/logger";

import { type CoachResult, type ReviewResult } from "@/lib/framework/reviewSchema";

import { recordChatMetric, type ChatMetricMode } from "@/lib/metrics/chatMetrics";

import { type RateMeta } from "@/lib/chat/chatTypes";

import {
  type SessionArtifact,
  type TestSuiteArtifact,
  getTestSuite,
  isGuidedClarificationAnswer,
} from "@/lib/chat/artifact";

import { loadOrCreateSession } from "@/lib/chat/sessionStore";
import {
  persistUserMessageIdempotent,
  persistAssistantWithBillingTx,
  InsufficientCreditsError,
} from "@/lib/chat/persist";

import { hasMeaningfulRefinedRequirement } from "@/lib/server/chat/coachFormatting";

import { buildPromptPayload } from "@/lib/server/chat/promptBuilder";
import { tryReplayExistingAssistant } from "@/lib/server/chat/replayService";

import {
  buildAuthExpiredResponse,
  buildChatSuccessResponse,
  buildInsufficientCreditsBillingResponse,
  buildServerErrorResponse,
} from "@/lib/server/chat/responseBuilder";

import {
  ensureBillingPreconditions,
  enforceRateLimit,
  parseAndValidateChatRequest,
  requireAuthenticatedUser,
  requireReviewAccess,
} from "@/lib/server/chat/requestGuards";

import { executeChatCompletion } from "@/lib/server/chat/openaiService";
import { getOpenAITraceFromError } from "@/lib/openai";
import {
  applyGuidedArtifactPatch,
  persistGeneratedSuiteArtifact,
} from "@/lib/server/chat/artifactUpdateService";
import { runPostModelFlow } from "@/lib/server/chat/postModelFlowService";
import { buildReviewFlowResponse } from "@/lib/server/chat/reviewFlowService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CHANGE (M8.7):
 * Explicit user escape hatch for "start fresh" behavior.
 */
function isExplicitRegenerationRequest(message: string): boolean {
  return /\b(regenerate|restart|start over|from scratch|fresh start|ignore previous|ignore the previous|discard previous|replace the suite|new suite)\b/i.test(
    message
  );
}

export async function POST(req: Request) {
  const inbound = req.headers.get("x-request-id");
  const requestId = inbound && inbound.length < 200 ? inbound : randomUUID();
  const startTime = Date.now();

  let auth0SubForLog: string | undefined;
  let orgId: string | undefined;
  let sessionIdForLog: string | undefined;

  let modeForMetric: ChatMetricMode = "unknown";
  let rateMeta: RateMeta | null = null;

  let sessionArtifact: SessionArtifact | null = null;
  let artifactUpdatedAtIso: string | null = null;

  let openaiModel: string | undefined;
  let openaiLatencyMs: number | undefined;
  let openaiErrorCode: string | undefined;

  const retryCount = 0;

  try {
    /*
    ---------------------------------------------------------
    AUTHENTICATION
    ---------------------------------------------------------
    */
    const authResult = await requireAuthenticatedUser({
      requestId,
      startTime,
      modeForMetric,
      recordChatMetric,
    });

    if (!authResult.ok) {
      return authResult.response;
    }

    const user = authResult.user;
    const auth0Sub = authResult.auth0Sub;
    auth0SubForLog = auth0Sub;

    const identifier = `user:${auth0Sub}`;

    /*
    ---------------------------------------------------------
    REQUEST VALIDATION
    ---------------------------------------------------------
    */
    const parsedRequest = await parseAndValidateChatRequest({
      req,
      requestId,
      startTime,
      modeForMetric,
      recordChatMetric,
      isExplicitRegenerationRequest,
    });

    if (!parsedRequest.ok) {
      return parsedRequest.response;
    }

    const {
      body,
      message,
      clientMode,
      wantCases,
      executionMode,
      weakInput,
      explicitRegenerationRequest,
    } = parsedRequest;

    modeForMetric = clientMode;

    const guidedAnswer =
      executionMode === "coach" &&
      !wantCases &&
      isGuidedClarificationAnswer(message);

    /*
    ---------------------------------------------------------
    RBAC
    ---------------------------------------------------------
    */
    const accessResult = await requireReviewAccess({
      executionMode,
      requestId,
      auth0Sub,
      clientMode,
      startTime,
      recordChatMetric,
    });

    if (!accessResult.ok) {
      return accessResult.response;
    }

    /*
    ---------------------------------------------------------
    BILLING PRECHECK
    ---------------------------------------------------------
    */
    const billingResult = await ensureBillingPreconditions({
      auth0Sub,
      user,
      requestId,
      clientMode,
      startTime,
      recordChatMetric,
    });

    if (!billingResult.ok) {
      return billingResult.response;
    }

    orgId = billingResult.orgId;
    const orgState = billingResult.orgState;

    /*
    ---------------------------------------------------------
    RATE LIMIT
    ---------------------------------------------------------
    */
    const rateLimitResult = await enforceRateLimit({
      identifier,
      requestId,
      auth0Sub,
      orgId,
      clientMode,
      startTime,
      recordChatMetric,
    });

    rateMeta = rateLimitResult.rateMeta;

    if (!rateLimitResult.ok) {
      return rateLimitResult.response;
    }

    /*
    ---------------------------------------------------------
    SESSION LOAD
    ---------------------------------------------------------
    */
    const sessionState = await loadOrCreateSession({
      auth0Sub,
      requestId,
      body,
      clientMode,
      rateMeta,
    });

    if (!sessionState.ok) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 409,
        latencyMs: Date.now() - startTime,
      });

      return sessionState.response;
    }

    const sessionId = sessionState.sessionId;
    sessionIdForLog = sessionId;

    sessionArtifact = sessionState.sessionArtifact;
    artifactUpdatedAtIso = sessionState.artifactUpdatedAtIso;

    log("info", {
      event: "chat_start",
      requestId,
      auth0Sub,
      orgId,
      sessionId,
      mode: clientMode,
      meta: {
        messageChars: message.length,
        weakInput,
        clientMode,
        guidedAnswer,
        explicitRegenerationRequest,
        hasArtifact: !!sessionArtifact,
        hasTestSuite: !!getTestSuite(sessionArtifact),
      },
    });

    /*
    ---------------------------------------------------------
    REPLAY
    ---------------------------------------------------------
    */
    const replay = await tryReplayExistingAssistant({
      auth0Sub,
      sessionId,
      requestId,
      clientMode,
      executionMode,
      rateMeta,
      sessionArtifact,
      artifactUpdatedAtIso,
    });

    sessionArtifact = replay.sessionArtifact;
    artifactUpdatedAtIso = replay.artifactUpdatedAtIso;

    if (replay.hit) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      return replay.response;
    }

    /*
    ---------------------------------------------------------
    PERSIST USER MESSAGE
    ---------------------------------------------------------
    */
    await persistUserMessageIdempotent({
      sessionId,
      auth0Sub,
      requestId,
      content: message,
    });

    /*
    ---------------------------------------------------------
    GUIDED ARTIFACT PATCH
    ---------------------------------------------------------
    SURGICAL CHANGE (M10 Pass 11):
    Guided-answer artifact patching now lives in artifactUpdateService.ts.
    */
    const guidedArtifactResult = await applyGuidedArtifactPatch({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      message,
      guidedAnswer,
    });

    sessionArtifact = guidedArtifactResult.sessionArtifact;
    artifactUpdatedAtIso = guidedArtifactResult.artifactUpdatedAtIso;

    /*
    ---------------------------------------------------------
    PROMPT BUILD
    ---------------------------------------------------------
    */
    const { messagesForModel } = buildPromptPayload({
      message,
      weakInput,
      guidedAnswer,
      wantCases,
      executionMode,
      explicitRegenerationRequest,
      sessionArtifact,
    });

    /*
    ---------------------------------------------------------
    OPENAI EXECUTION
    ---------------------------------------------------------
    */
    const completionResult = await executeChatCompletion({
      messagesForModel,
      executionMode,
      wantCases,
    });

    const rawReply = completionResult.rawReply;

    const promptTokens = completionResult.promptTokens;
    const completionTokens = completionResult.completionTokens;
    const totalTokens = completionResult.totalTokens;

    const usage = {
      promptTokens,
      completionTokens,
      totalTokens,
    };

    const creditsCharged = completionResult.creditsCharged;

    const costUsd = completionResult.costUsd;
    const costEur = completionResult.costEur;

    openaiModel = completionResult.model;
    openaiLatencyMs = completionResult.openaiLatencyMs;

    /*
    ---------------------------------------------------------
    POST-MODEL FLOW ORCHESTRATION
    ---------------------------------------------------------
    SURGICAL CHANGE (M10 Pass 11):
    route.ts no longer coordinates review / coach / cases branches inline.
    */
    const postModel = await runPostModelFlow({
      rawReply,
      executionMode,
      wantCases,
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      message,
      guidedAnswer,
      weakInput,
      explicitRegenerationRequest,
    });

    let coachParsed: CoachResult | null = postModel.coachParsed;
    let replyTextForUser: string | null = postModel.replyTextForUser;

    let reviewObj: ReviewResult | null = postModel.reviewObj;
    let reviewRepaired = postModel.reviewRepaired;

    let assistantContentToStore = postModel.assistantContentToStore;

    let nextTestSuiteArtifact: TestSuiteArtifact | null =
      postModel.nextTestSuiteArtifact;
    const testSuiteAddedCount = postModel.testSuiteAddedCount;

    sessionArtifact = postModel.sessionArtifact;
    artifactUpdatedAtIso = postModel.artifactUpdatedAtIso;

    /*
    ---------------------------------------------------------
    BILLING TRANSACTION
    ---------------------------------------------------------
    */
    let creditsRemaining: number | null = null;

    try {
      creditsRemaining = await persistAssistantWithBillingTx({
        sessionId,
        auth0Sub,
        requestId,
        creditsCharged,
        assistantContentToStore,
        promptTokens,
        completionTokens,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 402,
          latencyMs: Date.now() - startTime,
        });

        return buildInsufficientCreditsBillingResponse({
          requestId,
          clientMode,
          sessionId,
          creditsCharged,
          creditsRemaining: orgState.wallet?.balance ?? 0,
          usage,
          rateMeta,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

      throw e;
    }

    /*
    ---------------------------------------------------------
    SUITE ARTIFACT PERSIST
    ---------------------------------------------------------
    SURGICAL CHANGE (M10 Pass 11):
    Cases suite persistence now lives in artifactUpdateService.ts.
    */
    const suitePersistResult = await persistGeneratedSuiteArtifact({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      nextTestSuiteArtifact,
    });

    sessionArtifact = suitePersistResult.sessionArtifact;
    artifactUpdatedAtIso = suitePersistResult.artifactUpdatedAtIso;

    /*
    ---------------------------------------------------------
    RESPONSES
    ---------------------------------------------------------
    */
    if (executionMode === "review") {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      return buildReviewFlowResponse({
        requestId,
        clientMode,
        rawReply,
        sessionId,
        creditsCharged,
        creditsRemaining,
        usage,
        rateMeta,
        reviewObj,
        reviewRepaired,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      });
    }

    await recordChatMetric({
      nowMs: Date.now(),
      mode: modeForMetric,
      status: 200,
      latencyMs: Date.now() - startTime,
    });

    log("info", {
      event: "chat_completed",
      requestId,
      auth0Sub,
      orgId,
      sessionId,
      mode: clientMode,
      durationMs: Date.now() - startTime,
      model: openaiModel,
      openaiLatencyMs,
      retryCount,
      meta: {
        promptTokens,
        completionTokens,
        totalTokens,
        creditsCharged,
        creditsRemaining,
        costUsd,
        costEur,
        explicitRegenerationRequest,
        testSuiteAddedCount,
        hasArtifact: hasMeaningfulRefinedRequirement(sessionArtifact),
        hasTestSuite: !!getTestSuite(sessionArtifact),
      },
    });

    return buildChatSuccessResponse({
      requestId,
      clientMode,
      reply: replyTextForUser ?? "No reply returned",
      coach: coachParsed,
      sessionId,
      creditsCharged,
      creditsRemaining,
      usage,
      rateMeta,
      artifact: sessionArtifact,
      artifactUpdatedAt: artifactUpdatedAtIso,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Unknown server error";

    const t = getOpenAITraceFromError(e);

    if (t) {
      openaiLatencyMs = t.latencyMs;
      openaiErrorCode = t.errorCode;
      openaiModel = t.model;
    }

    const isAuthExpired =
      /access token has expired|refresh token was not provided/i.test(errMsg);

    log("error", {
      event: "chat_error",
      requestId,
      auth0Sub: auth0SubForLog,
      orgId,
      sessionId: sessionIdForLog,
      mode:
        modeForMetric === "coach" ||
        modeForMetric === "review" ||
        modeForMetric === "cases"
          ? modeForMetric
          : undefined,
      durationMs: Date.now() - startTime,
      model: openaiModel,
      openaiLatencyMs,
      openaiErrorCode,
      retryCount,
      errorType: isAuthExpired ? "auth_expired" : "chat_error",
      errorMessage: errMsg,
    });

    await recordChatMetric({
      nowMs: Date.now(),
      mode: modeForMetric,
      status: isAuthExpired ? 401 : 500,
      latencyMs: Date.now() - startTime,
    });

    if (isAuthExpired) {
      return buildAuthExpiredResponse({
        requestId,
        rateMeta,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      });
    }

    return buildServerErrorResponse({
      requestId,
      errorMessage: errMsg,
      rateMeta,
      artifact: sessionArtifact,
      artifactUpdatedAt: artifactUpdatedAtIso,
    });
  }
}