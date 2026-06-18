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
// M12.12 CHANGE:
// - add deterministic normalization for requirement-ingestion payloads
// - preserve legacy CoachResult compatibility
// - expose a locked refined-requirement parser for artifact persistence
// - reject weak/malformed normalized requirement payloads
//
// M12.12 FIX:
// - expand partial requirement payloads into the locked section shape
// - derive missing sections deterministically from available requirement content
// - avoid persisting short under-filled refined requirements when enough signals exist
//
// M12.12 CLEANUP PASS:
// - improve deterministic wording quality for derived requirement sections
// - make business rules read like rules instead of transformed acceptance bullets
// - make edge cases and repro scenarios read like concrete scenarios
// - keep behavior deterministic and artifact-driven
//
// M12.13 execution intelligence:
// - add deterministic execution-shaped payload parsing
// - normalize execution input into structured execution artifact shape
// - reject malformed/incomplete execution input explicitly
// - keep parser responsibility limited to extraction/validation only
//
// M12.14 failure classification:
// - accept explicit deterministic failure classification fields from execution input
// - normalize classification into artifact-owned values
// - reject malformed classification values by collapsing them to "unknown"
// - do not infer classifications here; parser only extracts and normalizes

import { extractJsonObject } from "@/lib/chat/json";
import {
  normalizeExecutionCaseResult,
  normalizeExecutionCaseStatus,
  normalizeExecutionIntelligenceArtifact,
  normalizeExecutionSource,
  normalizeExecutionSuiteStatus,
  normalizeFailureClassification,
  normalizeFailureClassificationRule,
  type ExecutionCaseResult,
  type ExecutionIntelligenceArtifact,
} from "@/lib/chat/artifact";
import {
  isCoachResult,
  isReviewResult,
  type CoachResult,
  type ReviewResult,
} from "@/lib/framework/reviewSchema";
import {
  isGenericBusinessRule,
  isNegativeBehaviorText,
  isPositiveCoreText,
  isUnresolvedRequirementText,
  normalizeQualityPhrase,
  normalizeQualitySentence,
  normalizeRequirementQuality,
} from "@/lib/server/chat/requirementQuality";

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
  riskAreas?: unknown;
  coverageTargets?: unknown;
  nonFunctionalConstraints?: unknown;
  functionalScope?: unknown;
  minimalRepro?: unknown;
  minimalReproScenarios?: unknown;
  openQuestions?: unknown;
  clarifications?: unknown;
  testStrategyHooks?: unknown;
};

export type NormalizedRefinedRequirement = {
  objective: string;
  context: string | null;
  inScope: string[];
  outOfScope: string[];
  integrations: string[];
  functionalScope: string[];
  businessRules: string[];
  acceptanceCriteria: string[];
  edgeCasesNegativePaths: string[];
  nonFunctionalConstraints: string[];
  testStrategyHooks: {
    riskAreas: string[];
    coverageTargets: string[];
  };
  minimalReproScenarios: string[];
  openQuestionsClarifications: string[];
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

  // M12.14:
  // Accept explicit deterministic classification keys only.
  failureClassification?: unknown;
  classification?: unknown;
  failureType?: unknown;
  category?: unknown;

  failureClassificationRule?: unknown;
  classificationRule?: unknown;
  rule?: unknown;
  reasonCode?: unknown;
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

async function repairJson(args: {
  mode: "coach" | "review";
  raw: string;
}): Promise<string> {
  const { repairJsonOnce } = await import("@/lib/chat/repair");
  return repairJsonOnce(args);
}

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

const normalizeSentence = normalizeQualitySentence;
const normalizePhrase = normalizeQualityPhrase;

function appendUnique(target: string[], value: string | null, max: number): void {
  if (!value) return;
  if (target.length >= max) return;

  const cleaned = normalizeSentence(value);
  if (!cleaned) return;

  const key = cleaned.toLowerCase();
  const seen = new Set(target.map((item) => item.toLowerCase()));
  if (seen.has(key)) return;

  target.push(cleaned);
}

function appendUniqueRaw(target: string[], value: string | null, max: number): void {
  if (!value) return;
  if (target.length >= max) return;

  const cleaned = normalizePhrase(value);
  if (!cleaned) return;

  const key = cleaned.toLowerCase();
  const seen = new Set(target.map((item) => item.toLowerCase()));
  if (seen.has(key)) return;

  target.push(cleaned);
}

function mergeUnique(values: Array<string[]>, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const group of values) {
    for (const item of group) {
      const text = String(item ?? "").trim();
      if (!text) continue;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      out.push(text);

      if (out.length >= max) return out;
    }
  }

  return out;
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
      obj.riskFocus ||
      obj.functionalScope ||
      obj.nonFunctionalConstraints ||
      obj.testStrategyHooks
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
  const riskFocus = mergeUnique(
    [
      toTrimmedStringArray(requirement.riskFocus, 8),
      toTrimmedStringArray(requirement.riskAreas, 8),
    ],
    8
  );

  return riskFocus.map((risk) => ({
    risk,
    likelihood: "Medium",
    impact: "Medium",
    mitigation: "Cover with explicit validation and targeted negative tests",
  }));
}

