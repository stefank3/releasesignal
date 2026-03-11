// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

import { QA_SYSTEM_PROMPT, CASES_SYSTEM_PROMPT } from "@/lib/framework/systemPrompt";
import {
  isCoachResult,
  isReviewResult,
  type CoachResult,
  type ReviewResult,
} from "@/lib/framework/reviewSchema";

import { isAdminFromAccessToken } from "@/lib/auth/rbac";
import { recordChatMetric, type ChatMetricMode } from "@/lib/metrics/chatMetrics";

import { ensureOrgForUser } from "@/lib/billing/ensureOrgForUser";

import { openai, withOpenAITrace, getOpenAITraceFromError } from "@/lib/openai";
import { chatRatelimit, CHAT_RATE_LIMIT } from "@/lib/ratelimit";

import {
  normalizeClientMode,
  type ChatBody,
  type ClientMode,
  type ExecutionMode,
  type RateMeta,
} from "@/lib/chat/chatTypes";
import { responseHeaders } from "@/lib/chat/http";
import { extractJsonObject } from "@/lib/chat/json";
import { isWeakInput } from "@/lib/chat/inputQuality";
import { tokensToCredits, estimateCostUsd, maybeConvertUsdToEur } from "@/lib/chat/costs";

import {
  type SessionArtifact,
  type TestSuiteArtifact,
  isGuidedClarificationAnswer,
  parseGuidedAnswerToRefinedRequirement,
  mergeArtifact,
  artifactToContextText,
  getTestSuite,
} from "@/lib/chat/artifact";

import { repairJsonOnce } from "@/lib/chat/repair";
import { loadOrCreateSession, refreshArtifact } from "@/lib/chat/sessionStore";
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
  buildExistingSuiteBaselineFromArtifact,
  mergeGeneratedCasesIntoSuite,
  renderTestSuiteForUser,
  withUpdatedTestSuiteArtifact,
} from "@/lib/server/chat/testSuiteService";

