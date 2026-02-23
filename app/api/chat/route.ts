// app/api/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client"; // Prisma error types (P2002)

import { auth0 } from "@/lib/auth0";
import { log } from "@/lib/logger";
import { QA_SYSTEM_PROMPT } from "@/lib/framework/systemPrompt";
import {
  isCoachResult,
  isReviewResult,
  type CoachResult,
  type ReviewResult,
} from "@/lib/framework/reviewSchema";
import { isAdminFromAccessToken } from "@/lib/auth/rbac";
import { recordChatMetric, type ChatMetricMode } from "@/lib/metrics/chatMetrics";

import { prisma } from "@/lib/prisma";
import { ensureOrgForUser } from "@/lib/billing/ensureOrgForUser";
import {
  chargeCreditsTx,
  InsufficientCreditsError,
} from "@/lib/billing/chargeCredits";

// Centralized infra imports
import { openai } from "@/lib/openai";
import { chatRatelimit, CHAT_RATE_LIMIT } from "@/lib/ratelimit";

type Mode = "coach" | "review";

type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

type ChatBody = {
  message?: string;
  mode?: Mode;
  sessionId?: string; // Reuse existing session
  title?: string; // Optional (new session only)
  sessionClientId?: string; // IDP: prevents duplicate sessions during creation
};

function getIpIdentifier(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return `ip:${xff.split(",")[0].trim()}`;

  const xrip = req.headers.get("x-real-ip");
  if (xrip) return `ip:${xrip.trim()}`;

  return "ip:unknown";
}