function buildGoals(requirement: RequirementLike): string[] {
  const objective = toOptionalText(requirement.objective);
  const inScope = mergeUnique(
    [
      toTrimmedStringArray(requirement.inScope, 6),
      toTrimmedStringArray(requirement.functionalScope, 6),
    ],
    6
  );
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
  return mergeUnique(
    [
      toTrimmedStringArray(requirement.minimalRepro, 8),
      toTrimmedStringArray(requirement.minimalReproScenarios, 8),
      toTrimmedStringArray(requirement.negativePaths, 4),
      toTrimmedStringArray(requirement.edgeCases, 4),
    ],
    8
  );
}

function buildAssumptions(requirement: RequirementLike): string[] {
  const out: string[] = [];

  const context = toOptionalText(requirement.context);
  const constraints = toOptionalText(requirement.constraints);

  if (context) out.push(context);
  if (constraints) out.push(constraints);

  out.push(...toTrimmedStringArray(requirement.assumptions, 6));
  out.push(
    ...toTrimmedStringArray(requirement.outOfScope, 4).map(
      (x) => `Out of scope: ${x}`
    )
  );
  out.push(
    ...toTrimmedStringArray(requirement.integrations, 4).map(
      (x) => `Integration: ${x}`
    )
  );

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

function buildBusinessRules(args: {
  requirement: RequirementLike;
  objective: string | null;
  functionalScope: string[];
  acceptanceCriteria: string[];
  riskAreas: string[];
}): string[] {
  const explicitRules = toTrimmedStringArray(args.requirement.businessRules, 12)
    .map((item) => normalizeSentence(item))
    .filter((item) => item && !isGenericBusinessRule(item));

  if (explicitRules.length) {
    return Array.from(new Set(explicitRules.map((item) => item.trim()))).slice(0, 12);
  }

  const out: string[] = [];

  for (const criterion of args.acceptanceCriteria) {
    const text = normalizePhrase(criterion);
    if (!text) continue;

    if (/must|only|shall|cannot|should not|do not|does not/i.test(text)) {
      appendUnique(out, text, 12);
    }
  }

  return out.slice(0, 12);
}

function buildEdgeCasesNegativePaths(args: {
  requirement: RequirementLike;
  acceptanceCriteria: string[];
  riskAreas: string[];
  functionalScope: string[];
}): string[] {
  const explicit = mergeUnique(
    [
      toTrimmedStringArray(args.requirement.edgeCases, 12),
      toTrimmedStringArray(args.requirement.negativePaths, 12),
    ],
    12
  )
    .map((item) => normalizeSentence(item))
    .filter(Boolean);

  if (explicit.length) {
    return explicit.filter(
      (item) => isNegativeBehaviorText(item) && !isPositiveCoreText(item)
    );
  }

  const out: string[] = [];

  for (const risk of args.riskAreas) {
    const text = normalizePhrase(risk);
    if (!text) continue;
    if (!isNegativeBehaviorText(text) || isPositiveCoreText(text)) continue;

    appendUnique(out, text, 12);
  }

  for (const criterion of args.acceptanceCriteria) {
    const text = normalizePhrase(criterion);
    if (!text) continue;

    if (
      /invalid|missing|malformed|duplicate|idempot|retry|transient|failure|error|timeout|forbidden|unauth|boundary|unsupported|conflict|not found/i.test(
        text
      )
    ) {
      appendUnique(out, text, 12);
    }
  }

  return out.slice(0, 12);
}

function buildNonFunctionalConstraints(args: {
  requirement: RequirementLike;
  riskAreas: string[];
  integrations: string[];
  context: string | null;
}): string[] {
  const explicit = mergeUnique(
    [
      toTrimmedStringArray(args.requirement.nonFunctionalConstraints, 12),
      toTrimmedStringArray(args.requirement.constraints, 12),
    ],
    12
  )
    .map((item) => normalizeSentence(item))
    .filter(Boolean);

  if (explicit.length) return explicit;

  return [];
}

function buildCoverageTargets(args: {
  acceptanceCriteria: string[];
  riskAreas: string[];
  functionalScope: string[];
  edgeCasesNegativePaths: string[];
}): string[] {
  const out: string[] = [];

  for (const risk of args.riskAreas) {
    appendUniqueRaw(out, `Risk coverage for: ${risk}`, 8);
  }

  if (!out.length) {
    for (const scopeItem of args.functionalScope) {
      appendUniqueRaw(out, `Scope coverage for: ${scopeItem}`, 8);
    }
  }

  return out.slice(0, 8);
}

function buildMinimalReproScenarios(args: {
  requirement: RequirementLike;
  edgeCasesNegativePaths: string[];
  acceptanceCriteria: string[];
}): string[] {
  const explicit = buildMinimalRepro(args.requirement)
    .map((item) => normalizeSentence(item))
    .filter(Boolean);

  if (explicit.length) return explicit;

  const out: string[] = [];

  for (const item of args.edgeCasesNegativePaths) {
    const text = normalizePhrase(item);
    if (!text) continue;
    if (!isNegativeBehaviorText(text) || isUnresolvedRequirementText(text)) continue;

    appendUnique(out, text, 8);
  }

  return out.slice(0, 8);
}

function buildOpenQuestionsClarifications(args: {
  requirement: RequirementLike;
  integrations: string[];
  riskAreas: string[];
  coverageTargets: string[];
}): string[] {
  const explicit = mergeUnique(
    [
      toTrimmedStringArray(args.requirement.openQuestions, 8),
      toTrimmedStringArray(args.requirement.clarifications, 8),
    ],
    8
  )
    .map((item) => normalizeSentence(item))
    .filter(Boolean);

  if (explicit.length) return explicit;

  return [];
}

export function normalizeRequirementLikeForRegression(
  requirement: RequirementLike
): NormalizedRefinedRequirement | null {
  const objective = toOptionalText(requirement.objective);
  const context = toOptionalText(requirement.context);
  let inScope = toTrimmedStringArray(requirement.inScope, 12);
  const outOfScope = toTrimmedStringArray(requirement.outOfScope, 12);
  const integrations = toTrimmedStringArray(requirement.integrations, 8);

  let functionalScope = mergeUnique(
    [
      toTrimmedStringArray(requirement.functionalScope, 12),
      inScope,
    ],
    12
  );

  let acceptanceCriteria = toTrimmedStringArray(
    requirement.acceptanceCriteria,
    12
  )
    .map((item) => normalizeSentence(item))
    .filter(Boolean);

  const rawHooks =
    requirement.testStrategyHooks &&
    typeof requirement.testStrategyHooks === "object"
      ? (requirement.testStrategyHooks as Record<string, unknown>)
      : null;

  let riskAreas = mergeUnique(
    [
      toTrimmedStringArray(rawHooks?.riskAreas, 8),
      toTrimmedStringArray(requirement.riskAreas, 8),
      toTrimmedStringArray(requirement.riskFocus, 8),
    ],
    8
  )
    .map((item) => normalizePhrase(item))
    .filter(Boolean);

  let businessRules = buildBusinessRules({
    requirement,
    objective,
    functionalScope,
    acceptanceCriteria,
    riskAreas,
  });

  let edgeCasesNegativePaths = buildEdgeCasesNegativePaths({
    requirement,
    acceptanceCriteria,
    riskAreas,
    functionalScope,
  });

  const nonFunctionalConstraints = buildNonFunctionalConstraints({
    requirement,
    riskAreas,
    integrations,
    context,
  });

  const openQuestionsClarifications = buildOpenQuestionsClarifications({
    requirement,
    integrations,
    riskAreas,
    coverageTargets: [],
  });

  const rawCoverageTargets = mergeUnique(
    [
      toTrimmedStringArray(rawHooks?.coverageTargets, 8),
      toTrimmedStringArray(requirement.coverageTargets, 8),
      buildCoverageTargets({
        acceptanceCriteria,
        riskAreas,
        functionalScope,
        edgeCasesNegativePaths,
      }),
    ],
    8
  )
    .map((item) => normalizePhrase(item))
    .filter(Boolean);

  const rawMinimalReproScenarios = buildMinimalReproScenarios({
    requirement,
    edgeCasesNegativePaths,
    acceptanceCriteria,
  });

  const quality = normalizeRequirementQuality({
    inScope,
    functionalScope,
    businessRules,
    acceptanceCriteria,
    edgeCasesNegativePaths,
    riskAreas,
    coverageTargets: rawCoverageTargets,
    minimalReproScenarios: rawMinimalReproScenarios,
    openQuestionsClarifications,
  });

  inScope = quality.inScope;
  functionalScope = quality.functionalScope;
  businessRules = quality.businessRules;
  acceptanceCriteria = quality.acceptanceCriteria;
  edgeCasesNegativePaths = quality.edgeCasesNegativePaths;
  riskAreas = quality.riskAreas;
  const coverageTargets = quality.coverageTargets;
  const minimalReproScenarios = quality.minimalReproScenarios;
  const normalizedOpenQuestionsClarifications =
    quality.openQuestionsClarifications;

  const signalCount =
    (objective ? 1 : 0) +
    (context ? 1 : 0) +
    (outOfScope.length > 0 ? 1 : 0) +
    (integrations.length > 0 ? 1 : 0) +
    (functionalScope.length > 0 ? 1 : 0) +
    (businessRules.length > 0 ? 1 : 0) +
    (acceptanceCriteria.length > 0 ? 1 : 0) +
    (edgeCasesNegativePaths.length > 0 ? 1 : 0) +
    (nonFunctionalConstraints.length > 0 ? 1 : 0) +
    (riskAreas.length > 0 ? 1 : 0) +
    (coverageTargets.length > 0 ? 1 : 0) +
    (minimalReproScenarios.length > 0 ? 1 : 0);

  if (!objective || signalCount < 5) {
    return null;
  }

  return {
    objective: normalizeSentence(objective).replace(/\.$/, ""),
    context,
    inScope,
    outOfScope,
    integrations,
    functionalScope,
    businessRules,
    acceptanceCriteria,
    edgeCasesNegativePaths,
    nonFunctionalConstraints,
    testStrategyHooks: {
      riskAreas,
      coverageTargets,
    },
    minimalReproScenarios,
    openQuestionsClarifications: normalizedOpenQuestionsClarifications,
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

function parseRefinedRequirementPayload(
  txt: string
): NormalizedRefinedRequirement | null {
  try {
    const parsed = JSON.parse(extractJsonObject(txt)) as unknown;
    if (!isRequirementLike(parsed)) return null;
    return normalizeRequirementLikeForRegression(parsed);
  } catch {
    return null;
  }
}

function buildExecutionCaseResult(
  raw: ExecutionCaseLike
): ExecutionCaseResult | null {
  const caseId = toOptionalText(raw.caseId ?? raw.id ?? raw.testCaseId);
  const status = toOptionalText(raw.status ?? raw.outcome ?? raw.result);
  const observedAt = toOptionalText(raw.observedAt ?? raw.timestamp);
  const source = toOptionalText(raw.source);

  if (!caseId || !status || !observedAt) {
    return null;
  }

  const failureClassification = normalizeFailureClassification(
    toOptionalText(
      raw.failureClassification ??
        raw.classification ??
        raw.failureType ??
        raw.category
    )
  );

  const failureClassificationRule = normalizeFailureClassificationRule(
    toOptionalText(
      raw.failureClassificationRule ??
        raw.classificationRule ??
        raw.rule ??
        raw.reasonCode
    )
  );

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
      ? {
          durationMs: Number(
            toOptionalFiniteNumber(raw.durationMs ?? raw.duration)
          ),
        }
      : {}),
    ...(toOptionalText(raw.errorMessage ?? raw.error)
      ? { errorMessage: String(raw.errorMessage ?? raw.error).trim() }
      : {}),
    ...(toOptionalText(raw.rawOutcome ?? raw.outcome ?? raw.result)
      ? { rawOutcome: String(raw.rawOutcome ?? raw.outcome ?? raw.result).trim() }
      : {}),

    // M12.14:
    // Keep classification optional for backward compatibility with M12.13 payloads.
    // Persist explicit values when present; unsupported values normalize to "unknown".
    ...(toOptionalText(
      raw.failureClassification ??
        raw.classification ??
        raw.failureType ??
        raw.category
    )
      ? { failureClassification }
      : {}),
    ...(toOptionalText(
      raw.failureClassificationRule ??
        raw.classificationRule ??
        raw.rule ??
        raw.reasonCode
    )
      ? { failureClassificationRule }
      : {}),
  });
}

