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
  type TestCase,
  type TestSuiteArtifact,
  isGuidedClarificationAnswer,
  parseGuidedAnswerToRefinedRequirement,
  mergeArtifact,
  artifactToContextText,
  prismaJsonValue,
  getTestSuite,
} from "@/lib/chat/artifact";

import { repairJsonOnce } from "@/lib/chat/repair";
import { loadOrCreateSession, refreshArtifact } from "@/lib/chat/sessionStore";
import {
  persistUserMessageIdempotent,
  persistAssistantWithBillingTx,
  InsufficientCreditsError,
} from "@/lib/chat/persist";

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

function uniqueNonEmpty(values: Array<string | null | undefined>, max = 24): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const value = String(raw ?? "").trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(value);

    if (out.length >= max) break;
  }

  return out;
}

/**
 * CHANGE (M8.7):
 * Very lightweight artifact enrichment for Strategy continuity.
 *
 * Goal:
 * - keep the Refined Requirement evolving across Strategy prompts
 * - avoid backend contract changes
 * - preserve existing guided-answer merge behavior
 *
 * Notes:
 * - guided structured answers are still the strongest artifact update path
 * - this helper adds continuity value for normal free-text refinements
 */
function buildCoachContinuityArtifactPatch(args: {
  existingArtifact: SessionArtifact | null;
  coach: CoachResult;
  latestUserMessage: string;
  guidedAnswer: boolean;
  weakInput: boolean;
}): ReturnType<typeof parseGuidedAnswerToRefinedRequirement> | null {
  const existing = args.existingArtifact?.refinedRequirement;
  const latestMessage = args.latestUserMessage.trim();

  const existingContext =
    typeof existing?.context === "string" ? existing.context.trim() : "";

  let nextContext = existingContext;

  const shouldAppendLatestMessage =
    !args.guidedAnswer &&
    !args.weakInput &&
    latestMessage.length > 0 &&
    latestMessage.length <= 600 &&
    !existingContext.toLowerCase().includes(latestMessage.toLowerCase());

  if (shouldAppendLatestMessage) {
    nextContext = nextContext
      ? `${nextContext}\n\nLatest refinement: ${latestMessage}`
      : latestMessage;
  }

  const objective =
    (typeof existing?.objective === "string" && existing.objective.trim()) ||
    args.coach.highSignalApproach.goals[0] ||
    "";

  const riskFocus = uniqueNonEmpty(
    [...(existing?.riskFocus ?? []), ...args.coach.riskMatrix.map((r) => r.risk)],
    12
  );

  const patch = {
    objective: objective || undefined,
    context: nextContext || existing?.context || undefined,
    inScope: existing?.inScope ?? [],
    outOfScope: existing?.outOfScope ?? [],
    integrations: existing?.integrations ?? [],
    riskFocus,
    acceptanceCriteria: existing?.acceptanceCriteria ?? [],
  };

  const hasMeaningfulPatch =
    !!patch.objective ||
    !!patch.context ||
    patch.inScope.length > 0 ||
    patch.outOfScope.length > 0 ||
    patch.integrations.length > 0 ||
    patch.riskFocus.length > 0 ||
    patch.acceptanceCriteria.length > 0;

  return hasMeaningfulPatch ? patch : null;
}

/**
 * M9 CHANGE:
 * Normalize titles for lightweight duplicate filtering during beta.
 * We intentionally keep this simple for now:
 * - case-insensitive
 * - punctuation-insensitive
 * - whitespace-normalized
 */
