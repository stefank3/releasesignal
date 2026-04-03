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

function buildBusinessRules(args: {
  requirement: RequirementLike;
  objective: string | null;
  functionalScope: string[];
  acceptanceCriteria: string[];
  riskAreas: string[];
}): string[] {
  const explicitRules = toTrimmedStringArray(args.requirement.businessRules, 12);
  if (explicitRules.length) return explicitRules;

  const out: string[] = [];

  for (const criterion of args.acceptanceCriteria) {
    const text = criterion.replace(/\.$/, "").trim();
    if (!text) continue;

    if (/must|only|shall|cannot|should not|do not|does not|prevent/i.test(text)) {
      appendUnique(out, text, 12);
      continue;
    }

    if (/retry/i.test(text)) {
      appendUnique(out, "Retry behavior must remain bounded and respect configured retry limits.", 12);
    }

    if (/duplicate|idempot/i.test(text)) {
      appendUnique(out, "Duplicate or repeated processing must not create duplicate downstream side effects.", 12);
    }

    if (/fulfillment/i.test(text) && /payment|email/i.test(text)) {
      appendUnique(
        out,
        "Fulfillment updates must occur only after successful upstream payment and email steps.",
        12
      );
    }

    if (/log/i.test(text)) {
      appendUnique(out, "Failures, retries, and final outcomes must be logged accurately.", 12);
    }
  }

  for (const scopeItem of args.functionalScope) {
    if (/payment/i.test(scopeItem)) {
      appendUnique(out, "Order processing must halt when payment validation fails.", 12);
    }
    if (/email/i.test(scopeItem)) {
      appendUnique(out, "Confirmation email must be sent only once per successful order.", 12);
    }
    if (/fulfillment/i.test(scopeItem)) {
      appendUnique(
        out,
        "Fulfillment status must reflect the final validated order state across systems.",
        12
      );
    }
  }

  if (
    args.riskAreas.some((risk) =>
      /duplicate|idempot|inconsistent|partial failure|retry/i.test(risk)
    )
  ) {
    appendUnique(
      out,
      "Cross-system state must remain consistent across retries, duplicates, and partial failures.",
      12
    );
  }

  if (!out.length && args.objective) {
    appendUnique(
      out,
      `System behavior must satisfy the stated objective: ${args.objective.replace(/\.$/, "")}.`,
      12
    );
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
  );
  if (explicit.length) return explicit;

  const out: string[] = [];

  for (const risk of args.riskAreas) {
    const text = risk.replace(/\.$/, "").trim();
    if (!text) continue;

    if (/duplicate/i.test(text)) {
      appendUnique(out, "Duplicate request or duplicate side-effect attempt is received.", 12);
    } else if (/retry|transient/i.test(text)) {
      appendUnique(out, "Transient integration failure triggers retry behavior.", 12);
    } else if (/fulfillment|partial|inconsistent/i.test(text)) {
      appendUnique(out, "Partial downstream failure occurs after an upstream step succeeds.", 12);
    } else if (/resource exhaustion|infinite retry/i.test(text)) {
      appendUnique(out, "Retry path exceeds safe limits and must stop without entering an infinite loop.", 12);
    } else {
      appendUnique(out, text, 12);
    }
  }

  for (const criterion of args.acceptanceCriteria) {
    if (/transient/i.test(criterion)) {
      appendUnique(out, "Transient payment validation failure occurs during order processing.", 12);
    }
    if (/duplicate email/i.test(criterion) || /multiple emails/i.test(criterion)) {
      appendUnique(out, "Duplicate email send attempt is made during retry or replay.", 12);
    }
    if (/fulfillment/i.test(criterion) && /payment|email/i.test(criterion)) {
      appendUnique(
        out,
        "Fulfillment update is attempted before payment or email completion.",
        12
      );
    }
  }

  if (args.functionalScope.some((item) => /payment/i.test(item))) {
    appendUnique(out, "External payment provider is unavailable or returns transient failure.", 12);
  }

  if (args.functionalScope.some((item) => /email/i.test(item))) {
    appendUnique(out, "Confirmation email service fails or retries unexpectedly.", 12);
  }

  if (args.functionalScope.some((item) => /fulfillment|warehouse/i.test(item))) {
    appendUnique(out, "Warehouse service returns delayed or out-of-order fulfillment update.", 12);
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
  );
  if (explicit.length) return explicit;

  const out: string[] = [];

  if (args.context && /consistent state|cross-system|across systems/i.test(args.context)) {
    appendUnique(out, "Cross-system state transitions must remain consistent across payment, email, and fulfillment flows.", 12);
  }

  if (args.integrations.length) {
    appendUnique(out, "External integration failures must be observable through reliable logging and failure tracking.", 12);
  }

  if (args.riskAreas.some((risk) => /resource exhaustion|retry/i.test(risk))) {
    appendUnique(out, "Retry behavior must remain bounded to avoid retry storms and resource exhaustion.", 12);
  }

  if (args.riskAreas.some((risk) => /inconsistent|partial|data inconsistenc/i.test(risk))) {
    appendUnique(out, "Asynchronous processing must preserve data integrity and final state consistency.", 12);
  }

  if (args.riskAreas.some((risk) => /duplicate|idempot/i.test(risk))) {
    appendUnique(out, "Idempotency controls must prevent duplicate downstream side effects.", 12);
  }

  appendUnique(out, "System logs must accurately capture failures, retries, and final outcomes.", 12);

  return out.slice(0, 12);
}

