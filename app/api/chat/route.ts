// app/api/chat/route.ts
import { randomUUID } from "crypto";

import { log } from "@/lib/logger";

import { type CoachResult, type ReviewResult } from "@/lib/framework/reviewSchema";

import { recordChatMetric, type ChatMetricMode } from "@/lib/metrics/chatMetrics";

import {
  type RateMeta,
} from "@/lib/chat/chatTypes";

import {
  type SessionArtifact,
  type TestSuiteArtifact,
  isGuidedClarificationAnswer,
  parseGuidedAnswerToRefinedRequirement,
  mergeArtifact,
  getTestSuite,
} from "@/lib/chat/artifact";

import { loadOrCreateSession } from "@/lib/chat/sessionStore";
import {
  persistUserMessageIdempotent,
  persistAssistantWithBillingTx,
  InsufficientCreditsError,
} from "@/lib/chat/persist";

import {
  buildCoachContinuityArtifactPatch,
  coachToText,
  coachToTechnicalRequirementText,
  hasMeaningfulRefinedRequirement,
  shouldReturnTechnicalRequirement,
} from "@/lib/server/chat/coachFormatting";

import {
  mergeGeneratedCasesIntoSuite,
  renderTestSuiteForUser,
  withUpdatedTestSuiteArtifact,
} from "@/lib/server/chat/testSuiteService";

