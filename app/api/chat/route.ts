// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { auth0 } from "@/lib/auth0";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

import { QA_SYSTEM_PROMPT, CASES_SYSTEM_PROMPT } from "@/lib/framework/systemPrompt";
import { isCoachResult, isReviewResult, type CoachResult, type ReviewResult } from "@/lib/framework/reviewSchema";

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
  isGuidedClarificationAnswer,
  parseGuidedAnswerToRefinedRequirement,
  mergeArtifact,
  artifactToContextText,
  prismaJsonValue,
} from "@/lib/chat/artifact";

import {
  type CoachSuggestions,
  buildCoachSuggestionsFromCoach,
  buildFallbackCoachSuggestions,
} from "@/lib/chat/suggestions";
import { repairJsonOnce } from "@/lib/chat/repair";
import { loadOrCreateSession, refreshArtifact } from "@/lib/chat/sessionStore";
import {
  persistUserMessageIdempotent,
  persistAssistantWithBillingTx,
  InsufficientCreditsError,
} from "@/lib/chat/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function coachToText(coach: CoachResult): string {
  const lines: string[] = [];

  lines.push("Assumptions:");
  for (const a of coach.assumptions.slice(0, 6)) lines.push(`- ${a}`);

  lines.push("");
  lines.push("Risk matrix:");
  for (const r of coach.riskMatrix.slice(0, 6)) {
    lines.push(`- ${r.risk} (Likelihood: ${r.likelihood}, Impact: ${r.impact}) — Mitigation: ${r.mitigation}`);
  }

  lines.push("");
  lines.push("High-signal test approach:");
  lines.push("Goals:");
  for (const g of coach.highSignalApproach.goals.slice(0, 6)) lines.push(`- ${g}`);

  lines.push("Test ideas:");
  for (const t of coach.highSignalApproach.testIdeas.slice(0, 12)) lines.push(`- ${t}`);

  if (coach.highSignalApproach.minimalRepro?.length) {
    lines.push("Minimal repro (optional):");
    for (const s of coach.highSignalApproach.minimalRepro.slice(0, 8)) lines.push(`- ${s}`);
  }

  return lines.join("\n");
}

/**
 * CHANGE (M7): Do not inject empty artifact context.
 * We only consider the artifact "meaningful" if it has at least one non-empty field.
 */
