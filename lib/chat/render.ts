// lib/chat/render.ts
import type { CoachResult } from "@/lib/framework/reviewSchema";

export function coachToText(coach: CoachResult): string {
  const lines: string[] = [];

  lines.push("Assumptions:");
  for (const a of coach.assumptions.slice(0, 6)) lines.push(`- ${a}`);

  lines.push("");
  lines.push("Risk matrix:");
  for (const r of coach.riskMatrix.slice(0, 6)) {
    lines.push(`- ${r.risk} (Likelihood: ${r.likelihood}, Impact: ${r.impact}) — Mitigation: ${r.mitigation}`);
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

  return lines.join("\n");
}