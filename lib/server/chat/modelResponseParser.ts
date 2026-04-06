// lib/server/chat/modelResponseParser.ts
// M10 extraction:
// Centralize model response parsing and one-pass repair logic for
// coach and review modes so route.ts stays focused on orchestration.
//
// M12.8 review validation:
// Accept both:
// 1) legacy CoachResult JSON
// 2) locked refined-requirement JSON
//
// Why:
// Strategy is being moved away from the old QA-advisor structure.
// During migration, parser must remain deterministic and compatible.
// This adapter lets upstream prompt/output evolve without breaking
// downstream flow that still expects CoachResult.
//
// M12.13 execution intelligence:
// - add deterministic execution-shaped payload parsing
// - normalize execution input into structured execution artifact shape
// - reject malformed/incomplete execution input explicitly
// - keep parser responsibility limited to extraction/validation only

import { extractJsonObject } from "@/lib/chat/json";
import { repairJsonOnce } from "@/lib/chat/repair";
import {
  normalizeExecutionCaseResult,
  normalizeExecutionCaseStatus,
  normalizeExecutionIntelligenceArtifact,
  normalizeExecutionSource,
  normalizeExecutionSuiteStatus,
  type ExecutionCaseResult,
  type ExecutionIntelligenceArtifact,
} from "@/lib/chat/artifact";
import {
  isCoachResult,
  isReviewResult,
  type CoachResult,
  type ReviewResult,
} from "@/lib/framework/reviewSchema";

type RequirementLike = {
  objective?: unknown;
  context?: unknown;
  constraints?: unknown;
  assumptions?: unknown;
  inScope?: unknown;
  outOfScope?: unknown;
  integrations?: unknown;
  acceptanceCriteria?: unknown;
  businessRules?: unknown;
  edgeCases?: unknown;
  negativePaths?: unknown;
  riskFocus?: unknown;
  openQuestions?: unknown;
  clarifications?: unknown;
};

type ExecutionCaseLike = {
  caseId?: unknown;
  id?: unknown;
  testCaseId?: unknown;
  title?: unknown;
  name?: unknown;
  status?: unknown;
  outcome?: unknown;
  result?: unknown;
  observedAt?: unknown;
  timestamp?: unknown;
  source?: unknown;
  durationMs?: unknown;
  duration?: unknown;
  errorMessage?: unknown;
  error?: unknown;
  rawOutcome?: unknown;
  externalCaseRef?: unknown;
  externalCaseName?: unknown;
};

type ExecutionPayloadLike = {
  source?: unknown;
  provider?: unknown;
  framework?: unknown;
  suiteVersion?: unknown;
  runId?: unknown;
  runLabel?: unknown;
  observedAt?: unknown;
  timestamp?: unknown;
  suiteStatus?: unknown;
  status?: unknown;
  caseResults?: unknown;
  results?: unknown;
};

function toTrimmedStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const text = String(item ?? "").trim();
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(text);

    if (out.length >= max) break;
  }

  return out;
}

function toOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function toOptionalFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRequirementLike(value: unknown): value is RequirementLike {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  return Boolean(
    obj.objective ||
      obj.acceptanceCriteria ||
      obj.businessRules ||
      obj.edgeCases ||
      obj.negativePaths ||
      obj.inScope ||
      obj.outOfScope ||
      obj.integrations ||
      obj.riskFocus
  );
}

function isExecutionPayloadLike(value: unknown): value is ExecutionPayloadLike {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  return Boolean(
    obj.caseResults ||
      obj.results ||
      obj.suiteStatus ||
      obj.status ||
      obj.runId ||
      obj.runLabel ||
      obj.source ||
      obj.provider ||
      obj.framework ||
      obj.suiteVersion
  );
}

function buildRiskMatrix(requirement: RequirementLike): CoachResult["riskMatrix"] {
  const riskFocus = toTrimmedStringArray(requirement.riskFocus, 8);

  return riskFocus.map((risk) => ({
    risk,
    likelihood: "Medium",
    impact: "Medium",
    mitigation: "Cover with explicit validation and targeted negative tests",
  }));
}

function buildGoals(requirement: RequirementLike): string[] {
  const objective = toOptionalText(requirement.objective);
  const inScope = toTrimmedStringArray(requirement.inScope, 6);
  const acceptanceCriteria = toTrimmedStringArray(requirement.acceptanceCriteria, 6);

  const goals: string[] = [];

  if (objective) goals.push(objective);

  for (const scopeItem of inScope) {
    goals.push(`Validate in-scope behavior: ${scopeItem}`);
    if (goals.length >= 6) break;
  }

  for (const criterion of acceptanceCriteria) {
    goals.push(`Prove acceptance criterion: ${criterion}`);
    if (goals.length >= 6) break;
  }

  return goals.slice(0, 6);
}