function hasMeaningfulRefinedRequirement(artifact: SessionArtifact | null): boolean {
  const rr = artifact?.refinedRequirement;
  if (!rr) return false;

  const hasText = (v?: string) => typeof v === "string" && v.trim().length > 0;
  const hasList = (v?: string[]) => Array.isArray(v) && v.some((x) => String(x ?? "").trim().length > 0);

  return (
    hasText(rr.objective) ||
    hasText(rr.context) ||
    hasList(rr.inScope) ||
    hasList(rr.outOfScope) ||
    hasList(rr.integrations) ||
    hasList(rr.riskFocus) ||
    hasList(rr.acceptanceCriteria)
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

      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 401, latencyMs: Date.now() - startTime });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: responseHeaders(requestId) });
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

      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 401, latencyMs: Date.now() - startTime });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: responseHeaders(requestId) });
    }

    auth0SubForLog = sub;
    const auth0Sub = sub;

    const identifier = `user:${auth0Sub}`;

    // 1) Parse request body
    let body: ChatBody = {};
    try {
      body = (await req.json()) as ChatBody;
    } catch {
      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 400, latencyMs: Date.now() - startTime });
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers: responseHeaders(requestId) });
    }

    const message = body?.message;
    if (!message || typeof message !== "string") {
      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 400, latencyMs: Date.now() - startTime });
      return NextResponse.json({ ok: false, error: "Missing 'message' (must be a string)" }, { status: 400, headers: responseHeaders(requestId) });
    }
    if (message.length > 8000) {
      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 400, latencyMs: Date.now() - startTime });
      return NextResponse.json({ ok: false, error: "Message too long (max 8000 characters)" }, { status: 400, headers: responseHeaders(requestId) });
    }

    // 2) Mode selection
    const clientMode: ClientMode = normalizeClientMode(body?.mode);
    const wantCases = clientMode === "cases";
    const wantReview = clientMode === "review";
    const executionMode: ExecutionMode = wantReview ? "review" : "coach";

    modeForMetric = clientMode;

    const weakInput = isWeakInput(message);

    // M7.4: guided clarification answer heuristic
    const guidedAnswer = executionMode === "coach" && !wantCases && isGuidedClarificationAnswer(message);

    // 3) RBAC: review is admin-only
    if (executionMode === "review") {
      const isAdmin = await isAdminFromAccessToken();
      if (!isAdmin) {
        log("warn", { event: "forbidden_review_access", requestId, auth0Sub, mode: clientMode, durationMs: Date.now() - startTime });
        await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 403, latencyMs: Date.now() - startTime });
        return NextResponse.json({ ok: false, mode: clientMode, error: "Forbidden" }, { status: 403, headers: responseHeaders(requestId) });
      }
    }

    // 4) Ensure org + wallet exist (billing preconditions)
    const orgState = await ensureOrgForUser({
      auth0Sub,
      name: (user.name as string | undefined) ?? null,
      email: (user.email as string | undefined) ?? null,
    });

    orgId = typeof orgState.organizationId === "string" ? orgState.organizationId : undefined;

    if (!orgState.wallet || orgState.wallet.balance <= 0) {
      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 402, latencyMs: Date.now() - startTime });

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
        { ok: false, mode: clientMode, error: "Insufficient credits", creditsRemaining: orgState.wallet?.balance ?? 0 },
        { status: 402, headers: responseHeaders(requestId) }
      );
    }

    // 5) Rate limit
    const { success, remaining, reset } = await chatRatelimit.limit(identifier);
    const resetSeconds = typeof reset === "number" ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 60;

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

      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 429, latencyMs: Date.now() - startTime, rateLimited: true });

      return NextResponse.json(
        {
          ok: false,
          error: "Rate limit exceeded",
          details: `Too many requests. Try again in ~${resetSeconds}s.`,
          rate: { ...rateMeta, remaining: 0 },
        },
        { status: 429, headers: responseHeaders(requestId, { ...rateMeta, remaining: 0 }, resetSeconds) }
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
      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 409, latencyMs: Date.now() - startTime });
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
      meta: { messageChars: message.length, weakInput, clientMode, guidedAnswer, hasArtifact: !!sessionArtifact },
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

      // CHANGE: fixed indentation/style (your pasted block was misaligned)
      sessionArtifact = refreshed.artifact ?? sessionArtifact ?? null;
      artifactUpdatedAtIso = refreshed.artifactUpdatedAtIso ?? artifactUpdatedAtIso ?? null;

      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 200, latencyMs: Date.now() - startTime });

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
                  totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
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
              totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
            },
            rate: rateMeta,
            replay: true,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          },
          { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      const replayHasClarifications =
        !wantCases && executionMode === "coach" && (existingAssistant.content ?? "").includes("If you want more detailed tests, answer:");
      const replaySuggestions: CoachSuggestions | null = replayHasClarifications ? buildFallbackCoachSuggestions() : null;

      return NextResponse.json(
        {
          ok: true,
          mode: clientMode,
          reply: existingAssistant.content,
          sessionId,
          usage: {
            promptTokens: existingAssistant.tokensIn ?? 0,
            completionTokens: existingAssistant.tokensOut ?? 0,
            totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
          },
          rate: rateMeta,
          replay: true,
          ...(replaySuggestions ? { suggestions: replaySuggestions } : {}),
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
        const now = new Date();

        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            artifactJson: prismaJsonValue(nextArtifact),
            artifactUpdatedAt: now,
          },
          select: { id: true },
        });

        sessionArtifact = nextArtifact;
        artifactUpdatedAtIso = now.toISOString();
      }
    }

    // 10) Prompts
    const systemPrompt = wantCases ? CASES_SYSTEM_PROMPT : QA_SYSTEM_PROMPT;

    const modeInstruction = wantCases
      ? [
          `INPUT_QUALITY: ${weakInput ? "weak" : "ok"}`,
          "Generate the test cases for the user's feature. Follow the OUTPUT CONTRACT exactly.",
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
     * CHANGE (M7): Artifact injection rules
     * - Cases: ALWAYS include pinned artifact (if meaningful) to align the 8–12 tests.
     * - Coach: include only when it helps (guided answer or weak input), to avoid over-biasing normal coach runs.
     */
    const hasArtifact = hasMeaningfulRefinedRequirement(sessionArtifact);
    const includeArtifactContext =
      (wantCases && hasArtifact) || (!wantCases && executionMode === "coach" && hasArtifact && (guidedAnswer || weakInput));

    const artifactContext = includeArtifactContext && sessionArtifact ? artifactToContextText(sessionArtifact) : null;

    const messagesForModel: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: modeInstruction },
      ...(artifactContext ? [{ role: "system" as const, content: artifactContext }] : []),
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
    const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;

    const creditsCharged = tokensToCredits(totalTokens);

    const costUsd = estimateCostUsd({ model, promptTokens, completionTokens });
    const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

    // 12) Parse/repair outputs
    let coachParsed: CoachResult | null = null;
    let replyTextForUser: string | null = null;

    let reviewObj: ReviewResult | null = null;
    let reviewStoredJson: string | null = null;
    let reviewRepaired = false;

    let suggestions: CoachSuggestions | null = null;

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
        coachParsed.optionalClarifications = coachParsed.optionalClarifications.slice(0, 3);
        if (guidedAnswer) coachParsed.optionalClarifications = [];

        replyTextForUser = coachToText(coachParsed);

        if (coachParsed.optionalClarifications.length > 0) {
          suggestions = buildCoachSuggestionsFromCoach(coachParsed) ?? buildFallbackCoachSuggestions();
        }
      } else {
        replyTextForUser = "I couldn't format the coach output this time. Please retry, or add a bit more context (workflow + expected behavior + edge cases).";
      }
    }

    if (wantCases) {
      replyTextForUser = rawReply.trim();
      coachParsed = null;
      suggestions = null;
    }

    const assistantContentToStore =
      executionMode === "review" ? reviewStoredJson ?? rawReply : replyTextForUser ?? "No reply returned";

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
        await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 402, latencyMs: Date.now() - startTime });

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

    // 14) Responses
    if (executionMode === "review") {
      await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 200, latencyMs: Date.now() - startTime });

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

    await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 200, latencyMs: Date.now() - startTime });

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
        ...(suggestions ? { suggestions } : {}),
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

    log("error", {
      event: "chat_error",
      requestId,
      auth0Sub: auth0SubForLog,
      orgId,
      sessionId: sessionIdForLog,
      mode: modeForMetric === "coach" || modeForMetric === "review" || modeForMetric === "cases" ? modeForMetric : undefined,
      durationMs: Date.now() - startTime,
      model: openaiModel,
      openaiLatencyMs,
      openaiErrorCode,
      retryCount,
      errorType: "chat_error",
      errorMessage: errMsg,
    });

    await recordChatMetric({ nowMs: Date.now(), mode: modeForMetric, status: 500, latencyMs: Date.now() - startTime });

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