function normalizeCaseTitle(title: string): string {
  return String(title ?? "")
    .toLowerCase()
    .replace(/^tc-\d{1,4}\s*[-–:]\s*/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * M9 CHANGE:
 * Parse generated plain-text test cases from the model reply.
 * Expected format starts each case with:
 *   TC-001 - Title
 * or
 *   TC-001: Title
 */
function parseGeneratedTestCases(text: string): Array<{ title: string; body: string }> {
  const raw = String(text ?? "").replace(/\r/g, "").trim();
  if (!raw) return [];

  const matches = [...raw.matchAll(/^\s*TC-(\d{1,4})\s*[-–:]\s*(.+)$/gim)];
  if (!matches.length) return [];

  const out: Array<{ title: string; body: string }> = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;

    const block = raw.slice(start, end).trim();
    const title = String(match[2] ?? "").trim();

    if (!title || !block) continue;
    out.push({ title, body: block });
  }

  return out;
}

/**
 * M9 CHANGE:
 * Rebuild a case body so numbering is deterministic even if the model returns
 * a wrong or repeated TC id.
 */
function buildNormalizedCaseBody(caseId: string, title: string, rawBody: string): string {
  const cleaned = String(rawBody ?? "").replace(/\r/g, "").trim();
  const lines = cleaned.split("\n");
  const normalizedHeader = `${caseId} - ${title}`;

  if (lines.length === 0) return normalizedHeader;

  if (/^\s*TC-\d{1,4}\s*[-–:]\s*/i.test(lines[0] ?? "")) {
    lines[0] = normalizedHeader;
    return lines.join("\n").trim();
  }

  return `${normalizedHeader}\n${cleaned}`.trim();
}

/**
 * M9 CHANGE:
 * Build a compact existing-suite baseline directly from the persisted artifact.
 * This replaces the old "scan prior assistant messages" approach.
 */
function buildExistingSuiteBaselineFromArtifact(suite: TestSuiteArtifact | null): {
  suiteSummary: string | null;
  maxCaseNumber: number;
  existingCount: number;
} {
  if (!suite?.cases?.length) {
    return {
      suiteSummary: null,
      maxCaseNumber: 0,
      existingCount: 0,
    };
  }

  const headers = suite.cases.map((c) => `${c.id} - ${c.title}`);
  const maxCaseNumber = suite.cases.reduce((max, c) => {
    const match = /^TC-(\d{1,4})$/i.exec(String(c.id ?? "").trim());
    const n = match ? Number(match[1]) : 0;
    return Math.max(max, n);
  }, 0);

  return {
    suiteSummary: headers.join("\n"),
    maxCaseNumber,
    existingCount: suite.cases.length,
  };
}

/**
 * M9 CHANGE:
 * Merge newly generated cases into the persisted suite.
 *
 * Rules:
 * - explicit regeneration -> replace suite with v1
 * - continuation -> append only new unique titles
 * - numbering is always rebuilt from next available id
 * - version increments only when new unique cases were actually added
 */
function mergeGeneratedCasesIntoSuite(args: {
  existingSuite: TestSuiteArtifact | null;
  generatedText: string;
  explicitReset: boolean;
}): {
  nextSuite: TestSuiteArtifact | null;
  addedCount: number;
} {
  const parsed = parseGeneratedTestCases(args.generatedText);
  if (!parsed.length) {
    return {
      nextSuite: args.explicitReset ? null : args.existingSuite,
      addedCount: 0,
    };
  }

  const nowIso = new Date().toISOString();

  if (args.explicitReset || !args.existingSuite) {
    const freshCases: TestCase[] = parsed.map((c, idx) => {
      const caseId = `TC-${String(idx + 1).padStart(3, "0")}`;
      return {
        id: caseId,
        title: c.title,
        body: buildNormalizedCaseBody(caseId, c.title, c.body),
      };
    });

    return {
      nextSuite: {
        version: 1,
        cases: freshCases,
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
      },
      addedCount: freshCases.length,
    };
  }

  const existingSuite = args.existingSuite;
  const existingKeys = new Set(existingSuite.cases.map((c) => normalizeCaseTitle(c.title)));

  let nextNumber = existingSuite.cases.reduce((max, c) => {
    const match = /^TC-(\d{1,4})$/i.exec(String(c.id ?? "").trim());
    const n = match ? Number(match[1]) : 0;
    return Math.max(max, n);
  }, 0) + 1;

  const appended: TestCase[] = [];

  for (const generated of parsed) {
    const key = normalizeCaseTitle(generated.title);
    if (!key) continue;
    if (existingKeys.has(key)) continue;

    const caseId = `TC-${String(nextNumber).padStart(3, "0")}`;
    nextNumber += 1;
    existingKeys.add(key);

    appended.push({
      id: caseId,
      title: generated.title,
      body: buildNormalizedCaseBody(caseId, generated.title, generated.body),
    });
  }

  if (!appended.length) {
    return {
      nextSuite: existingSuite,
      addedCount: 0,
    };
  }

  return {
    nextSuite: {
      ...existingSuite,
      version: existingSuite.version + 1,
      cases: [...existingSuite.cases, ...appended],
      lastUpdatedAt: nowIso,
    },
    addedCount: appended.length,
  };
}

/**
 * M9 CHANGE:
 * Preserve refinedRequirement while writing back an updated test suite.
 */
function withUpdatedTestSuiteArtifact(
  existingArtifact: SessionArtifact | null,
  testSuite: TestSuiteArtifact
): SessionArtifact {
  const prev: SessionArtifact =
    existingArtifact && typeof existingArtifact === "object" ? existingArtifact : {};

  return {
    ...(prev.refinedRequirement ? { refinedRequirement: prev.refinedRequirement } : {}),
    testSuite,
  };
}

/**
 * M9 CHANGE:
 * Render the persisted suite for the user instead of only the delta.
 * This makes the workspace feel persistent and versioned.
 */
function renderTestSuiteForUser(suite: TestSuiteArtifact): string {
  const lines: string[] = [];

  lines.push(`Test Suite v${suite.version}`);
  lines.push(`Total test cases: ${suite.cases.length}`);
  lines.push("");

  for (let i = 0; i < suite.cases.length; i++) {
    lines.push(suite.cases[i].body.trim());
    if (i < suite.cases.length - 1) lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * CHANGE (M7.6):
 * Keep a normal exploratory coach response for early / loose prompts.
 * This preserves the original "QA coach" feel before the requirement is refined.
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
  for (const g of coach.highSignalApproach.goals.slice(0, 6)) lines.push(`- ${g}`);

  lines.push("Test ideas:");
  for (const t of coach.highSignalApproach.testIdeas.slice(0, 12)) lines.push(`- ${t}`);

  if (coach.highSignalApproach.minimalRepro?.length) {
    lines.push("Minimal repro (optional):");
    for (const s of coach.highSignalApproach.minimalRepro.slice(0, 8)) lines.push(`- ${s}`);
  }

  if (coach.optionalClarifications?.length) {
    lines.push("");
    lines.push("Optional clarifications:");
    for (const q of coach.optionalClarifications.slice(0, 3)) lines.push(`- ${q}`);
  }

  return lines.join("\n");
}

/**
 * CHANGE (M7.6):
 * Refined coach responses should look like a reusable technical requirement artifact.
 * This is the format the user can copy into Cases mode.
 *
 * CHANGE (M8 final polish):
 * Optional clarifications are appended to the visible reply text instead of being returned
 * only as separate suggestions payloads.
 */
function coachToTechnicalRequirementText(
  coach: CoachResult,
  artifact: SessionArtifact | null
): string {
  const lines: string[] = [];
  const rr = artifact?.refinedRequirement;

  lines.push("Refined Technical Requirement");
  lines.push("");

  if (rr?.objective?.trim()) {
    lines.push("Objective:");
    lines.push(rr.objective.trim());
    lines.push("");
  } else if (coach.highSignalApproach.goals[0]) {
    lines.push("Objective:");
    lines.push(coach.highSignalApproach.goals[0]);
    lines.push("");
  }

  if (rr?.context?.trim()) {
    lines.push("Context / Constraints:");
    lines.push(rr.context.trim());
    lines.push("");
  } else if (coach.assumptions.length) {
    lines.push("Context / Assumptions:");
    for (const a of coach.assumptions.slice(0, 6)) lines.push(`- ${a}`);
    lines.push("");
  }

  if (rr?.inScope?.length) {
    lines.push("In Scope:");
    for (const s of rr.inScope.slice(0, 12)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (rr?.outOfScope?.length) {
    lines.push("Out of Scope:");
    for (const s of rr.outOfScope.slice(0, 12)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (rr?.integrations?.length) {
    lines.push("Integrations:");
    for (const s of rr.integrations.slice(0, 12)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (rr?.acceptanceCriteria?.length) {
    lines.push("Acceptance Criteria:");
    for (const s of rr.acceptanceCriteria.slice(0, 12)) lines.push(`- ${s}`);
    lines.push("");
  }

  lines.push("Primary Risk Focus:");
  if (rr?.riskFocus?.length) {
    for (const s of rr.riskFocus.slice(0, 12)) lines.push(`- ${s}`);
  } else {
    for (const r of coach.riskMatrix.slice(0, 6)) {
      lines.push(`- ${r.risk} (Likelihood: ${r.likelihood}, Impact: ${r.impact})`);
    }
  }
  lines.push("");

  lines.push("Recommended Test Strategy:");
  for (const g of coach.highSignalApproach.goals.slice(0, 6)) lines.push(`- ${g}`);
  lines.push("");

  lines.push("High-Signal Test Ideas:");
  for (const t of coach.highSignalApproach.testIdeas.slice(0, 12)) lines.push(`- ${t}`);
  lines.push("");

  if (coach.highSignalApproach.minimalRepro?.length) {
    lines.push("Minimal Repro / Diagnostic Path:");
    for (const s of coach.highSignalApproach.minimalRepro.slice(0, 8)) lines.push(`- ${s}`);
    lines.push("");
  }

  if (coach.optionalClarifications?.length) {
    lines.push("Optional Clarifications:");
    for (const q of coach.optionalClarifications.slice(0, 3)) lines.push(`- ${q}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * CHANGE (M7):
 * Do not inject empty artifact context.
 * We only consider the artifact "meaningful" if it has at least one non-empty field.
 */
function hasMeaningfulRefinedRequirement(artifact: SessionArtifact | null): boolean {
  const rr = artifact?.refinedRequirement;
  if (!rr) return false;

  const hasText = (v?: string) => typeof v === "string" && v.trim().length > 0;
  const hasList = (v?: string[]) =>
    Array.isArray(v) && v.some((x) => String(x ?? "").trim().length > 0);

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

/**
 * CHANGE (M7.6):
 * Refined requirement format should be the normal response AFTER refinement,
 * not for every early exploratory coach reply.
 */
function shouldReturnTechnicalRequirement(args: {
  guidedAnswer: boolean;
  artifact: SessionArtifact | null;
}): boolean {
  return args.guidedAnswer || hasMeaningfulRefinedRequirement(args.artifact);
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