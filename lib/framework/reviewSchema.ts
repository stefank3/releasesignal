/**
 * Review mode output contract.
 * The model MUST return JSON matching this shape (or we repair it).
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
 * Always structured, immediate value first.
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

export type CoachResult = {
  assumptions: string[];
  riskMatrix: CoachRisk[];
  highSignalApproach: CoachApproach;
  optionalClarifications: string[]; // MUST be <= 3 (server truncates defensively)
};

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

export function isCoachResult(x: unknown): x is CoachResult {
  if (typeof x !== "object" || x === null) return false;

  const r = x as Record<string, unknown>;
  const hs = r.highSignalApproach as Record<string, unknown> | undefined;

  if (!Array.isArray(r.assumptions)) return false;
  if (!Array.isArray(r.riskMatrix)) return false;
  if (typeof hs !== "object" || hs === null) return false;
  if (!Array.isArray(hs.goals) || !Array.isArray(hs.testIdeas)) return false;
  if (!Array.isArray(r.optionalClarifications)) return false;

  // riskMatrix item shape check (shallow but useful)
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

  return true;
}