import { saveSessionArtifact } from "@/lib/server/chat/artifactPersistence";

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
    // 0) Require Auth0 session
    const session = await auth0.getSession();
    if (!session?.user) {
      log("warn", {
        event: "unauthorized",
        requestId,
        errorType: "unauthorized",
        errorMessage: "Missing Auth0 session",
        durationMs: Date.now() - startTime,
        meta: { path: "/api/chat" },
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 401,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: responseHeaders(requestId) }
      );
    }

    const user = session.user;
    const sub = user.sub as string | undefined;
    if (!sub) {
      log("warn", {
        event: "unauthorized",
        requestId,
        errorType: "unauthorized",
        errorMessage: "Missing Auth0 sub",
        durationMs: Date.now() - startTime,
        meta: { reason: "missing_sub" },
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 401,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: responseHeaders(requestId) }
      );
    }

    auth0SubForLog = sub;
    const auth0Sub = sub;

    const identifier = `user:${auth0Sub}`;

    // 1) Parse request body
    let body: ChatBody = {};
    try {
      body = (await req.json()) as ChatBody;
    } catch {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 400,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }

    const message = body?.message;
    if (!message || typeof message !== "string") {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 400,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { ok: false, error: "Missing 'message' (must be a string)" },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }

    // 2) Mode selection
    const clientMode: ClientMode = normalizeClientMode(body?.mode);
    const wantCases = clientMode === "cases";
    const wantReview = clientMode === "review";
    const executionMode: ExecutionMode = wantReview ? "review" : "coach";

    modeForMetric = clientMode;

    const weakInput = isWeakInput(message);
    const explicitRegenerationRequest = isExplicitRegenerationRequest(message);

    if (message.length > 8000) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 400,
        latencyMs: Date.now() - startTime,
      });

      const inputTooLargeMessage =
        clientMode === "review"
          ? "Input too large for a single review request. Please split the suite into smaller sections and review them in parts."
          : clientMode === "cases"
            ? "Input too large for a single test design request. Please reduce the pasted scope or generate the suite incrementally."
            : "Input too large for a single Strategy request. Please shorten the requirement or split it into smaller parts.";

      return NextResponse.json(
        {
          ok: false,
          error: inputTooLargeMessage,
          details: `Received ${message.length} characters. Maximum supported length is 8000.`,
        },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }

    // M7.4: guided clarification answer heuristic
    const guidedAnswer =
      executionMode === "coach" && !wantCases && isGuidedClarificationAnswer(message);

    // 3) RBAC: review is admin-only
    if (executionMode === "review") {
      const isAdmin = await isAdminFromAccessToken();
      if (!isAdmin) {
        log("warn", {
          event: "forbidden_review_access",
          requestId,
          auth0Sub,
          mode: clientMode,
          durationMs: Date.now() - startTime,
        });

        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 403,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          { ok: false, mode: clientMode, error: "Forbidden" },
          { status: 403, headers: responseHeaders(requestId) }
        );
      }
    }

    // 4) Ensure org + wallet exist (billing preconditions)
    const orgState = await ensureOrgForUser({
      auth0Sub,
      name: (user.name as string | undefined) ?? null,
      email: (user.email as string | undefined) ?? null,
    });

    orgId =
      typeof orgState.organizationId === "string"
        ? orgState.organizationId
        : undefined;

    if (!orgState.wallet || orgState.wallet.balance <= 0) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 402,
        latencyMs: Date.now() - startTime,
      });

      log("warn", {
        event: "billing_failure",
        requestId,
        auth0Sub,
        orgId,
        mode: clientMode,
        errorType: "insufficient_credits_precheck",
        errorMessage: "Wallet balance <= 0 before OpenAI call",
        durationMs: Date.now() - startTime,
        meta: { walletBalance: orgState.wallet?.balance ?? 0 },
      });

      return NextResponse.json(
        {
          ok: false,
          mode: clientMode,
          error: "Insufficient credits",
          creditsRemaining: orgState.wallet?.balance ?? 0,
        },
        { status: 402, headers: responseHeaders(requestId) }
      );
    }

    // 5) Rate limit
    const { success, remaining, reset } = await chatRatelimit.limit(identifier);
    const resetSeconds =
      typeof reset === "number"
        ? Math.max(1, Math.ceil((reset - Date.now()) / 1000))
        : 60;

    rateMeta = {
      limit: CHAT_RATE_LIMIT.limit,
      remaining: typeof remaining === "number" ? remaining : 0,
      resetSeconds,
    };

    if (!success) {
      log("warn", {
        event: "rate_limit_exceeded",
        requestId,
        auth0Sub,
        orgId,
        mode: clientMode,
        durationMs: Date.now() - startTime,
        meta: { resetSeconds },
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 429,
        latencyMs: Date.now() - startTime,
        rateLimited: true,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Rate limit exceeded",
          details: `Too many requests. Try again in ~${resetSeconds}s.`,
          rate: { ...rateMeta, remaining: 0 },
        },
        {
          status: 429,
          headers: responseHeaders(
            requestId,
            { ...rateMeta, remaining: 0 },
            resetSeconds
          ),
        }
      );
    }

    // 6) Create/reuse session + hydrate artifact
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

    // 7) Replay
    const existingAssistant = await prisma.chatMessage.findFirst({
      where: { sessionId, requestId, role: "assistant", auth0Sub },
      select: { content: true, tokensIn: true, tokensOut: true },
    });

    if (existingAssistant) {
      const refreshed = await refreshArtifact({
        auth0Sub,
        sessionId,
        fallback: sessionArtifact,
      });

      sessionArtifact = refreshed.artifact ?? sessionArtifact ?? null;
      artifactUpdatedAtIso =
        refreshed.artifactUpdatedAtIso ?? artifactUpdatedAtIso ?? null;

      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      if (executionMode === "review") {
        const raw = existingAssistant.content ?? "";
        try {
          const parsed = JSON.parse(extractJsonObject(raw)) as unknown;
          if (isReviewResult(parsed)) {
            return NextResponse.json(
              {
                ok: true,
                mode: clientMode,
                review: parsed as ReviewResult,
                sessionId,
                usage: {
                  promptTokens: existingAssistant.tokensIn ?? 0,
                  completionTokens: existingAssistant.tokensOut ?? 0,
                  totalTokens:
                    (existingAssistant.tokensIn ?? 0) +
                    (existingAssistant.tokensOut ?? 0),
                },
                rate: rateMeta,
                replay: true,
                artifact: sessionArtifact,
                artifactUpdatedAt: artifactUpdatedAtIso,
              },
              { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
            );
          }
        } catch {
          // fall through
        }

        return NextResponse.json(
          {
            ok: true,
            mode: clientMode,
            raw,
            sessionId,
            usage: {
              promptTokens: existingAssistant.tokensIn ?? 0,
              completionTokens: existingAssistant.tokensOut ?? 0,
              totalTokens:
                (existingAssistant.tokensIn ?? 0) +
                (existingAssistant.tokensOut ?? 0),
            },
            rate: rateMeta,
            replay: true,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          },
          { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          mode: clientMode,
          reply: existingAssistant.content,
          sessionId,
          usage: {
            promptTokens: existingAssistant.tokensIn ?? 0,
            completionTokens: existingAssistant.tokensOut ?? 0,
            totalTokens:
              (existingAssistant.tokensIn ?? 0) +
              (existingAssistant.tokensOut ?? 0),
          },
          rate: rateMeta,
          replay: true,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        },
        { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
      );
    }

    // 8) Persist user message
    await persistUserMessageIdempotent({
      sessionId,
      auth0Sub,
      requestId,
      content: message,
    });

    // 9) Guided clarification answer -> update artifact now
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

    /**
     * M9 CHANGE:
     * Test Design continuity now uses the persisted artifact testSuite
     * instead of scanning prior assistant messages.
     */
    let existingCasesSuiteSummary: string | null = null;
    let nextAvailableCaseNumber = 1;
    let existingCasesCount = 0;

    const existingTestSuite =
      wantCases && !explicitRegenerationRequest ? getTestSuite(sessionArtifact) : null;

    if (wantCases && existingTestSuite) {
      const baseline = buildExistingSuiteBaselineFromArtifact(existingTestSuite);
      existingCasesSuiteSummary = baseline.suiteSummary;
      existingCasesCount = baseline.existingCount;
      nextAvailableCaseNumber = Math.max(1, baseline.maxCaseNumber + 1);
    }

    // 10) Prompts
    const systemPrompt = wantCases ? CASES_SYSTEM_PROMPT : QA_SYSTEM_PROMPT;

    const effectiveArtifactForCoach =
      executionMode === "coach" && !wantCases && explicitRegenerationRequest
        ? null
        : sessionArtifact;

    const modeInstruction = wantCases
      ? [
          `INPUT_QUALITY: ${weakInput ? "weak" : "ok"}`,
          existingCasesCount > 0 && !explicitRegenerationRequest
            ? "SESSION_CONTINUITY: true"
            : "SESSION_CONTINUITY: false",
          existingCasesCount > 0 && !explicitRegenerationRequest
            ? `NEXT_AVAILABLE_TEST_CASE_ID: TC-${String(nextAvailableCaseNumber).padStart(3, "0")}`
            : "NEXT_AVAILABLE_TEST_CASE_ID: TC-001",
          existingCasesCount > 0 && !explicitRegenerationRequest
            ? "Treat the persisted session test suite as the baseline suite."
            : "Generate a fresh test suite for the user's feature.",
          existingCasesCount > 0 && !explicitRegenerationRequest
            ? "Generate ONLY missing tests requested by the user or implied by missing coverage."
            : "Generate the initial structured test suite for the user's feature.",
          "Avoid both exact duplicates and semantic duplicates.",
          "Do NOT repeat, rephrase, or renumber existing tests when continuity is active.",
          "Follow the OUTPUT CONTRACT exactly.",
        ].join("\n")
      : executionMode === "review"
        ? [
            "MODE: REVIEW & SCORING",
            "Return ONLY valid JSON. No markdown. No prose outside JSON.",
            "Schema:",
            "{",
            '  "score": number (0-100),',
            '  "verdict": string,',
            '  "breakdown": {',
            '    "businessRelevance": number (0-25),',
            '    "riskCoverage": number (0-25),',
            '    "designQuality": number (0-20),',
            '    "levelAndScope": number (0-15),',
            '    "diagnosticValue": number (0-15)',
            "  },",
            '  "riskGaps": string[],',
            '  "antiPatterns": string[],',
            '  "improvements": string[]',
            "}",
            "Rules:",
            "- Ensure breakdown is consistent with score.",
            "- riskGaps and improvements must be actionable and specific.",
            "- Keep each list <= 6 items.",
          ].join("\n")
        : [
            "MODE: COACH (TESTS-FIRST, LOW-FRICTION)",
            "Return ONLY valid JSON. No markdown. No prose outside JSON.",
            `INPUT_QUALITY: ${weakInput ? "weak" : "ok"}`,
            explicitRegenerationRequest
              ? "SESSION_CONTINUITY_RESET: true"
              : "SESSION_CONTINUITY: true",
            explicitRegenerationRequest
              ? "Treat this Strategy request as a fresh analysis and ignore prior refined requirement context for this response."
              : "Treat the user's new message as a refinement to the current session requirement unless they explicitly asked to regenerate.",
            explicitRegenerationRequest
              ? "Do a clean re-analysis from the current user message."
              : "Update and extend the evolving requirement when new scope, constraints, or risks are introduced.",
            "Primary rule: Do NOT start by asking questions.",
            "If input is weak: make reasonable assumptions and proceed.",
            "Always provide: assumptions + riskMatrix + highSignalApproach + testIdeas.",
            "Clarifications are OPTIONAL and MUST be last (max 3).",
            "If you include clarifications, they must be phrased as an opt-in for deeper tests.",
            ...(guidedAnswer
              ? [
                  "GUIDED_CLARIFICATION_ANSWER: true",
                  "Rule: The user has provided clarification answers. You MUST NOT include optionalClarifications. Proceed with full output.",
                ]
              : []),
            "Schema:",
            "{",
            '  "assumptions": string[],',
            '  "riskMatrix": [',
            '    { "risk": string, "likelihood": "Low"|"Med"|"High", "impact": "Low"|"Med"|"High", "mitigation": string }',
            "  ],",
            '  "highSignalApproach": {',
            '    "goals": string[],',
            '    "testIdeas": string[],',
            '    "minimalRepro"?: string[]',
            "  },",
            '  "optionalClarifications": string[]',
            "}",
            "Rules:",
            "- assumptions: 3-6 items.",
            "- riskMatrix: 3-6 items, concrete failure modes.",
            "- goals: 3-6 items.",
            "- testIdeas: 6-12 items max, specific and verifiable.",
            "- optionalClarifications: 0-3 items ONLY, and ONLY for more detailed tests.",
          ].join("\n");

    /**
     * CHANGE (M8.7):
     * Artifact injection rules after advisor continuity update:
     * - Cases: ALWAYS include pinned artifact (if meaningful) to align generation.
     * - Coach: include existing artifact by default unless the user explicitly asked to regenerate.
     */
    const hasArtifact = hasMeaningfulRefinedRequirement(
      wantCases ? sessionArtifact : effectiveArtifactForCoach
    );

    const includeArtifactContext =
      (wantCases && hasArtifact) ||
      (!wantCases &&
        executionMode === "coach" &&
        hasArtifact &&
        !explicitRegenerationRequest);

    const artifactForContext: SessionArtifact | null = wantCases
      ? sessionArtifact
      : effectiveArtifactForCoach;

    const artifactContext =
      includeArtifactContext && artifactForContext
        ? artifactToContextText(artifactForContext)
        : null;

    const messagesForModel: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: modeInstruction },
      ...(artifactContext
        ? [{ role: "system" as const, content: artifactContext }]
        : []),
      ...(wantCases && existingCasesSuiteSummary && !explicitRegenerationRequest
        ? [
            {
              role: "system" as const,
              content: [
                "EXISTING_TEST_SUITE_BASELINE:",
                "The following test cases already exist in this session artifact.",
                "Use them to continue numbering and avoid duplicates.",
                "",
                existingCasesSuiteSummary,
              ].join("\n"),
            },
          ]
        : []),
      { role: "user", content: message },
    ];

    // 11) OpenAI call
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

    const creditsCharged = tokensToCredits(totalTokens);

    const costUsd = estimateCostUsd({ model, promptTokens, completionTokens });
    const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

    // 12) Parse/repair outputs
    let coachParsed: CoachResult | null = null;
    let replyTextForUser: string | null = null;

    let reviewObj: ReviewResult | null = null;
    let reviewStoredJson: string | null = null;
    let reviewRepaired = false;

    /**
     * M9 CHANGE:
     * Stage the next suite update in memory first.
     * We persist it only after billing + assistant persistence succeeds.
     */
    let nextTestSuiteArtifact: TestSuiteArtifact | null = null;
    let testSuiteAddedCount = 0;

    if (executionMode === "review") {
      const tryParse = (txt: string): ReviewResult | null => {
        try {
          const parsed = JSON.parse(extractJsonObject(txt)) as unknown;
          return isReviewResult(parsed) ? (parsed as ReviewResult) : null;
        } catch {
          return null;
        }
      };

      reviewObj = tryParse(rawReply);

      if (!reviewObj) {
        const repaired = await repairJsonOnce({ mode: "review", raw: rawReply });
        reviewObj = tryParse(repaired);
        reviewRepaired = !!reviewObj;
      }

      if (reviewObj) reviewStoredJson = JSON.stringify(reviewObj);
    }

    if (executionMode === "coach" && !wantCases) {
      try {
        const obj = JSON.parse(extractJsonObject(rawReply));
        if (isCoachResult(obj)) coachParsed = obj;
      } catch {
        // ignore
      }

      if (!coachParsed) {
        const repaired = await repairJsonOnce({ mode: "coach", raw: rawReply });
        try {
          const repairedObj = JSON.parse(extractJsonObject(repaired));
          if (isCoachResult(repairedObj)) coachParsed = repairedObj;
        } catch {
          // ignore
        }
      }

      if (coachParsed) {
        // M8 final polish:
        // Allow optional clarifications even after refinement.
        // Keep them capped to 3 so Strategy stays lightweight.
        coachParsed.optionalClarifications =
          coachParsed.optionalClarifications?.slice(0, 3) ?? [];

        /**
         * CHANGE (M8.7):
         * Strategy continuity artifact enrichment.
         *
         * Guided answers already update the artifact strongly before the model call.
         * This additional step keeps free-text Strategy refinements evolving across the session.
         */
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
        // Fallback if parsing failed or the model returned something malformed.
        replyTextForUser = rawReply.trim();
      }

      coachParsed = null;
    }

    const assistantContentToStore =
      executionMode === "review"
        ? reviewStoredJson ?? rawReply
        : replyTextForUser ?? "No reply returned";

    // 13) Billing + assistant persistence
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

        return NextResponse.json(
          {
            ok: false,
            mode: clientMode,
            error: "Insufficient credits",
            sessionId,
            creditsCharged,
            creditsRemaining: orgState.wallet?.balance ?? 0,
            usage: { promptTokens, completionTokens, totalTokens },
            rate: rateMeta,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          },
          { status: 402, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }
      throw e;
    }

    /**
     * M9 CHANGE:
     * Persist updated test suite only after assistant persistence + billing succeed.
     */
    if (wantCases && nextTestSuiteArtifact) {
      const nextArtifact = withUpdatedTestSuiteArtifact(sessionArtifact, nextTestSuiteArtifact);

      const saved = await saveSessionArtifact({
        sessionId,
        artifact: nextArtifact,
      });

      sessionArtifact = saved.artifact;
      artifactUpdatedAtIso = saved.artifactUpdatedAtIso;
    }

    // 14) Responses
    if (executionMode === "review") {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      if (!reviewObj) {
        return NextResponse.json(
          {
            ok: false,
            mode: clientMode,
            error: "Failed to parse review JSON",
            raw: rawReply,
            sessionId,
            creditsCharged,
            creditsRemaining,
            usage: { promptTokens, completionTokens, totalTokens },
            rate: rateMeta,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          },
          { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          mode: clientMode,
          review: reviewObj,
          sessionId,
          creditsCharged,
          creditsRemaining,
          usage: { promptTokens, completionTokens, totalTokens },
          rate: rateMeta,
          repaired: reviewRepaired || undefined,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        },
        { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
      );
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

    return NextResponse.json(
      {
        ok: true,
        mode: clientMode,
        reply: replyTextForUser ?? "No reply returned",
        coach: coachParsed,
        sessionId,
        creditsCharged,
        creditsRemaining,
        usage: { promptTokens, completionTokens, totalTokens },
        rate: rateMeta,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      },
      { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
    );
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
      return NextResponse.json(
        {
          ok: false,
          error: "Session expired",
          details: "Your sign-in session expired. Please sign in again to continue.",
          ...(rateMeta ? { rate: rateMeta } : {}),
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        },
        { status: 401, headers: responseHeaders(requestId, rateMeta ?? undefined) }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Server error",
        details: errMsg,
        ...(rateMeta ? { rate: rateMeta } : {}),
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      },
      { status: 500, headers: responseHeaders(requestId, rateMeta ?? undefined) }
    );
  }
}