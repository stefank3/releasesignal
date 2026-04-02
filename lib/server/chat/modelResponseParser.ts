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

import { extractJsonObject } from "@/lib/chat/json";
import { repairJsonOnce } from "@/lib/chat/repair";
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

function appendUnique(target: string[], value: string | null, max: number): void {
  if (!value) return;
  if (target.length >= max) return;

  const key = value.toLowerCase();
  const seen = new Set(target.map((item) => item.toLowerCase()));
  if (seen.has(key)) return;

  target.push(value);
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

function normalizeRequirementLike(
  requirement: RequirementLike
): NormalizedRefinedRequirement | null {
  const objective = toOptionalText(requirement.objective);

  const functionalScope = mergeUnique(
    [
      toTrimmedStringArray(requirement.functionalScope, 12),
      toTrimmedStringArray(requirement.inScope, 12),
    ],
    12
  );

  const businessRules = toTrimmedStringArray(requirement.businessRules, 12);
  const acceptanceCriteria = toTrimmedStringArray(
    requirement.acceptanceCriteria,
    12
  );

  const edgeCasesNegativePaths = mergeUnique(
    [
      toTrimmedStringArray(requirement.edgeCases, 12),
      toTrimmedStringArray(requirement.negativePaths, 12),
    ],
    12
  );

  const nonFunctionalConstraints = mergeUnique(
    [
      toTrimmedStringArray(requirement.nonFunctionalConstraints, 12),
      toTrimmedStringArray(requirement.constraints, 12),
    ],
    12
  );

  const rawHooks =
    requirement.testStrategyHooks &&
    typeof requirement.testStrategyHooks === "object"
      ? (requirement.testStrategyHooks as Record<string, unknown>)
      : null;

  const riskAreas = mergeUnique(
    [
      toTrimmedStringArray(rawHooks?.riskAreas, 8),
      toTrimmedStringArray(requirement.riskAreas, 8),
      toTrimmedStringArray(requirement.riskFocus, 8),
    ],
    8
  );

  const coverageTargets = mergeUnique(
    [
      toTrimmedStringArray(rawHooks?.coverageTargets, 8),
      toTrimmedStringArray(requirement.coverageTargets, 8),
    ],
    8
  );

  const minimalReproScenarios = buildMinimalRepro(requirement);

  const openQuestionsClarifications = mergeUnique(
    [
      toTrimmedStringArray(requirement.openQuestions, 8),
      toTrimmedStringArray(requirement.clarifications, 8),
    ],
    8
  );

  const signalCount =
    (objective ? 1 : 0) +
    (functionalScope.length > 0 ? 1 : 0) +
    (businessRules.length > 0 ? 1 : 0) +
    (acceptanceCriteria.length > 0 ? 1 : 0) +
    (edgeCasesNegativePaths.length > 0 ? 1 : 0) +
    (nonFunctionalConstraints.length > 0 ? 1 : 0) +
    (riskAreas.length > 0 || coverageTargets.length > 0 ? 1 : 0);

  // M12.12 guard:
  // reject weak payloads so malformed ingestion does not silently persist.
  if (!objective || signalCount < 3) {
    return null;
  }

  return {
    objective,
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
    openQuestionsClarifications,
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

    return normalizeRequirementLike(parsed);
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

export async function parseCoachResponse(
  rawReply: string
): Promise<CoachResult | null> {
  let coachObj = parseCoachPayload(rawReply);
  if (coachObj) return coachObj;

  const repairedRaw = await repairJsonOnce({ mode: "coach", raw: rawReply });
  coachObj = parseCoachPayload(repairedRaw);

  return coachObj;
}

export async function parseRefinedRequirementResponse(
  rawReply: string
): Promise<NormalizedRefinedRequirement | null> {
  let requirementObj = parseRefinedRequirementPayload(rawReply);
  if (requirementObj) return requirementObj;

  const repairedRaw = await repairJsonOnce({ mode: "coach", raw: rawReply });
  requirementObj = parseRefinedRequirementPayload(repairedRaw);

  return requirementObj;
}