function buildTestIdeas(requirement: RequirementLike): string[] {
  const acceptanceCriteria = toTrimmedStringArray(requirement.acceptanceCriteria, 8);
  const businessRules = toTrimmedStringArray(requirement.businessRules, 8);
  const edgeCases = toTrimmedStringArray(requirement.edgeCases, 6);
  const negativePaths = toTrimmedStringArray(requirement.negativePaths, 6);

  const out: string[] = [];

  for (const item of acceptanceCriteria) out.push(`Test acceptance flow: ${item}`);
  for (const item of businessRules) out.push(`Validate business rule: ${item}`);
  for (const item of edgeCases) out.push(`Cover edge case: ${item}`);
  for (const item of negativePaths) out.push(`Cover negative path: ${item}`);

  return out.slice(0, 12);
}

function buildMinimalRepro(requirement: RequirementLike): string[] {
  const negativePaths = toTrimmedStringArray(requirement.negativePaths, 4);
  const edgeCases = toTrimmedStringArray(requirement.edgeCases, 4);

  return [...negativePaths, ...edgeCases].slice(0, 8);
}

function buildAssumptions(requirement: RequirementLike): string[] {
  const out: string[] = [];

  const context = toOptionalText(requirement.context);
  const constraints = toOptionalText(requirement.constraints);

  if (context) out.push(context);
  if (constraints) out.push(constraints);

  out.push(...toTrimmedStringArray(requirement.assumptions, 6));
  out.push(...toTrimmedStringArray(requirement.outOfScope, 4).map((x) => `Out of scope: ${x}`));
  out.push(...toTrimmedStringArray(requirement.integrations, 4).map((x) => `Integration: ${x}`));

  return out.slice(0, 6);
}

function buildOptionalClarifications(requirement: RequirementLike): string[] {
  const openQuestions = toTrimmedStringArray(requirement.openQuestions, 3);
  const clarifications = toTrimmedStringArray(requirement.clarifications, 3);

  return [...openQuestions, ...clarifications].slice(0, 3);
}

function requirementToCoachResult(requirement: RequirementLike): CoachResult {
  return {
    assumptions: buildAssumptions(requirement),
    riskMatrix: buildRiskMatrix(requirement),
    highSignalApproach: {
      goals: buildGoals(requirement),
      testIdeas: buildTestIdeas(requirement),
      minimalRepro: buildMinimalRepro(requirement),
    },
    optionalClarifications: buildOptionalClarifications(requirement),
  };
}

function parseCoachPayload(txt: string): CoachResult | null {
  try {
    const parsed = JSON.parse(extractJsonObject(txt)) as unknown;

    if (isCoachResult(parsed)) {
      return parsed as CoachResult;
    }

    if (isRequirementLike(parsed)) {
      const adapted = requirementToCoachResult(parsed);
      return isCoachResult(adapted) ? adapted : null;
    }

    return null;
  } catch {
    return null;
  }
}

function buildExecutionCaseResult(raw: ExecutionCaseLike): ExecutionCaseResult | null {
  const caseId = toOptionalText(raw.caseId ?? raw.id ?? raw.testCaseId);
  const status = toOptionalText(raw.status ?? raw.outcome ?? raw.result);
  const observedAt = toOptionalText(raw.observedAt ?? raw.timestamp);
  const source = toOptionalText(raw.source);

  if (!caseId || !status || !observedAt) {
    return null;
  }

  return normalizeExecutionCaseResult({
  caseId,
  status: normalizeExecutionCaseStatus(status),
  observedAt,
  source: normalizeExecutionSource(source ?? "unknown"),
    ...(toOptionalText(raw.externalCaseRef)
      ? { externalCaseRef: String(raw.externalCaseRef).trim() }
      : {}),
    ...(toOptionalText(raw.externalCaseName ?? raw.title ?? raw.name)
      ? {
          externalCaseName: String(
            raw.externalCaseName ?? raw.title ?? raw.name
          ).trim(),
        }
      : {}),
    ...(toOptionalFiniteNumber(raw.durationMs ?? raw.duration) != null
      ? { durationMs: Number(toOptionalFiniteNumber(raw.durationMs ?? raw.duration)) }
      : {}),
    ...(toOptionalText(raw.errorMessage ?? raw.error)
      ? { errorMessage: String(raw.errorMessage ?? raw.error).trim() }
      : {}),
    ...(toOptionalText(raw.rawOutcome ?? raw.outcome ?? raw.result)
      ? { rawOutcome: String(raw.rawOutcome ?? raw.outcome ?? raw.result).trim() }
      : {}),
  });
}

