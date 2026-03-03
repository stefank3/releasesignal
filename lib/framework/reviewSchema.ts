// lib/framework/reviewSchema.ts

/**
 * Review mode output contract.
 *
 * WHY: Review mode is machine-checked and scorecard-rendered.
 * The model MUST return JSON matching this shape (or we repair it server-side).
 */
export type ReviewBreakdown = {
  businessRelevance: number; // 0-25
  riskCoverage: number; // 0-25
  designQuality: number; // 0-20
  levelAndScope: number; // 0-15
  diagnosticValue: number; // 0-15
};

export type ReviewResult = {
  score: number; // 0-100
  verdict: string; // e.g. "Weak – risk gaps present"
  breakdown: ReviewBreakdown;
  riskGaps: string[];
  antiPatterns: string[];
  improvements: string[];
};

/**
 * ✅ Coach mode output contract (Milestone 5).
 *
 * WHY: Coach mode returns structured guidance that the UI can safely render.
 * It is not a bulk test-case generator.
 */
export type RiskLevel = "Low" | "Med" | "High";

export type CoachRisk = {
  risk: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  mitigation: string;
};

export type CoachApproach = {
  goals: string[];
  testIdeas: string[];
  minimalRepro?: string[];
};

/**
 * M7.4: Guided Strategy Interaction payload (optional).
 * WHY: When coach asks clarifying questions, the API can include guided reply suggestions
 * that the UI renders as selectable chips + a structured response template.
 *
 * HARD RULES:
 * - Optional field (no DB migrations required).
 * - Not required for CoachResult validity; used only to enhance UX.
 */
export type CoachSuggestions = {
  groups: { label: string; type: "single" | "multi"; options: string[] }[];
  template: string;
};

export type CoachResult = {
  assumptions: string[];
  riskMatrix: CoachRisk[];
  highSignalApproach: CoachApproach;
  optionalClarifications: string[]; // MUST be <= 3 (server truncates defensively)

  // M7.4 (new): optional suggestions to guide clarification answers in Strategy mode.
  // NOTE: The model does NOT need to output this. The API can attach it.
  suggestions?: CoachSuggestions;
};

/**
 * ✅ Cases mode output contract (Milestone 5.1).
 *
 * WHY: Cases mode is contractually required to output *plain text only* (no JSON),
 * in a strict Jira/Xray copy-paste format.
 *
 * IMPORTANT:
 * - Do NOT add a JSON schema for cases.
 * - Do NOT validate it as JSON.
 * - Treat it as an opaque string produced by the model under a strict system prompt.
 */
export type CasesResult = string;

/**
 * Minimal runtime validation to protect UI rendering.
 * (We keep it simple for MVP; later we can add zod.)
 */
export function isReviewResult(x: unknown): x is ReviewResult {
  if (typeof x !== "object" || x === null) return false;

  const r = x as Record<string, unknown>;
  const breakdown = r.breakdown as Record<string, unknown> | undefined;

  return (
    typeof r.score === "number" &&
    typeof r.verdict === "string" &&
    typeof breakdown === "object" &&
    breakdown !== null &&
    typeof breakdown.businessRelevance === "number" &&
    typeof breakdown.riskCoverage === "number" &&
    typeof breakdown.designQuality === "number" &&
    typeof breakdown.levelAndScope === "number" &&
    typeof breakdown.diagnosticValue === "number" &&
    Array.isArray(r.riskGaps) &&
    Array.isArray(r.antiPatterns) &&
    Array.isArray(r.improvements)
  );
}

/**
 * ✅ Coach runtime validation.
 */
function isRiskLevel(x: unknown): x is RiskLevel {
  return x === "Low" || x === "Med" || x === "High";
}

// M7.4: Runtime validation for suggestions (kept permissive + shallow).
// WHY: Suggestions are UX sugar; don't fail coach parsing if suggestions is absent/malformed.
function isCoachSuggestions(x: unknown): x is CoachSuggestions {
  if (typeof x !== "object" || x === null) return false;

  const r = x as Record<string, unknown>;
  if (!Array.isArray(r.groups)) return false;
  if (typeof r.template !== "string") return false;

  for (const g of r.groups) {
    if (typeof g !== "object" || g === null) return false;
    const gg = g as Record<string, unknown>;
    if (typeof gg.label !== "string") return false;
    if (gg.type !== "single" && gg.type !== "multi") return false;
    if (!Array.isArray(gg.options)) return false;
  }

  return true;
}

export function isCoachResult(x: unknown): x is CoachResult {
  if (typeof x !== "object" || x === null) return false;

  const r = x as Record<string, unknown>;
  const hs = r.highSignalApproach as Record<string, unknown> | undefined;

  if (!Array.isArray(r.assumptions)) return false;
  if (!Array.isArray(r.riskMatrix)) return false;
  if (typeof hs !== "object" || hs === null) return false;
  if (!Array.isArray(hs.goals) || !Array.isArray(hs.testIdeas)) return false;
  if (!Array.isArray(r.optionalClarifications)) return false;

  // WHY: Shallow riskMatrix validation catches the common "stringified object" / malformed output failures.
  for (const item of r.riskMatrix) {
    if (typeof item !== "object" || item === null) return false;
    const rm = item as Record<string, unknown>;
    if (typeof rm.risk !== "string") return false;
    if (!isRiskLevel(rm.likelihood)) return false;
    if (!isRiskLevel(rm.impact)) return false;
    if (typeof rm.mitigation !== "string") return false;
  }

  // minimalRepro optional
  if (hs.minimalRepro !== undefined && !Array.isArray(hs.minimalRepro)) return false;

  // M7.4 (new): suggestions optional (do not fail if absent)
  if (r.suggestions !== undefined && !isCoachSuggestions(r.suggestions)) return false;

  return true;
}

/**
 * ✅ Cases runtime validation.
 *
 * WHY: Cases output is NOT JSON by contract; we only validate "string-ness"
 * so UI/API do not accidentally treat it like structured review/coach results.
 */
export function isCasesResult(x: unknown): x is CasesResult {
  return typeof x === "string";
}