export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client"; // Prisma error types (P2002)

import { auth0 } from "@/lib/auth0";
import { log } from "@/lib/logger";
import { QA_SYSTEM_PROMPT, CASES_SYSTEM_PROMPT } from "@/lib/framework/systemPrompt";
import { isCoachResult, isReviewResult, type CoachResult, type ReviewResult } from "@/lib/framework/reviewSchema";
import { isAdminFromAccessToken } from "@/lib/auth/rbac";
import { recordChatMetric, type ChatMetricMode } from "@/lib/metrics/chatMetrics";

import { prisma } from "@/lib/prisma";
import { ensureOrgForUser } from "@/lib/billing/ensureOrgForUser";
import { chargeCreditsTx, InsufficientCreditsError } from "@/lib/billing/chargeCredits";

// Centralized infra imports
import { openai, withOpenAITrace, getOpenAITraceFromError } from "@/lib/openai";
import { chatRatelimit, CHAT_RATE_LIMIT } from "@/lib/ratelimit";

/**
 * Execution modes (contract + validation behavior).
 * - review: strict ReviewResult JSON
 * - coach: strict CoachResult JSON (rendered to text)
 *
 * WHY: cases is a plain-text contract and does not use JSON repair/validation.
 */
type ExecutionMode = "coach" | "review";

/**
 * Session UX modes (persisted for cohesion + history rendering).
 * WHY (M6.1): session mode must be stable so users don't mix outputs across one thread.
 */
type ClientMode = "coach" | "review" | "cases";

type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

type ChatBody = {
  message?: string;
  mode?: ClientMode;
  sessionId?: string; // Reuse existing session
  title?: string; // Optional (new session only)
  sessionClientId?: string; // IDP: prevents duplicate sessions during creation
};

function responseHeaders(requestId: string, meta?: RateMeta, retryAfterSec?: number) {
  const headers: Record<string, string> = { "X-Request-Id": requestId };

  if (meta) {
    headers["X-RateLimit-Limit"] = String(meta.limit);
    headers["X-RateLimit-Remaining"] = String(meta.remaining);
    headers["X-RateLimit-Reset"] = String(meta.resetSeconds);
  }

  if (retryAfterSec && retryAfterSec > 0) headers["Retry-After"] = String(retryAfterSec);

  return headers;
}

// 1 credit per 1000 tokens (rounded up)
function tokensToCredits(totalTokens: number) {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens / 1000));
}

/**
 * WHY (M4):
 * Internal-only cost estimate. Not used for billing, only for logs.
 * EUR conversion only happens if USD_TO_EUR is provided to avoid stale FX values.
 */
function estimateCostUsd(args: { model: string; promptTokens: number; completionTokens: number }): number | null {
  if (args.model !== "gpt-4.1-mini") return null;

  const inCostPerToken = 0.4 / 1_000_000;
  const outCostPerToken = 1.6 / 1_000_000;

  const cost = args.promptTokens * inCostPerToken + args.completionTokens * outCostPerToken;
  return Number(cost.toFixed(8));
}

function maybeConvertUsdToEur(costUsd: number): number | null {
  const raw = process.env.USD_TO_EUR?.trim();
  if (!raw) return null;

  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return Number((costUsd * rate).toFixed(8));
}

/**
 * Prisma helper:
 * If a request is retried with the same unique key, ChatMessage create() can throw P2002.
 * Treat as idempotent replay and continue.
 */
function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Extract first {...} JSON block from a mixed response.
 * This helps if the model leaks prose around JSON (coach/review only).
 */
function extractJsonObject(raw: string): string {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

/**
 * Input quality heuristic:
 * Weak input => we instruct the model to assume + proceed (tests-first).
 */
function isWeakInput(message: string): boolean {
  const t = message.trim();
  if (t.length < 60) return true;

  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount < 12) return true;

  const hasPunct = /[.?!:;]/.test(t);
  if (!hasPunct && t.length < 120) return true;

  return false;
}

/**
 * Convert a CoachResult to UI-friendly plain text.
 *
 * WHY: UI is chat-like, and coach mode should be human-readable even though we store JSON.
 */
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

  const clarifications = coach.optionalClarifications.slice(0, 3);
  if (clarifications.length) {
    lines.push("");
    lines.push("If you want more detailed tests, answer:");
    for (const q of clarifications) lines.push(`- ${q}`);
  }

  return lines.join("\n");
}