function buildCoverageTargets(args: {
  acceptanceCriteria: string[];
  riskAreas: string[];
  functionalScope: string[];
  edgeCasesNegativePaths: string[];
}): string[] {
  const out: string[] = [];

  for (const criterion of args.acceptanceCriteria) {
    const text = criterion.replace(/\.$/, "").trim();
    if (!text) continue;

    if (/payment/i.test(text) && /retry|transient/i.test(text)) {
      appendUnique(out, "Transient payment failure and recovery path", 8);
    } else if (/duplicate email|multiple emails|email/i.test(text) && /duplicate|idempot/i.test(text)) {
      appendUnique(out, "Duplicate email suppression and idempotency path", 8);
    } else if (/fulfillment/i.test(text)) {
      appendUnique(out, "Fulfillment sequencing and final state consistency", 8);
    } else if (/log/i.test(text)) {
      appendUnique(out, "Logging and retry outcome traceability", 8);
    } else if (/retry limit|infinite retry/i.test(text)) {
      appendUnique(out, "Retry limit enforcement path", 8);
    }
  }

  for (const risk of args.riskAreas) {
    if (/resource exhaustion|infinite retry/i.test(risk)) {
      appendUnique(out, "Retry storm and bounded-retry protection", 8);
    }
    if (/inconsistent|partial|data inconsistenc/i.test(risk)) {
      appendUnique(out, "Partial-failure consistency checks", 8);
    }
  }

  if (!out.length) {
    for (const scopeItem of args.functionalScope) {
      if (/payment/i.test(scopeItem)) appendUnique(out, "Payment validation flow", 8);
      if (/email/i.test(scopeItem)) appendUnique(out, "Email confirmation flow", 8);
      if (/fulfillment|warehouse/i.test(scopeItem)) {
        appendUnique(out, "Fulfillment update flow", 8);
      }
    }
  }

  if (!out.length && args.edgeCasesNegativePaths.length) {
    appendUnique(out, "Negative-path and failure-handling coverage", 8);
  }

  return out.slice(0, 8);
}

