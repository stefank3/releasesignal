// lib/chat/artifact.ts
import { Prisma } from "@prisma/client";

export type RefinedRequirement = {
  objective?: string;
  context?: string;
  inScope?: string[];
  outOfScope?: string[];
  integrations?: string[];
  riskFocus?: string[];
  acceptanceCriteria?: string[];
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;
};

export function isGuidedClarificationAnswer(message: string): boolean {
  const t = message.toLowerCase();
  return (
    t.includes("objective:") ||
    t.includes("primary risk:") ||
    t.includes("integrations:") ||
    t.includes("constraints:") ||
    t.includes("scope:") ||
    t.includes("success criteria:")
  );
}

export function parseGuidedAnswerToRefinedRequirement(message: string): Partial<RefinedRequirement> | null {
  const raw = String(message ?? "").replace(/\r/g, "");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const getValueAfterPrefix = (prefix: string) => {
    const lowPrefix = prefix.toLowerCase();
    for (const l of lines) {
      const idx = l.toLowerCase().indexOf(lowPrefix);
      if (idx === 0) return l.slice(prefix.length).trim().replace(/^[-–—:\s]+/, "").trim();
    }
    return "";
  };

  const objective = getValueAfterPrefix("Objective:");
  const primaryRisk = getValueAfterPrefix("Primary Risk:");
  const integrationsRaw = getValueAfterPrefix("Integrations:");
  const constraintsRaw = getValueAfterPrefix("Constraints:");
  const scopeRaw = getValueAfterPrefix("Scope:");
  const successRaw = getValueAfterPrefix("Success Criteria:");

  const splitList = (v: string): string[] => {
    const t = v.trim();
    if (!t) return [];
    const parts = t
      .split(/,|\s\/\s|\s\|\s/g)
      .map((p) => p.trim())
      .filter(Boolean);
    return Array.from(new Set(parts)).slice(0, 12);
  };

  const inScope: string[] = [];
  const outOfScope: string[] = [];

  if (scopeRaw) {
    const t = scopeRaw.toLowerCase();
    const inIdx = t.indexOf("in:");
    const outIdx = t.indexOf("out:");

    if (inIdx >= 0) {
      const inPart = scopeRaw.slice(inIdx + 3);
      const inPartCut = outIdx >= 0 ? inPart.slice(0, Math.max(0, outIdx - (inIdx + 3))) : inPart;
      inScope.push(...splitList(inPartCut));
    }

    if (outIdx >= 0) {
      const outPart = scopeRaw.slice(outIdx + 4);
      outOfScope.push(...splitList(outPart));
    }

    if (inScope.length === 0 && outOfScope.length === 0) inScope.push(scopeRaw.trim().slice(0, 240));
  }

  const partial: Partial<RefinedRequirement> = {};
  if (objective) partial.objective = objective.slice(0, 240);
  if (constraintsRaw) partial.context = constraintsRaw.slice(0, 600);
  if (inScope.length) partial.inScope = inScope;
  if (outOfScope.length) partial.outOfScope = outOfScope;

  const integrations = splitList(integrationsRaw);
  if (integrations.length) partial.integrations = integrations;

  const riskFocus = splitList(primaryRisk);
  if (riskFocus.length) partial.riskFocus = riskFocus;

  if (successRaw) partial.acceptanceCriteria = [successRaw.trim().slice(0, 240)];

  return Object.keys(partial).length ? partial : null;
}

export function mergeArtifact(existing: SessionArtifact | null, patch: Partial<RefinedRequirement>): SessionArtifact {
  const prev: SessionArtifact = existing && typeof existing === "object" ? existing : {};
  const prevRR: RefinedRequirement =
    prev.refinedRequirement && typeof prev.refinedRequirement === "object" ? prev.refinedRequirement : {};

  const dedupe = (arr: string[]) => Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));

  const nextRR: RefinedRequirement = {
    ...prevRR,
    ...(patch.objective ? { objective: patch.objective } : {}),
    ...(patch.context ? { context: patch.context } : {}),
    ...(patch.inScope?.length ? { inScope: dedupe([...(prevRR.inScope ?? []), ...patch.inScope]) } : {}),
    ...(patch.outOfScope?.length ? { outOfScope: dedupe([...(prevRR.outOfScope ?? []), ...patch.outOfScope]) } : {}),
    ...(patch.integrations?.length ? { integrations: dedupe([...(prevRR.integrations ?? []), ...patch.integrations]) } : {}),
    ...(patch.riskFocus?.length ? { riskFocus: dedupe([...(prevRR.riskFocus ?? []), ...patch.riskFocus]) } : {}),
    ...(patch.acceptanceCriteria?.length
      ? { acceptanceCriteria: dedupe([...(prevRR.acceptanceCriteria ?? []), ...patch.acceptanceCriteria]) }
      : {}),
  };

  return { refinedRequirement: nextRR };
}

export function artifactToContextText(artifact: SessionArtifact): string {
  const rr = artifact.refinedRequirement ?? {};
  const lines: string[] = ["REFINED REQUIREMENT (pinned):"];

  if (rr.objective) lines.push(`- Objective: ${rr.objective}`);
  if (rr.context) lines.push(`- Context/Constraints: ${rr.context}`);

  if (rr.inScope?.length) {
    lines.push("- In scope:");
    for (const s of rr.inScope.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.outOfScope?.length) {
    lines.push("- Out of scope:");
    for (const s of rr.outOfScope.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.integrations?.length) lines.push(`- Integrations: ${rr.integrations.slice(0, 12).join(", ")}`);
  if (rr.riskFocus?.length) lines.push(`- Risk focus: ${rr.riskFocus.slice(0, 12).join(", ")}`);

  if (rr.acceptanceCriteria?.length) {
    lines.push("- Acceptance criteria:");
    for (const a of rr.acceptanceCriteria.slice(0, 12)) lines.push(`  - ${a}`);
  }

  return lines.join("\n");
}

export function prismaJsonValue(artifact: SessionArtifact): Prisma.InputJsonValue {
  return artifact as unknown as Prisma.InputJsonValue;
}