/**
 * One-pass repair:
 * Ask the model to output ONLY valid JSON matching the mode schema.
 *
 * IMPORTANT:
 * - Used only for coach/review (JSON contracts).
 * - NOT used for cases mode because cases contract is plain-text test cases only.
 */
async function repairJsonOnce(args: { mode: ExecutionMode; raw: string }): Promise<string> {
  const schemaInstruction =
    args.mode === "review"
      ? [
          "You must output ONLY valid JSON matching this schema (no markdown, no prose):",
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
        ].join("\n")
      : [
          "You must output ONLY valid JSON matching this schema (no markdown, no prose):",
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
          '  "optionalClarifications": string[] (max 3)',
          "}",
          "Rules:",
          "- Provide immediate value; do NOT ask lots of questions.",
          "- optionalClarifications must be <= 3 and placed last.",
        ].join("\n");

  const repaired = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    max_tokens: 650,
    messages: [
      { role: "system", content: "You are a strict JSON reformatter." },
      { role: "system", content: schemaInstruction },
      { role: "user", content: `Fix this into valid JSON only:\n\n${args.raw}` },
    ],
  });

  return repaired.choices[0]?.message?.content ?? args.raw;
}

function normalizeClientMode(m: unknown): ClientMode {
  return m === "review" || m === "cases" ? m : "coach";
}