function buildMinimalReproScenarios(args: {
  requirement: RequirementLike;
  edgeCasesNegativePaths: string[];
  acceptanceCriteria: string[];
}): string[] {
  const explicit = buildMinimalRepro(args.requirement);
  if (explicit.length) return explicit;

  const out: string[] = [];

  for (const item of args.edgeCasesNegativePaths) {
    const text = item.replace(/\.$/, "").trim();
    if (!text) continue;

    if (/payment/i.test(text) && /transient|retry|failure|timeout/i.test(text)) {
      appendUnique(out, "Force transient payment validation failure and verify bounded retry then success or stop.", 8);
    } else if (/duplicate email|email/i.test(text) && /duplicate|retry/i.test(text)) {
      appendUnique(out, "Force duplicate email send attempt and verify suppression of duplicate email output.", 8);
    } else if (/fulfillment|partial|inconsistent/i.test(text)) {
      appendUnique(out, "Force partial downstream failure and verify final fulfillment state remains consistent.", 8);
    } else {
      appendUnique(out, text, 8);
    }
  }

  for (const criterion of args.acceptanceCriteria) {
    if (/retry limit|infinite retry/i.test(criterion)) {
      appendUnique(out, "Exhaust retry limit and verify loop terminates with logged final outcome.", 8);
    }
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
  );
  if (explicit.length) return explicit;

  const out: string[] = [];

  if (args.integrations.length) {
    appendUnique(out, "Which integration failures are classified as transient versus non-transient?", 8);
  }

  if (args.riskAreas.some((risk) => /retry|resource exhaustion/i.test(risk))) {
    appendUnique(out, "What are the configured retry limits and backoff policy for each integration?", 8);
  }

  if (args.riskAreas.some((risk) => /duplicate|idempot/i.test(risk))) {
    appendUnique(out, "What idempotency or deduplication mechanism is used for payment, email, and fulfillment steps?", 8);
  }

  if (args.coverageTargets.some((target) => /consistency|partial-failure/i.test(target.toLowerCase()))) {
    appendUnique(out, "What final order state is expected when downstream failure occurs after payment succeeds?", 8);
  }

  return out.slice(0, 8);
}

function normalizeRequirementLike(
  requirement: RequirementLike
): NormalizedRefinedRequirement | null {
  const objective = toOptionalText(requirement.objective);
  const context = toOptionalText(requirement.context);

  const functionalScope = mergeUnique(
    [
      toTrimmedStringArray(requirement.functionalScope, 12),
      toTrimmedStringArray(requirement.inScope, 12),
    ],
    12
  );

  const acceptanceCriteria = toTrimmedStringArray(
    requirement.acceptanceCriteria,
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

  const integrations = toTrimmedStringArray(requirement.integrations, 8);

  const businessRules = buildBusinessRules({
    requirement,
    objective,
    functionalScope,
    acceptanceCriteria,
    riskAreas,
  });

  const edgeCasesNegativePaths = buildEdgeCasesNegativePaths({
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

  const coverageTargets = mergeUnique(
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
  );

  const minimalReproScenarios = buildMinimalReproScenarios({
    requirement,
    edgeCasesNegativePaths,
    acceptanceCriteria,
  });

  const openQuestionsClarifications = buildOpenQuestionsClarifications({
    requirement,
    integrations,
    riskAreas,
    coverageTargets,
  });

  const signalCount =
    (objective ? 1 : 0) +
    (functionalScope.length > 0 ? 1 : 0) +
    (businessRules.length > 0 ? 1 : 0) +
    (acceptanceCriteria.length > 0 ? 1 : 0) +
    (edgeCasesNegativePaths.length > 0 ? 1 : 0) +
    (nonFunctionalConstraints.length > 0 ? 1 : 0) +
    (riskAreas.length > 0 ? 1 : 0) +
    (coverageTargets.length > 0 ? 1 : 0) +
    (minimalReproScenarios.length > 0 ? 1 : 0);

  // M12.12 guard:
  // reject weak payloads so malformed ingestion does not silently persist.
  if (!objective || signalCount < 5) {
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