function parseExecutionPayload(txt: string): ExecutionIntelligenceArtifact | null {
  try {
    const parsed = JSON.parse(extractJsonObject(txt)) as unknown;
    if (!isExecutionPayloadLike(parsed)) return null;

    const payload = parsed as ExecutionPayloadLike;
    const rawResults = Array.isArray(payload.caseResults)
      ? payload.caseResults
      : Array.isArray(payload.results)
        ? payload.results
        : null;

    if (!rawResults || rawResults.length === 0) {
      return null;
    }

    const normalizedResults = rawResults
      .map((item) =>
        item && typeof item === "object"
          ? buildExecutionCaseResult(item as ExecutionCaseLike)
          : null
      )
      .filter((item): item is ExecutionCaseResult => item !== null);

    if (normalizedResults.length === 0) {
      return null;
    }

    if (normalizedResults.length !== rawResults.length) {
      return null;
    }

    const observedAt =
      toOptionalText(payload.observedAt ?? payload.timestamp) ??
      normalizedResults[0]?.observedAt ??
      null;

    if (!observedAt) {
      return null;
    }

    const suiteVersion = toOptionalFiniteNumber(payload.suiteVersion);
    const source = normalizeExecutionSource(
      String(payload.source ?? payload.provider ?? payload.framework ?? "unknown")
    );
    const suiteStatus = normalizeExecutionSuiteStatus(
      String(payload.suiteStatus ?? payload.status ?? "unknown")
    );

    const artifact: ExecutionIntelligenceArtifact = normalizeExecutionIntelligenceArtifact({
      source,
      suiteVersion: suiteVersion != null ? suiteVersion : null,
      ...(toOptionalText(payload.runId) ? { runId: String(payload.runId).trim() } : {}),
      ...(toOptionalText(payload.runLabel)
        ? { runLabel: String(payload.runLabel).trim() }
        : {}),
      observedAt,
      suiteStatus,
      caseResults: normalizedResults,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        blocked: 0,
        timedOut: 0,
        unknown: 0,
      },
    });

    if (!artifact.caseResults.length) {
      return null;
    }

    return artifact;
  } catch {
    return null;
  }
}

export async function parseReviewResponse(rawReply: string): Promise<{
  reviewObj: ReviewResult | null;
  reviewStoredJson: string | null;
  repaired: boolean;
}> {
  const tryParse = (txt: string): ReviewResult | null => {
    try {
      const parsed = JSON.parse(extractJsonObject(txt)) as unknown;
      return isReviewResult(parsed) ? (parsed as ReviewResult) : null;
    } catch {
      return null;
    }
  };

  let reviewObj = tryParse(rawReply);
  let repaired = false;

  if (!reviewObj) {
    const repairedRaw = await repairJsonOnce({ mode: "review", raw: rawReply });
    reviewObj = tryParse(repairedRaw);
    repaired = !!reviewObj;
  }

  return {
    reviewObj,
    reviewStoredJson: reviewObj ? JSON.stringify(reviewObj) : null,
    repaired,
  };
}

export async function parseCoachResponse(rawReply: string): Promise<CoachResult | null> {
  let coachObj = parseCoachPayload(rawReply);
  if (coachObj) return coachObj;

  const repairedRaw = await repairJsonOnce({ mode: "coach", raw: rawReply });
  coachObj = parseCoachPayload(repairedRaw);

  return coachObj;
}

export async function parseExecutionResponse(rawReply: string): Promise<{
  executionObj: ExecutionIntelligenceArtifact | null;
  executionStoredJson: string | null;
  repaired: boolean;
}> {
  let executionObj = parseExecutionPayload(rawReply);
  let repaired = false;

  if (!executionObj) {
    const repairedRaw = await repairJsonOnce({ mode: "coach", raw: rawReply });
    executionObj = parseExecutionPayload(repairedRaw);
    repaired = !!executionObj;
  }

  return {
    executionObj,
    executionStoredJson: executionObj ? JSON.stringify(executionObj) : null,
    repaired,
  };
}