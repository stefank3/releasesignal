// lib/server/chat/coachFormatting.ts
// M10 extraction:
// Coach-mode formatting and continuity helpers moved out of route.ts
// so the API route stays focused on orchestration.

import { parseGuidedAnswerToRefinedRequirement } from "@/lib/chat/artifact";
import type { SessionArtifact } from "@/lib/chat/artifact";
import type { CoachResult } from "@/lib/framework/reviewSchema";

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

function pushListSection(lines: string[], title: string, values?: string[], max = 12): void {
  if (!Array.isArray(values) || values.length === 0) return;

  const cleaned = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, max);

  if (cleaned.length === 0) return;

  lines.push(title);
  for (const value of cleaned) {
    lines.push(`- ${value}`);
  }
  lines.push("");
}

/**
 * Lightweight artifact enrichment for Strategy continuity.
 * Keeps refined requirement evolving across free-text prompts.
 */
export function buildCoachContinuityArtifactPatch(args: {
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

  const acceptanceCriteria = uniqueNonEmpty(
    [
      ...(existing?.acceptanceCriteria ?? []),
      ...args.coach.highSignalApproach.testIdeas
        .filter(Boolean)
        .slice(0, 6)
        .map((idea) => idea.trim()),
    ],
    12
  );

  const functionalScope = uniqueNonEmpty(
    [
      ...(existing?.functionalScope ?? []),
      ...(existing?.inScope ?? []),
      ...args.coach.highSignalApproach.goals
        .filter(Boolean)
        .slice(0, 6)
        .map((goal) => goal.trim()),
    ],
    12
  );

  const riskAreas = uniqueNonEmpty(
    [
      ...(existing?.riskAreas ?? []),
      ...(existing?.riskFocus ?? []),
      ...args.coach.riskMatrix.map((r) => r.risk),
    ],
    12
  );

  const edgeCases = uniqueNonEmpty(
    [
      ...(existing?.edgeCases ?? []),
      ...(args.coach.highSignalApproach.minimalRepro ?? []),
    ],
    12
  );

  const patch = {
    objective: objective || undefined,
    context: nextContext || existing?.context || undefined,

    // legacy compatibility
    inScope: existing?.inScope ?? [],
    outOfScope: existing?.outOfScope ?? [],
    integrations: existing?.integrations ?? [],
    riskFocus: uniqueNonEmpty([...(existing?.riskFocus ?? []), ...riskAreas], 12),

    // locked M12.8 fields
    functionalScope,
    businessRules: existing?.businessRules ?? [],
    acceptanceCriteria,
    edgeCases,
    riskAreas,
  };

  const hasMeaningfulPatch =
    !!patch.objective ||
    !!patch.context ||
    patch.inScope.length > 0 ||
    patch.outOfScope.length > 0 ||
    patch.integrations.length > 0 ||
    patch.riskFocus.length > 0 ||
    patch.functionalScope.length > 0 ||
    patch.businessRules.length > 0 ||
    patch.acceptanceCriteria.length > 0 ||
    patch.edgeCases.length > 0 ||
    patch.riskAreas.length > 0;

  return hasMeaningfulPatch ? patch : null;
}

/**
 * Preserve exploratory coach response for early / loose prompts.
 */
export function coachToText(coach: CoachResult): string {
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
 * M12.8 review validation lock:
 * Render the refined requirement ONLY from persisted artifact fields.
 *
 * Why:
 * - deterministic review must operate on the artifact contract, not coach prose
 * - legacy coach fallbacks were allowing non-canonical strategy content to appear
 *   as a "Refined Technical Requirement"
 * - visible requirement output must match the same source of truth used by review
 *
 * NOTE:
 * We intentionally keep the coach argument in the signature for compatibility with
 * existing call sites, but it is no longer used here.
 */
export function coachToTechnicalRequirementText(
  _coach: CoachResult,
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
  }

  if (rr?.context?.trim()) {
    lines.push("Context / Constraints:");
    lines.push(rr.context.trim());
    lines.push("");
  }

  const functionalScope =
    rr?.functionalScope?.length ? rr.functionalScope : rr?.inScope;
  const riskAreas =
    rr?.riskAreas?.length ? rr.riskAreas : rr?.riskFocus;

  pushListSection(lines, "Functional Scope:", functionalScope);
  pushListSection(lines, "Business Rules:", rr?.businessRules);
  pushListSection(lines, "Acceptance Criteria:", rr?.acceptanceCriteria);
  pushListSection(lines, "Edge Cases / Negative Paths:", rr?.edgeCases);
  pushListSection(lines, "Risk Areas:", riskAreas);

  return lines.join("\n").trim();
}
/**
 * Artifact is meaningful only if at least one refinedRequirement field has content.
 */
export function coachToTechnicalRequirementText(
  _coach: CoachResult,
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
  }

  if (rr?.context?.trim()) {
    lines.push("Context / Constraints:");
    lines.push(rr.context.trim());
    lines.push("");
  }

  const functionalScope =
    rr?.functionalScope?.length ? rr.functionalScope : rr?.inScope;
  const riskAreas =
    rr?.riskAreas?.length ? rr.riskAreas : rr?.riskFocus;

  pushListSection(lines, "Functional Scope:", functionalScope);
  pushListSection(lines, "Business Rules:", rr?.businessRules);
  pushListSection(lines, "Acceptance Criteria:", rr?.acceptanceCriteria);
  pushListSection(lines, "Edge Cases / Negative Paths:", rr?.edgeCases);
  pushListSection(lines, "Risk Areas:", riskAreas);

  return lines.join("\n").trim();
}
/**
 * M12.8 lock:
 * Return technical requirement text only when a meaningful refined requirement
 * artifact actually exists.
 *
 * guidedAnswer by itself is not enough, because that can still occur before the
 * artifact is in a stable canonical shape.
 */
export function shouldReturnTechnicalRequirement(args: {
  guidedAnswer: boolean;
  artifact: SessionArtifact | null;
}): boolean {
  return hasMeaningfulRefinedRequirement(args.artifact);
}