import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";
import { buildPromptPayload } from "@/lib/server/chat/promptBuilder";
import { parseCoachResponse, parseReviewResponse } from "@/lib/server/chat/modelResponseParser";
import { tryReplayExistingAssistant } from "@/lib/server/chat/replayService";
import {
  buildAuthExpiredResponse,
  buildChatSuccessResponse,
  buildInsufficientCreditsBillingResponse,
  buildReviewParseFailureResponse,
  buildReviewSuccessResponse,
  buildServerErrorResponse,
} from "@/lib/server/chat/responseBuilder";
import {
  ensureBillingPreconditions,
  enforceRateLimit,
  parseAndValidateChatRequest,
  requireAuthenticatedUser,
  requireReviewAccess,
} from "@/lib/server/chat/requestGuards";
import { openai, withOpenAITrace, getOpenAITraceFromError } from "@/lib/openai";
import { tokensToCredits, estimateCostUsd, maybeConvertUsdToEur } from "@/lib/chat/costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CHANGE (M8.7):
 * Explicit user escape hatch for "start fresh" behavior.
 * This is used for Strategy continuity and Test Design continuity.
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
    // 0) Auth
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

    // 1) Parse + validate input
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

    // M7.4: guided clarification answer heuristic
    const guidedAnswer =
      executionMode === "coach" && !wantCases && isGuidedClarificationAnswer(message);

    // 2) Review RBAC
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

    // 3) Billing preconditions
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

    // 4) Rate limit
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

    // 5) Create/reuse session + hydrate artifact
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

    // 6) Replay
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

    // 7) Persist user message
    await persistUserMessageIdempotent({
      sessionId,
      auth0Sub,
      requestId,
      content: message,
    });

    // 8) Guided clarification answer -> update artifact now
    if (guidedAnswer) {
      const patch = parseGuidedAnswerToRefinedRequirement(message);
      if (patch) {
        const nextArtifact = mergeArtifact(sessionArtifact, patch);

        const saved = await saveSessionArtifact({
          sessionId,
          artifact: nextArtifact,
        });

        sessionArtifact = saved.artifact;
        artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
      }
    }

    // 9) Prompts
    const {
      messagesForModel,
      existingCasesCount,
      nextAvailableCaseNumber,
    } = buildPromptPayload({
      message,
      weakInput,
      guidedAnswer,
      wantCases,
      executionMode,
      explicitRegenerationRequest,
      sessionArtifact,
    });

    // 10) OpenAI call
    const model = "gpt-4.1-mini";
    openaiModel = model;

    const { result: completion, trace } = await withOpenAITrace(
      () =>
        openai.chat.completions.create({
          model,
          temperature: wantCases ? 0.2 : 0,
          max_tokens: executionMode === "review" ? 650 : wantCases ? 1400 : 900,
          response_format: wantCases ? undefined : { type: "json_object" },
          messages: messagesForModel,
        }),
      model
    );

    openaiLatencyMs = trace.latencyMs;

    const rawReply = completion.choices[0]?.message?.content ?? "No reply returned";

    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens =
      completion.usage?.total_tokens ?? promptTokens + completionTokens;

    const usage = {
      promptTokens,
      completionTokens,
      totalTokens,
    };

    const creditsCharged = tokensToCredits(totalTokens);

    const costUsd = estimateCostUsd({ model, promptTokens, completionTokens });
    const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

    // 11) Parse/repair outputs
    let coachParsed: CoachResult | null = null;
    let replyTextForUser: string | null = null;

    let reviewObj: ReviewResult | null = null;
    let reviewStoredJson: string | null = null;
    let reviewRepaired = false;

    let nextTestSuiteArtifact: TestSuiteArtifact | null = null;
    let testSuiteAddedCount = 0;

    if (executionMode === "review") {
      const parsedReview = await parseReviewResponse(rawReply);
      reviewObj = parsedReview.reviewObj;
      reviewStoredJson = parsedReview.reviewStoredJson;
      reviewRepaired = parsedReview.repaired;
    }

    if (executionMode === "coach" && !wantCases) {
      coachParsed = await parseCoachResponse(rawReply);

      if (coachParsed) {
        coachParsed.optionalClarifications =
          coachParsed.optionalClarifications?.slice(0, 3) ?? [];

        if (!explicitRegenerationRequest) {
          const continuityPatch = buildCoachContinuityArtifactPatch({
            existingArtifact: sessionArtifact,
            coach: coachParsed,
            latestUserMessage: message,
            guidedAnswer,
            weakInput,
          });

          if (continuityPatch) {
            const nextArtifact = mergeArtifact(sessionArtifact, continuityPatch);

            const saved = await saveSessionArtifact({
              sessionId,
              artifact: nextArtifact,
            });

            sessionArtifact = saved.artifact;
            artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
          }
        }

        const effectiveArtifactForReply = explicitRegenerationRequest
          ? null
          : sessionArtifact;

        if (
          shouldReturnTechnicalRequirement({
            guidedAnswer,
            artifact: effectiveArtifactForReply,
          })
        ) {
          replyTextForUser = coachToTechnicalRequirementText(
            coachParsed,
            effectiveArtifactForReply
          );
        } else {
          replyTextForUser = coachToText(coachParsed);
        }
      } else {
        replyTextForUser =
          "I couldn't format the coach output this time. Please retry, or add a bit more context (workflow + expected behavior + edge cases).";
      }
    }

    if (wantCases) {
      const existingSuiteForMerge = explicitRegenerationRequest
        ? null
        : getTestSuite(sessionArtifact);

      const merged = mergeGeneratedCasesIntoSuite({
        existingSuite: existingSuiteForMerge,
        generatedText: rawReply.trim(),
        explicitReset: explicitRegenerationRequest,
      });

      nextTestSuiteArtifact = merged.nextSuite;
      testSuiteAddedCount = merged.addedCount;

      if (nextTestSuiteArtifact) {
        replyTextForUser = renderTestSuiteForUser(nextTestSuiteArtifact);
      } else {
        replyTextForUser = rawReply.trim();
      }

      coachParsed = null;
    }

    const assistantContentToStore =
      executionMode === "review"
        ? reviewStoredJson ?? rawReply
        : replyTextForUser ?? "No reply returned";

    // 12) Billing + assistant persistence
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

    if (wantCases && nextTestSuiteArtifact) {
      const nextArtifact = withUpdatedTestSuiteArtifact(sessionArtifact, nextTestSuiteArtifact);

      const saved = await saveSessionArtifact({
        sessionId,
        artifact: nextArtifact,
      });

      sessionArtifact = saved.artifact;
      artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
    }

    // 13) Responses
    if (executionMode === "review") {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      if (!reviewObj) {
        return buildReviewParseFailureResponse({
          requestId,
          clientMode,
          rawReply,
          sessionId,
          creditsCharged,
          creditsRemaining,
          usage,
          rateMeta,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

      return buildReviewSuccessResponse({
        requestId,
        clientMode,
        review: reviewObj,
        sessionId,
        creditsCharged,
        creditsRemaining,
        usage,
        rateMeta,
        repaired: reviewRepaired || undefined,
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
      model,
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
        existingCasesCount,
        nextAvailableCaseNumber,
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
      /access token has expired|refresh token was not provided|re-authenticate/i.test(errMsg);

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