function responseHeaders(
  requestId: string,
  meta?: RateMeta,
  retryAfterSec?: number
) {
  const headers: Record<string, string> = { "X-Request-Id": requestId };

  if (meta) {
    headers["X-RateLimit-Limit"] = String(meta.limit);
    headers["X-RateLimit-Remaining"] = String(meta.remaining);
    headers["X-RateLimit-Reset"] = String(meta.resetSeconds);
  }

  if (retryAfterSec && retryAfterSec > 0)
    headers["Retry-After"] = String(retryAfterSec);

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
function estimateCostUsd(args: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number | null {
  if (args.model !== "gpt-4.1-mini") return null;

  const inCostPerToken = 0.4 / 1_000_000;
  const outCostPerToken = 1.6 / 1_000_000;

  const cost =
    args.promptTokens * inCostPerToken +
    args.completionTokens * outCostPerToken;

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
 * This helps if the model leaks prose around JSON.
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
 */
function coachToText(coach: CoachResult): string {
  const lines: string[] = [];

  lines.push("Assumptions:");
  for (const a of coach.assumptions.slice(0, 6)) lines.push(`- ${a}`);

  lines.push("");
  lines.push("Risk matrix:");
  for (const r of coach.riskMatrix.slice(0, 6)) {
    lines.push(
      `- ${r.risk} (Likelihood: ${r.likelihood}, Impact: ${r.impact}) — Mitigation: ${r.mitigation}`
    );
  }

  lines.push("");
  lines.push("High-signal test approach:");
  lines.push("Goals:");
  for (const g of coach.highSignalApproach.goals.slice(0, 6))
    lines.push(`- ${g}`);

  lines.push("Test ideas:");
  for (const t of coach.highSignalApproach.testIdeas.slice(0, 12))
    lines.push(`- ${t}`);

  if (coach.highSignalApproach.minimalRepro?.length) {
    lines.push("Minimal repro (optional):");
    for (const s of coach.highSignalApproach.minimalRepro.slice(0, 8))
      lines.push(`- ${s}`);
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
 */
async function repairJsonOnce(args: { mode: Mode; raw: string }): Promise<string> {
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
    max_tokens: 500,
    messages: [
      { role: "system", content: "You are a strict JSON reformatter." },
      { role: "system", content: schemaInstruction },
      { role: "user", content: `Fix this into valid JSON only:\n\n${args.raw}` },
    ],
  });

  return repaired.choices[0]?.message?.content ?? args.raw;
}

export async function POST(req: Request) {
  const inbound = req.headers.get("x-request-id");
  const requestId = inbound && inbound.length < 200 ? inbound : randomUUID();

  const startTime = Date.now();

  // Keep these for logs/metrics (catch must not crash if early auth fails)
  let auth0SubForLog: string | undefined;
  let orgId: string | undefined;
  let sessionIdForLog: string | undefined;
  let modeForLog: ChatMetricMode = "unknown";
  let rateMeta: RateMeta | null = null;

  // OpenAI trace captured for end/error logs
  let openaiModel: string | undefined;
  let openaiLatencyMs: number | undefined;
  let openaiErrorCode: string | undefined;
  const retryCount = 0; // WHY (M4): we do not introduce retries in this milestone.

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
        mode: modeForLog,
        status: 401,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: responseHeaders(requestId) }
      );
    }

    // Auth0 subject is our stable user id
    const sub = session.user.sub as string | undefined;
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
        mode: modeForLog,
        status: 401,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: responseHeaders(requestId) }
      );
    }

    // ✅ Narrowing: from here, auth0Sub is guaranteed string for Prisma + billing.
    auth0SubForLog = sub;
    const auth0Sub: string = sub;

    // Prefer user-based rate limiting; fallback to IP only if missing
    const identifier = auth0Sub ? `user:${auth0Sub}` : getIpIdentifier(req);

    // 1) Parse request body safely
    let body: ChatBody = {};
    try {
      body = (await req.json()) as ChatBody;
    } catch {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForLog,
        status: 400,
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }

    const message = body?.message;
    const mode: Mode = body?.mode === "review" ? "review" : "coach";
    modeForLog = mode;

    // 2) Validate input
    if (!message || typeof message !== "string") {
      await recordChatMetric({
        nowMs: Date.now(),
        mode,
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
        mode,
        status: 400,
        latencyMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { ok: false, error: "Message too long (max 8000 characters)" },
        { status: 400, headers: responseHeaders(requestId) }
      );
    }

    const weakInput = isWeakInput(message);

    // 3) RBAC: review is admin-only
    if (mode === "review") {
      const isAdmin = await isAdminFromAccessToken();
      if (!isAdmin) {
        log("warn", {
          event: "forbidden_review_access",
          requestId,
          auth0Sub,
          mode,
          durationMs: Date.now() - startTime,
        });

        await recordChatMetric({
          nowMs: Date.now(),
          mode,
          status: 403,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          { ok: false, mode, error: "Forbidden" },
          { status: 403, headers: responseHeaders(requestId) }
        );
      }
    }

    // 4) Ensure org + wallet exist (billing preconditions)
    const orgState = await ensureOrgForUser({
      auth0Sub,
      name: (session.user.name as string | undefined) ?? null,
      email: (session.user.email as string | undefined) ?? null,
    });

    orgId = (orgState as any)?.org?.id ?? undefined;

    if (!orgState.wallet || orgState.wallet.balance <= 0) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode,
        status: 402,
        latencyMs: Date.now() - startTime,
      });

      log("warn", {
        event: "billing_failure",
        requestId,
        auth0Sub,
        orgId,
        mode,
        errorType: "insufficient_credits_precheck",
        errorMessage: "Wallet balance <= 0 before OpenAI call",
        durationMs: Date.now() - startTime,
        meta: { walletBalance: orgState.wallet?.balance ?? 0 },
      });

      return NextResponse.json(
        {
          ok: false,
          mode,
          error: "Insufficient credits",
          creditsRemaining: orgState.wallet?.balance ?? 0,
        },
        { status: 402, headers: responseHeaders(requestId) }
      );
    }

    // 5) Rate limit (centralized)
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
        mode,
        durationMs: Date.now() - startTime,
        meta: { resetSeconds },
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode,
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

    // 5.5) Create or reuse ChatSession (IDP-safe)
    let sessionId = body?.sessionId;

    if (sessionId) {
      const existing = await prisma.chatSession.findFirst({
        where: { id: sessionId, auth0Sub },
        select: { id: true },
      });
      if (!existing) sessionId = undefined;
    }

    if (!sessionId) {
      const rawClientId =
        typeof body?.sessionClientId === "string"
          ? body.sessionClientId.trim()
          : "";
      const clientSessionId = rawClientId.length > 0 ? rawClientId : requestId;

      const sessionRow = await prisma.chatSession.upsert({
        where: {
          auth0Sub_clientSessionId: {
            auth0Sub,
            clientSessionId,
          },
        },
        create: {
          auth0Sub,
          mode,
          title: body?.title ?? null,
          clientSessionId,
        },
        update: {
          // Keep stable; do not overwrite titles on replay
          title: undefined,
        },
        select: { id: true },
      });

      sessionId = sessionRow.id;
    }

    sessionIdForLog = sessionId;

    // WHY (M4): log after we have auth0Sub + orgId + sessionId to make correlation useful.
    log("info", {
      event: "chat_start",
      requestId,
      auth0Sub,
      orgId,
      sessionId: sessionIdForLog,
      mode,
      meta: { messageChars: message.length },
    });

    // Replay protection (cost safety)
    const existingAssistant = await prisma.chatMessage.findFirst({
      where: { sessionId, requestId, role: "assistant", auth0Sub },
      select: { content: true, tokensIn: true, tokensOut: true },
    });

    if (existingAssistant) {
      const charged = await prisma.creditLedger.findFirst({
        where: { requestId, reason: "chat_usage" },
        select: { delta: true, walletId: true },
      });

      const wallet = charged?.walletId
        ? await prisma.creditWallet.findUnique({
            where: { id: charged.walletId },
            select: { balance: true },
          })
        : null;

      log("info", {
        event: "chat_replay_served",
        requestId,
        auth0Sub,
        orgId,
        sessionId: sessionIdForLog,
        mode,
        durationMs: Date.now() - startTime,
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      if (mode === "review") {
        const raw = existingAssistant.content ?? "";
        try {
          const parsed = JSON.parse(extractJsonObject(raw)) as unknown;
          if (isReviewResult(parsed)) {
            return NextResponse.json(
              {
                ok: true,
                mode,
                review: parsed as ReviewResult,
                sessionId,
                creditsCharged: charged ? Math.abs(charged.delta) : null,
                creditsRemaining: wallet?.balance ?? null,
                usage: {
                  promptTokens: existingAssistant.tokensIn ?? 0,
                  completionTokens: existingAssistant.tokensOut ?? 0,
                  totalTokens:
                    (existingAssistant.tokensIn ?? 0) +
                    (existingAssistant.tokensOut ?? 0),
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
            mode,
            raw,
            sessionId,
            creditsCharged: charged ? Math.abs(charged.delta) : null,
            creditsRemaining: wallet?.balance ?? null,
            usage: {
              promptTokens: existingAssistant.tokensIn ?? 0,
              completionTokens: existingAssistant.tokensOut ?? 0,
              totalTokens:
                (existingAssistant.tokensIn ?? 0) +
                (existingAssistant.tokensOut ?? 0),
            },
            rate: rateMeta,
            replay: true,
          },
          { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          mode,
          reply: existingAssistant.content,
          sessionId,
          creditsCharged: charged ? Math.abs(charged.delta) : null,
          creditsRemaining: wallet?.balance ?? null,
          usage: {
            promptTokens: existingAssistant.tokensIn ?? 0,
            completionTokens: existingAssistant.tokensOut ?? 0,
            totalTokens:
              (existingAssistant.tokensIn ?? 0) +
              (existingAssistant.tokensOut ?? 0),
          },
          rate: rateMeta,
          replay: true,
        },
        { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
      );
    }

    // Store user message (idempotent under retries)
    await prisma.chatMessage
      .create({
        data: { sessionId, auth0Sub, role: "user", content: message, requestId },
      })
      .catch((e) => {
        if (isUniqueViolation(e)) return null;
        throw e;
      });

    const modeInstruction =
      mode === "review"
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

    const model = "gpt-4.1-mini";
    openaiModel = model;

    // --- OpenAI call: manual trace (no dependency on missing exports) ---
    const openaiStart = Date.now();
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: mode === "review" ? 500 : 700,
        messages: [
          { role: "system", content: QA_SYSTEM_PROMPT },
          { role: "system", content: modeInstruction },
          { role: "user", content: message },
        ],
      });

      openaiLatencyMs = Date.now() - openaiStart;

      log("info", {
        event: "openai_call",
        requestId,
        auth0Sub,
        orgId,
        sessionId: sessionIdForLog,
        mode,
        model,
        openaiLatencyMs,
        retryCount,
      });
    } catch (err) {
      openaiLatencyMs = Date.now() - openaiStart;
      openaiErrorCode = err instanceof Error ? err.name : "openai_error";

      log("error", {
        event: "openai_error",
        requestId,
        auth0Sub,
        orgId,
        sessionId: sessionIdForLog,
        mode,
        model,
        openaiLatencyMs,
        openaiErrorCode,
        retryCount,
        errorType: "openai_error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });

      throw err;
    }

    const rawReply = completion.choices[0]?.message?.content ?? "No reply returned";

    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens =
      completion.usage?.total_tokens ?? promptTokens + completionTokens;
    const creditsCharged = tokensToCredits(totalTokens);

    const costUsd = estimateCostUsd({ model, promptTokens, completionTokens });
    const costEur = costUsd != null ? maybeConvertUsdToEur(costUsd) : null;

    let coachParsed: CoachResult | null = null;
    let coachText: string | null = null;

    if (mode === "coach") {
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
        coachParsed.optionalClarifications =
          coachParsed.optionalClarifications.slice(0, 3);
        coachText = coachToText(coachParsed);
      } else {
        coachText =
          "I couldn't format the coach output this time. Please retry, or add a bit more context (workflow + expected behavior + edge cases).";
      }
    }

    // Financial correctness: charge credits + persist assistant message in one DB tx
    let creditsRemaining: number | null = null;

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
                content: mode === "coach" ? (coachText ?? "No reply returned") : rawReply,
                tokensIn: promptTokens,
                tokensOut: completionTokens,
                requestId,
              },
            })
            .catch((e) => {
              if (isUniqueViolation(e)) return null;
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
      // WHY (M4): billing traces only on failure (avoid noise + keep logs tight).
      const walletId = (orgState.wallet as any)?.id as string | undefined;

      const [walletSnap, ledgerSnap] = walletId
        ? await Promise.all([
            prisma.creditWallet.findUnique({
              where: { id: walletId },
              select: { balance: true },
            }),
            prisma.creditLedger.findFirst({
              where: { walletId },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                delta: true,
                reason: true,
                requestId: true,
                createdAt: true,
              },
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
          mode,
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
          mode,
          status: 402,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            ok: false,
            mode,
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
        mode,
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

    // REVIEW: parse JSON (with 1 repair pass)
    if (mode === "review") {
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
              mode,
              durationMs: Date.now() - startTime,
              tokenUsage: {
                prompt: promptTokens,
                completion: completionTokens,
                total: totalTokens,
              },
              eurCost: costEur ?? undefined,
              reviewUnits: 1,
              meta: {
                reviewParse: "invalid_shape_after_repair",
                costUsd: costUsd ?? undefined,
              },
            });

            await recordChatMetric({
              nowMs: Date.now(),
              mode,
              status: 200,
              latencyMs: Date.now() - startTime,
            });

            return NextResponse.json(
              {
                ok: false,
                mode,
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
            mode,
            durationMs: Date.now() - startTime,
            model,
            openaiLatencyMs,
            openaiErrorCode,
            retryCount,
            tokenUsage: {
              prompt: promptTokens,
              completion: completionTokens,
              total: totalTokens,
            },
            eurCost: costEur ?? undefined,
            reviewUnits: 1,
            meta: { repaired: true, costUsd: costUsd ?? undefined },
          });

          await recordChatMetric({
            nowMs: Date.now(),
            mode,
            status: 200,
            latencyMs: Date.now() - startTime,
          });

          return NextResponse.json(
            {
              ok: true,
              mode,
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
          mode,
          durationMs: Date.now() - startTime,
          model,
          openaiLatencyMs,
          openaiErrorCode,
          retryCount,
          tokenUsage: {
            prompt: promptTokens,
            completion: completionTokens,
            total: totalTokens,
          },
          eurCost: costEur ?? undefined,
          reviewUnits: 1,
          meta: { costUsd: costUsd ?? undefined },
        });

        await recordChatMetric({
          nowMs: Date.now(),
          mode,
          status: 200,
          latencyMs: Date.now() - startTime,
        });

        return NextResponse.json(
          {
            ok: true,
            mode,
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
              mode,
              durationMs: Date.now() - startTime,
              tokenUsage: {
                prompt: promptTokens,
                completion: completionTokens,
                total: totalTokens,
              },
              eurCost: costEur ?? undefined,
              reviewUnits: 1,
              meta: {
                reviewParse: "json_parse_failed_after_repair",
                costUsd: costUsd ?? undefined,
              },
            });

            await recordChatMetric({
              nowMs: Date.now(),
              mode,
              status: 200,
              latencyMs: Date.now() - startTime,
            });

            return NextResponse.json(
              {
                ok: false,
                mode,
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
            mode,
            durationMs: Date.now() - startTime,
            model,
            openaiLatencyMs,
            openaiErrorCode,
            retryCount,
            tokenUsage: {
              prompt: promptTokens,
              completion: completionTokens,
              total: totalTokens,
            },
            eurCost: costEur ?? undefined,
            reviewUnits: 1,
            meta: { repaired: true, costUsd: costUsd ?? undefined },
          });

          await recordChatMetric({
            nowMs: Date.now(),
            mode,
            status: 200,
            latencyMs: Date.now() - startTime,
          });

          return NextResponse.json(
            {
              ok: true,
              mode,
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
            mode,
            durationMs: Date.now() - startTime,
            tokenUsage: {
              prompt: promptTokens,
              completion: completionTokens,
              total: totalTokens,
            },
            eurCost: costEur ?? undefined,
            reviewUnits: 1,
            meta: { reviewParse: "json_parse_failed", costUsd: costUsd ?? undefined },
          });

          await recordChatMetric({
            nowMs: Date.now(),
            mode,
            status: 200,
            latencyMs: Date.now() - startTime,
          });

          return NextResponse.json(
            {
              ok: false,
              mode,
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

    // COACH response
    {
      log("info", {
        event: "chat_completed",
        requestId,
        auth0Sub,
        orgId,
        sessionId: sessionIdForLog,
        mode,
        durationMs: Date.now() - startTime,
        model,
        openaiLatencyMs,
        openaiErrorCode,
        retryCount,
        tokenUsage: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        eurCost: costEur ?? undefined,
        reviewUnits: 0,
        meta: { costUsd: costUsd ?? undefined },
      });

      await recordChatMetric({
        nowMs: Date.now(),
        mode,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          ok: true,
          mode,
          reply: coachText ?? "No reply returned",
          coach: coachParsed,
          sessionId,
          creditsCharged,
          creditsRemaining,
          usage: { promptTokens, completionTokens, totalTokens },
          rate: rateMeta,
        },
        { status: 200, headers: responseHeaders(requestId, rateMeta ?? undefined) }
      );
    }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Unknown server error";

    log("error", {
      event: "chat_error",
      requestId,
      auth0Sub: auth0SubForLog,
      orgId,
      sessionId: sessionIdForLog,
      mode: modeForLog === "coach" || modeForLog === "review" ? modeForLog : undefined,
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
      mode: modeForLog,
      status: 500,
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Server error",
        details: errMsg,
        ...(rateMeta ? { rate: rateMeta } : {}),
      },
      { status: 500, headers: responseHeaders(requestId, rateMeta ?? undefined) }
    );
  }
}