export async function POST(req: Request) {
  const inbound = req.headers.get("x-request-id");
  const requestId = inbound && inbound.length < 200 ? inbound : randomUUID();

  const startTime = Date.now();

  // Keep these for logs/metrics (catch must not crash if early auth fails)
  let auth0SubForLog: string | undefined;
  let orgId: string | undefined;
  let sessionIdForLog: string | undefined;
  let modeForMetric: ChatMetricMode = "unknown";
  let rateMeta: RateMeta | null = null;

  // OpenAI trace captured for end/error logs
  let openaiModel: string | undefined;
  let openaiLatencyMs: number | undefined;
  let openaiErrorCode: string | undefined;
  const retryCount = 0; // WHY (M4): no retries in this milestone.

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

      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: responseHeaders(requestId) });
    }

    // ✅ WHY: TS narrowing — after the guard above, `user` is guaranteed non-null
    const user = session.user;

    // Auth0 subject is our stable user id
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

      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: responseHeaders(requestId) });
    }

    auth0SubForLog = sub;
    const auth0Sub: string = sub;

    // Prefer user-based rate limiting
    const identifier = `user:${auth0Sub}`;

    // 1) Parse request body safely
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
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400, headers: responseHeaders(requestId) });
    }

    const message = body?.message;

    // 2) Validate input
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

    if (message.length > 8000) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 400,
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { ok: false, error: "Message too long (max 8000 characters)" },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }

    // 3) Client mode selection (defaults to coach)
    const clientMode: ClientMode = normalizeClientMode(body?.mode);

    const wantCases = clientMode === "cases";
    const wantReview = clientMode === "review";

    // Execution + validation modes remain coach|review (cases is plain-text).
    const executionMode: ExecutionMode = wantReview ? "review" : "coach";

    /**
     * WHY (M6.1):
     * - Metrics/logs should reflect session UX mode (including cases).
     * - Session mode is now persisted as clientMode for history and cohesion.
     */
    modeForMetric = clientMode;
    const logMode: ClientMode = clientMode;

    const weakInput = isWeakInput(message);

    // 4) RBAC: review is admin-only (cases is allowed for non-admin by design)
    if (executionMode === "review") {
      const isAdmin = await isAdminFromAccessToken();
      if (!isAdmin) {
        log("warn", {
          event: "forbidden_review_access",
          requestId,
          auth0Sub,
          mode: logMode,
          durationMs: Date.now() - startTime,
        });

        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 403,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json({ ok: false, mode: clientMode, error: "Forbidden" }, { status: 403, headers: responseHeaders(requestId) });
      }
    }

    // 5) Ensure org + wallet exist (billing preconditions)
    const orgState = await ensureOrgForUser({
      auth0Sub,
      name: (user.name as string | undefined) ?? null,
      email: (user.email as string | undefined) ?? null,
    });

    // ✅ Typed extraction (no any)
    const orgIdFromState = typeof orgState.organizationId === "string" ? orgState.organizationId : undefined;

    const walletIdForOrg = orgState.wallet && typeof orgState.wallet.id === "string" ? orgState.wallet.id : undefined;

    orgId = orgIdFromState;

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
        mode: logMode,
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

    // 6) Rate limit (centralized)
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
        mode: logMode,
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
          headers: responseHeaders(requestId, { ...rateMeta, remaining: 0 }, resetSeconds),
        }
      );
    }

    // 7) Create or reuse ChatSession (IDP-safe) + enforce session-mode consistency (M6.1)
    let sessionId = body?.sessionId;

    if (sessionId) {
      const existing = await prisma.chatSession.findFirst({
        where: { id: sessionId, auth0Sub },
        select: { id: true, mode: true },
      });

      if (!existing) {
        sessionId = undefined;
      } else if (existing.mode && existing.mode !== clientMode) {
        /**
         * WHY (M6.1): cross-mode execution within a session breaks UX cohesion + deterministic history rendering.
         * We fail fast with an explicit 409 so the client can guide the user to "start new session".
         */
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 409,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            ok: false,
            error: "SESSION_MODE_MISMATCH",
            sessionMode: existing.mode,
            requestedMode: clientMode,
          },
          { status: 409, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }
    }

    if (!sessionId) {
      const rawClientId = typeof body?.sessionClientId === "string" ? body.sessionClientId.trim() : "";
      const clientSessionId = rawClientId.length > 0 ? rawClientId : requestId;

      const sessionRow = await prisma.chatSession.upsert({
        where: { auth0Sub_clientSessionId: { auth0Sub, clientSessionId } },
        create: {
          auth0Sub,
          mode: clientMode, // ✅ M6.1: persist session UX mode (coach|review|cases)
          title: body?.title ?? null,
          clientSessionId,
        },
        update: {
          // WHY (M6.1): never overwrite a session's mode via retry; mode is canonical for the session.
          title: undefined,
        },
        select: { id: true, mode: true },
      });

      // If an existing session was reused via upsert, enforce mode determinism.
      if (sessionRow.mode && sessionRow.mode !== clientMode) {
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 409,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            ok: false,
            error: "SESSION_MODE_MISMATCH",
            sessionMode: sessionRow.mode,
            requestedMode: clientMode,
          },
          { status: 409, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      sessionId = sessionRow.id;
    }

    sessionIdForLog = sessionId;

    log("info", {
      event: "chat_start",
      requestId,
      auth0Sub,
      orgId,
      sessionId: sessionIdForLog,
      mode: logMode,
      meta: { messageChars: message.length, weakInput, clientMode },
    });

    // 8) Idempotent replay (serve stored assistant message)
    const existingAssistant = await prisma.chatMessage.findFirst({
      where: { sessionId, requestId, role: "assistant", auth0Sub },
      select: { content: true, tokensIn: true, tokensOut: true },
    });

    if (existingAssistant) {
      /**
       * ✅ IMPORTANT:
       * When looking up the ledger for this request, constrain by walletId too.
       * Otherwise, requestId collisions across wallets (rare but possible) could misreport credits.
       */
      const charged = walletIdForOrg
        ? await prisma.creditLedger.findFirst({
            where: { walletId: walletIdForOrg, requestId, reason: "chat_usage" },
            select: { delta: true, walletId: true },
          })
        : await prisma.creditLedger.findFirst({
            where: { requestId, reason: "chat_usage" },
            select: { delta: true, walletId: true },
          });

      const wallet = charged?.walletId
        ? await prisma.creditWallet.findUnique({ where: { id: charged.walletId }, select: { balance: true } })
        : null;

      log("info", {
        event: "chat_replay_served",
        requestId,
        auth0Sub,
        orgId,
        sessionId: sessionIdForLog,
        mode: logMode,
        durationMs: Date.now() - startTime,
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      // Review replay can be returned as structured JSON if parseable
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
                creditsCharged: charged ? Math.abs(charged.delta) : null,
                creditsRemaining: wallet?.balance ?? null,
                usage: {
                  promptTokens: existingAssistant.tokensIn ?? 0,
                  completionTokens: existingAssistant.tokensOut ?? 0,
                  totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
                },
                rate: rateMeta,
                replay: true,
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
            creditsCharged: charged ? Math.abs(charged.delta) : null,
            creditsRemaining: wallet?.balance ?? null,
            usage: {
              promptTokens: existingAssistant.tokensIn ?? 0,
              completionTokens: existingAssistant.tokensOut ?? 0,
              totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
            },
            rate: rateMeta,
            replay: true,
          },
          { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      // Coach/Cases replay is stored as plain reply content.
      return NextResponse.json(
        {
          ok: true,
          mode: clientMode,
          reply: existingAssistant.content,
          sessionId,
          creditsCharged: charged ? Math.abs(charged.delta) : null,
          creditsRemaining: wallet?.balance ?? null,
          usage: {
            promptTokens: existingAssistant.tokensIn ?? 0,
            completionTokens: existingAssistant.tokensOut ?? 0,
            totalTokens: (existingAssistant.tokensIn ?? 0) + (existingAssistant.tokensOut ?? 0),
          },
          rate: rateMeta,
          replay: true,
        },
        { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
      );
    }

    // 9) Persist user message (idempotent-safe)
    await prisma.chatMessage
      .create({
        data: { sessionId, auth0Sub, role: "user", content: message, requestId },
      })
      .catch((e) => {
        if (isUniqueViolation(e)) return null;
        throw e;
      });

    // 10) Build mode instruction + system prompt
    const model = "gpt-4.1-mini";
    openaiModel = model;

    /**
     * IMPORTANT:
     * - coach/review are JSON contracts (existing behavior).
     * - cases is a plain-text contract (LOCKED).
     */
    const systemPrompt = wantCases ? CASES_SYSTEM_PROMPT : QA_SYSTEM_PROMPT;

    const modeInstruction = wantCases
      ? [
          // ✅ Keep this minimal so we don't tempt the model into meta text.
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
          "- Ensure breakdown sums to score OR is consistent with score.",
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

    const { result: completion, trace } = await withOpenAITrace(
      () =>
        openai.chat.completions.create({
          model,
          temperature: 0.2,
          // ✅ WHY: cases needs room for 8–12 full test cases.
          max_tokens: executionMode === "review" ? 500 : wantCases ? 1400 : 700,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: modeInstruction },
            { role: "user", content: message },
          ],
        }),
      model
    );

    openaiLatencyMs = trace.latencyMs;

    log("info", {
      event: "openai_call",
      requestId,
      auth0Sub,
      orgId,
      sessionId: sessionIdForLog,
      mode: logMode,
      model: trace.model,
      openaiLatencyMs: trace.latencyMs,
      retryCount: trace.retryCount,
      meta: { clientMode },
    });

    const rawReply = completion.choices[0]?.message?.content ?? "No reply returned";

    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;

    const creditsCharged = tokensToCredits(totalTokens);

    const costUsd = estimateCostUsd({ model, promptTokens, completionTokens });
    const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

    /**
     * Coach JSON parsing/repair (existing behavior).
     * Cases mode is plain-text — we do NOT parse/repair into JSON.
     */
    let coachParsed: CoachResult | null = null;
    let replyTextForUser: string | null = null;

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
        replyTextForUser = coachToText(coachParsed);
      } else {
        replyTextForUser =
          "I couldn't format the coach output this time. Please retry, or add a bit more context (workflow + expected behavior + edge cases).";
      }
    }

    // ✅ Cases mode: reply is the raw plain-text test case suite (contract locked).
    if (wantCases) {
      replyTextForUser = rawReply.trim();
      coachParsed = null;
    }

    let creditsRemaining: number | null = null;

    // 11) Billing + assistant message persistence (financially correct, serializable)
    try {
      creditsRemaining = await prisma.$transaction(
        async (tx) => {
          const remainingBal = await chargeCreditsTx(tx, {
            auth0Sub,
            credits: creditsCharged,
            requestId,
          });

          await tx.chatMessage
            .create({
              data: {
                sessionId,
                auth0Sub,
                role: "assistant",
                content: executionMode === "review" ? rawReply : replyTextForUser ?? "No reply returned",
                tokensIn: promptTokens,
                tokensOut: completionTokens,
                requestId,
              },
            })
            .catch((e) => {
              if (isUniqueViolation(e)) return null; // idempotent replay
              throw e;
            });

          return remainingBal;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        }
      );
    } catch (e) {
      const walletId = walletIdForOrg;

      const [walletSnap, ledgerSnap] = walletId
        ? await Promise.all([
            prisma.creditWallet.findUnique({ where: { id: walletId }, select: { balance: true } }),
            prisma.creditLedger.findFirst({
              where: { walletId },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: { id: true, delta: true, reason: true, requestId: true, createdAt: true },
            }),
          ])
        : [null, null];

      if (e instanceof InsufficientCreditsError) {
        log("warn", {
          event: "billing_failure",
          requestId,
          auth0Sub,
          orgId,
          sessionId: sessionIdForLog,
          mode: logMode,
          errorType: "insufficient_credits",
          errorMessage: e.message,
          durationMs: Date.now() - startTime,
          meta: {
            walletBalance: walletSnap?.balance ?? orgState.wallet?.balance ?? 0,
            ledger: ledgerSnap
              ? {
                  id: ledgerSnap.id,
                  delta: ledgerSnap.delta,
                  reason: ledgerSnap.reason,
                  requestId: ledgerSnap.requestId,
                  createdAt: ledgerSnap.createdAt.toISOString(),
                }
              : null,
          },
        });

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
          },
          { status: 402, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      log("error", {
        event: "billing_failure",
        requestId,
        auth0Sub,
        orgId,
        sessionId: sessionIdForLog,
        mode: logMode,
        errorType: "billing_tx_failed",
        errorMessage: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - startTime,
        meta: {
          walletBalance: walletSnap?.balance ?? orgState.wallet?.balance ?? 0,
          ledger: ledgerSnap
            ? {
                id: ledgerSnap.id,
                delta: ledgerSnap.delta,
                reason: ledgerSnap.reason,
                requestId: ledgerSnap.requestId,
                createdAt: ledgerSnap.createdAt.toISOString(),
              }
            : null,
        },
      });

      throw e;
    }

    // 12) REVIEW response path (structured JSON)
    if (executionMode === "review") {
      const jsonText = extractJsonObject(rawReply);

      try {
        const parsed = JSON.parse(jsonText);

        if (!isReviewResult(parsed)) {
          const repaired = await repairJsonOnce({ mode: "review", raw: rawReply });
          const repairedObj = JSON.parse(extractJsonObject(repaired));

          if (!isReviewResult(repairedObj)) {
            log("warn", {
              event: "chat_completed",
              requestId,
              auth0Sub,
              orgId,
              sessionId: sessionIdForLog,
              mode: logMode,
              durationMs: Date.now() - startTime,
              tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
              eurCost: costEur ?? undefined,
              reviewUnits: 1,
              meta: { reviewParse: "invalid_shape_after_repair", costUsd: costUsd ?? undefined },
            });

            await recordChatMetric({
              nowMs: Date.now(),
              mode: modeForMetric,
              status: 200,
              latencyMs: Date.now() - startTime,
            });

            return NextResponse.json(
              {
                ok: false,
                mode: clientMode,
                error: "Invalid review JSON shape",
                raw: rawReply,
                sessionId,
                creditsCharged,
                creditsRemaining,
                usage: { promptTokens, completionTokens, totalTokens },
                rate: rateMeta,
              },
              { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
            );
          }

          log("info", {
            event: "chat_completed",
            requestId,
            auth0Sub,
            orgId,
            sessionId: sessionIdForLog,
            mode: logMode,
            durationMs: Date.now() - startTime,
            model,
            openaiLatencyMs,
            openaiErrorCode,
            retryCount,
            tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
            eurCost: costEur ?? undefined,
            reviewUnits: 1,
            meta: { repaired: true, costUsd: costUsd ?? undefined },
          });

          await recordChatMetric({
            nowMs: Date.now(),
            mode: modeForMetric,
            status: 200,
            latencyMs: Date.now() - startTime,
          });

          return NextResponse.json(
            {
              ok: true,
              mode: clientMode,
              review: repairedObj,
              sessionId,
              creditsCharged,
              creditsRemaining,
              usage: { promptTokens, completionTokens, totalTokens },
              rate: rateMeta,
              repaired: true,
            },
            { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
          );
        }

        log("info", {
          event: "chat_completed",
          requestId,
          auth0Sub,
          orgId,
          sessionId: sessionIdForLog,
          mode: logMode,
          durationMs: Date.now() - startTime,
          model,
          openaiLatencyMs,
          openaiErrorCode,
          retryCount,
          tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
          eurCost: costEur ?? undefined,
          reviewUnits: 1,
          meta: { costUsd: costUsd ?? undefined },
        });

        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 200,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            ok: true,
            mode: clientMode,
            review: parsed,
            sessionId,
            creditsCharged,
            creditsRemaining,
            usage: { promptTokens, completionTokens, totalTokens },
            rate: rateMeta,
          },
          { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      } catch {
        const repaired = await repairJsonOnce({ mode: "review", raw: rawReply });

        try {
          const repairedObj = JSON.parse(extractJsonObject(repaired));

          if (!isReviewResult(repairedObj)) {
            log("warn", {
              event: "chat_completed",
              requestId,
              auth0Sub,
              orgId,
              sessionId: sessionIdForLog,
              mode: logMode,
              durationMs: Date.now() - startTime,
              tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
              eurCost: costEur ?? undefined,
              reviewUnits: 1,
              meta: { reviewParse: "json_parse_failed_after_repair", costUsd: costUsd ?? undefined },
            });

            await recordChatMetric({
              nowMs: Date.now(),
              mode: modeForMetric,
              status: 200,
              latencyMs: Date.now() - startTime,
            });

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
              },
              { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
            );
          }

          log("info", {
            event: "chat_completed",
            requestId,
            auth0Sub,
            orgId,
            sessionId: sessionIdForLog,
            mode: logMode,
            durationMs: Date.now() - startTime,
            model,
            openaiLatencyMs,
            openaiErrorCode,
            retryCount,
            tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
            eurCost: costEur ?? undefined,
            reviewUnits: 1,
            meta: { repaired: true, costUsd: costUsd ?? undefined },
          });

          await recordChatMetric({
            nowMs: Date.now(),
            mode: modeForMetric,
            status: 200,
            latencyMs: Date.now() - startTime,
          });

          return NextResponse.json(
            {
              ok: true,
              mode: clientMode,
              review: repairedObj,
              sessionId,
              creditsCharged,
              creditsRemaining,
              usage: { promptTokens, completionTokens, totalTokens },
              rate: rateMeta,
              repaired: true,
            },
            { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
          );
        } catch {
          log("warn", {
            event: "chat_completed",
            requestId,
            auth0Sub,
            orgId,
            sessionId: sessionIdForLog,
            mode: logMode,
            durationMs: Date.now() - startTime,
            tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
            eurCost: costEur ?? undefined,
            reviewUnits: 1,
            meta: { reviewParse: "json_parse_failed", costUsd: costUsd ?? undefined },
          });

          await recordChatMetric({
            nowMs: Date.now(),
            mode: modeForMetric,
            status: 200,
            latencyMs: Date.now() - startTime,
          });

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
            },
            { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
          );
        }
      }
    }

    // 13) COACH + CASES response (plain reply text)
    log("info", {
      event: "chat_completed",
      requestId,
      auth0Sub,
      orgId,
      sessionId: sessionIdForLog,
      mode: logMode,
      durationMs: Date.now() - startTime,
      model,
      openaiLatencyMs,
      openaiErrorCode,
      retryCount,
      tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
      eurCost: costEur ?? undefined,
      meta: { costUsd: costUsd ?? undefined, clientMode },
    });

    await recordChatMetric({
      nowMs: Date.now(),
      mode: modeForMetric,
      status: 200,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        ok: true,
        mode: clientMode,
        reply: replyTextForUser ?? "No reply returned",
        coach: coachParsed, // null for cases/review; populated for coach (when parse succeeds)
        sessionId,
        creditsCharged,
        creditsRemaining,
        usage: { promptTokens, completionTokens, totalTokens },
        rate: rateMeta,
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

    await recordChatMetric({
      nowMs: Date.now(),
      mode: modeForMetric,
      status: 500,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(
      { ok: false, error: "Server error", details: errMsg, ...(rateMeta ? { rate: rateMeta } : {}) },
      { status: 500, headers: responseHeaders(requestId, rateMeta ?? undefined) }
    );
  }
}