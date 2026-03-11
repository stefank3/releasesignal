// lib/server/chat/coachFormatting.ts
// M10 extraction:
// Coach-mode formatting and continuity helpers moved out of route.ts
// so the API route stays focused on orchestration.

import type { SessionArtifact } from "@/lib/chat/artifact";
import type { CoachResult } from "@/lib/framework/reviewSchema";
import { parseGuidedAnswerToRefinedRequirement } from "@/lib/chat/artifact";

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
 * Refined coach reply rendered as a reusable technical requirement artifact.
 */
export function coachToTechnicalRequirementText(
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
 * Artifact is meaningful only if at least one refinedRequirement field has content.
 */
export function hasMeaningfulRefinedRequirement(
  artifact: SessionArtifact | null
): boolean {
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

export function shouldReturnTechnicalRequirement(args: {
  guidedAnswer: boolean;
  artifact: SessionArtifact | null;
}): boolean {
  return args.guidedAnswer || hasMeaningfulRefinedRequirement(args.artifact);
}