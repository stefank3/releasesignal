// lib/chat/artifact.ts
// Shared structured artifact contract for chat session state.
//
// Architectural rule:
// platform behavior should rely on structured artifacts, not rendered assistant text.
//
// M11 NOTE:
// This file is a key telemetry source because it defines the structured objects
// that telemetry can safely reference:
// - refinedRequirement
// - testSuite
//
// From this contract we can derive telemetry metadata such as:
// - artifact version
// - suite size
// - whether a suite already existed
// - whether a requirement has structured sections
//
// M12 CHANGE:
// - add optional persisted review artifact support
// - add optional feature-centric workspace wrapper
// - keep existing top-level refinedRequirement + testSuite backward compatible

import { Prisma } from "@prisma/client";

export type ReviewBreakdown = {
  businessRelevance: number;
  riskCoverage: number;
  designQuality: number;
  levelAndScope: number;
  diagnosticValue: number;
};

export type PersistedReviewResult = {
  score: number;
  verdict: string;
  breakdown: ReviewBreakdown;
  riskGaps: string[];
  antiPatterns: string[];
  improvements: string[];
};

export type RefinedRequirement = {
  objective?: string;
  context?: string;
  inScope?: string[];
  outOfScope?: string[];
  integrations?: string[];
  riskFocus?: string[];
  acceptanceCriteria?: string[];
};

// M9 CHANGE: persistent test case model for evolving suites.
// M12 CHANGE: add optional structured/editable fields without breaking old usage.
export type TestCase = {
  id: string; // e.g. TC-001
  title: string; // short title used for continuity + duplicate avoidance
  body: string; // full rendered case text

  // M12 foundation:
  // optional structured fields for future editable suite behavior.
  priority?: "P0" | "P1" | "P2";
  type?: "UI" | "API" | "Integration" | "E2E";
  preconditions?: string[];
  steps?: string[];
  expectedResults?: string[];
  tags?: string[];
  edited?: boolean;
  notes?: string;
};

// M9 CHANGE: suite artifact stored inside ChatSession.artifactJson.
//
// M11 NOTE:
// version + cases.length are telemetry-friendly fields.
// They let us measure suite evolution without parsing rendered output.
export type TestSuiteArtifact = {
  version: number;
  cases: TestCase[];
  createdAt: string;
  lastUpdatedAt: string;
};

// M12:
// Feature-centric grouping wrapper.
// This is optional for now so current top-level artifact access remains valid.
export type FeatureWorkspaceArtifact = {
  featureTitle?: string;
  refinedRequirement?: RefinedRequirement;
  testSuite?: TestSuiteArtifact;
  reviewResult?: PersistedReviewResult;
  lastUpdatedAt?: string;
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;

  // M9 CHANGE: optional test suite state for incremental Cases mode.
  // M11 NOTE: this is the structured source of truth for suite telemetry.
  testSuite?: TestSuiteArtifact;

  // M12 CHANGE: persisted review result for design/review consistency.
  reviewResult?: PersistedReviewResult;

  // M12 CHANGE: optional feature-centric grouping wrapper.
  featureWorkspace?: FeatureWorkspaceArtifact;
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
      if (idx === 0) {
        return l.slice(prefix.length).trim().replace(/^[-–—:\s]+/, "").trim();
      }
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

    // Fallback behavior:
    // if no explicit "in:" / "out:" markers were found, keep the raw scope
    // as a compact in-scope statement rather than losing the content.
    if (inScope.length === 0 && outOfScope.length === 0) {
      inScope.push(scopeRaw.trim().slice(0, 240));
    }
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
    ...(patch.integrations?.length
      ? { integrations: dedupe([...(prevRR.integrations ?? []), ...patch.integrations]) }
      : {}),
    ...(patch.riskFocus?.length ? { riskFocus: dedupe([...(prevRR.riskFocus ?? []), ...patch.riskFocus]) } : {}),
    ...(patch.acceptanceCriteria?.length
      ? { acceptanceCriteria: dedupe([...(prevRR.acceptanceCriteria ?? []), ...patch.acceptanceCriteria]) }
      : {}),
  };

  return {
    refinedRequirement: nextRR,

    // M9 CHANGE: preserve existing testSuite when refinedRequirement is updated.
    // M11 NOTE: this prevents telemetry context from being lost when only the
    // requirement artifact is being updated.
    ...(prev.testSuite ? { testSuite: prev.testSuite } : {}),

    // M12 CHANGE: preserve persisted review + feature workspace when requirement updates.
    ...(prev.reviewResult ? { reviewResult: prev.reviewResult } : {}),
    ...(prev.featureWorkspace ? { featureWorkspace: prev.featureWorkspace } : {}),
  };
}

// M9 CHANGE: helper for future Cases-mode incremental behavior.
// Safe no-op for old sessions that do not yet have a suite.
//
// M11 NOTE:
// This helper should be used anywhere telemetry needs reliable suite access.
export function getTestSuite(artifact: SessionArtifact | null | undefined): TestSuiteArtifact | null {
  const suite = artifact?.testSuite;

  if (!suite || typeof suite !== "object") return null;
  if (!Array.isArray(suite.cases)) return null;
  if (typeof suite.version !== "number") return null;
  if (typeof suite.createdAt !== "string") return null;
  if (typeof suite.lastUpdatedAt !== "string") return null;

  return suite;
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

  // M9 CHANGE: include compact test suite context only when it exists.
  // This is useful for future incremental generation prompts.
  //
  // M11 NOTE:
  // This text is presentation/context support only.
  // Telemetry must still use the structured suite object directly.
  const suite = getTestSuite(artifact);
  if (suite) {
    lines.push("");
    lines.push(`TEST SUITE (pinned): v${suite.version}, total cases: ${suite.cases.length}`);

    if (suite.cases.length) {
      lines.push("- Existing test case titles:");
      for (const c of suite.cases.slice(0, 50)) {
        lines.push(`  - ${c.id}: ${c.title}`);
      }
    }
  }

  if (artifact.reviewResult) {
    lines.push("");
    lines.push(`LATEST REVIEW (pinned): score ${artifact.reviewResult.score}/100`);
    lines.push(`- Verdict: ${artifact.reviewResult.verdict}`);
  }

  return lines.join("\n");
}

export function prismaJsonValue(artifact: SessionArtifact): Prisma.InputJsonValue {
  // Central helper for writing structured session artifacts into Prisma Json fields.
  return artifact as unknown as Prisma.InputJsonValue;
}