function parseExecutionPayload(
  txt: string
): ExecutionIntelligenceArtifact | null {
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

    // Keep M12.13 strictness:
    // every input result must normalize successfully or the payload is rejected.
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

    const artifact: ExecutionIntelligenceArtifact =
      normalizeExecutionIntelligenceArtifact({
        source,
        suiteVersion: suiteVersion != null ? suiteVersion : null,
        ...(toOptionalText(payload.runId)
          ? { runId: String(payload.runId).trim() }
          : {}),
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
    const repairedRaw = await repairJson({ mode: "review", raw: rawReply });
    reviewObj = tryParse(repairedRaw);
    repaired = !!reviewObj;
  }

  return {
    reviewObj,
    reviewStoredJson: reviewObj ? JSON.stringify(reviewObj) : null,
    repaired,
  };
}

export async function parseCoachResponse(
  rawReply: string
): Promise<CoachResult | null> {
  let coachObj = parseCoachPayload(rawReply);
  if (coachObj) return coachObj;

  const repairedRaw = await repairJson({ mode: "coach", raw: rawReply });
  coachObj = parseCoachPayload(repairedRaw);

  return coachObj;
}

export async function parseRefinedRequirementResponse(
  rawReply: string
): Promise<NormalizedRefinedRequirement | null> {
  let requirementObj = parseRefinedRequirementPayload(rawReply);
  if (requirementObj) return requirementObj;

  const repairedRaw = await repairJson({ mode: "coach", raw: rawReply });
  requirementObj = parseRefinedRequirementPayload(repairedRaw);

  return requirementObj;
}

export async function parseExecutionResponse(rawReply: string): Promise<{
  executionObj: ExecutionIntelligenceArtifact | null;
  executionStoredJson: string | null;
  repaired: boolean;
}> {
  let executionObj = parseExecutionPayload(rawReply);
  let repaired = false;

  if (!executionObj) {
    const repairedRaw = await repairJson({ mode: "coach", raw: rawReply });
    executionObj = parseExecutionPayload(repairedRaw);
    repaired = !!executionObj;
  }

  return {
    executionObj,
    executionStoredJson: executionObj ? JSON.stringify(executionObj) : null,
    repaired,
  };
}
