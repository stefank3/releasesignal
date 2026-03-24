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
//
// M12 Step 5 CHANGE:
// - add deterministic suite normalization helpers
// - add duplicate signature + validation helpers
// - keep suite intelligence artifact-based and reusable outside UI
//
// BUG FIX (M12.8):
// - align standalone structured requirement parsing to the locked unified QA format
// - support legacy pasted requirement labels used in live review input
// - normalize collapsed section headers before parsing
// - keep guided coach parsing unchanged
// - use explicit label-based extraction only (no AI inference)

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
  // Legacy / compatibility fields.
  objective?: string;
  context?: string;
  inScope?: string[];
  outOfScope?: string[];
  integrations?: string[];
  riskFocus?: string[];

  // Locked unified QA requirement fields for M12.8.
  functionalScope?: string[];
  businessRules?: string[];
  acceptanceCriteria?: string[];
  edgeCases?: string[];
  nonFunctionalConstraints?: string[];
  testStrategyHooks?: string[];
  riskAreas?: string[];
  coverageTargets?: string[];
  minimalReproScenarios?: string[];
  openQuestions?: string[];
};

export type TestCase = {
  id: string;
  title: string;
  body: string;
  priority?: "P0" | "P1" | "P2";
  type?: "UI" | "API" | "Integration" | "E2E";
  preconditions?: string[];
  steps?: string[];
  expectedResults?: string[];
  tags?: string[];
  edited?: boolean;
  notes?: string;
};

export type DuplicateCaseGroup = {
  signature: string;
  ids: string[];
};

export type TestSuiteArtifact = {
  version: number;
  cases: TestCase[];
  createdAt: string;
  lastUpdatedAt: string;
};

export type FeatureWorkspaceArtifact = {
  featureTitle?: string;
  refinedRequirement?: RefinedRequirement;
  testSuite?: TestSuiteArtifact;
  reviewResult?: PersistedReviewResult;
  lastUpdatedAt?: string;
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;
  testSuite?: TestSuiteArtifact;
  reviewResult?: PersistedReviewResult;
  featureWorkspace?: FeatureWorkspaceArtifact;
};

export type TestSuiteValidationResult = {
  duplicateGroups: DuplicateCaseGroup[];
  hasDuplicates: boolean;
  totalCases: number;
};

export function normalizeWhitespace(value: string): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

export function normalizeMultilineText(value: string): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

export function normalizeList(values: string[] | undefined): string[] {
  if (!Array.isArray(values) || values.length === 0) return [];

  return Array.from(
    new Set(values.map((item) => normalizeWhitespace(item)).filter(Boolean))
  );
}

export function normalizeCaseTitle(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[–—]/g, "-")
    .replace(/\s*[:\-–—]\s*/g, " ")
    .toLowerCase();
}

export function buildTestCaseHeader(id: string, title: string): string {
  return `${id}: ${title || "Untitled test case"}`;
}

export function ensureTestCaseBodyConsistency(
  testCase: Pick<TestCase, "id" | "title" | "body">
): string {
  const normalizedBody = normalizeMultilineText(testCase.body);
  const lines = normalizedBody ? normalizedBody.split("\n") : [];
  const header = buildTestCaseHeader(
    String(testCase.id ?? "").toUpperCase(),
    normalizeWhitespace(testCase.title) || "Untitled test case"
  );

  if (!lines.length) return header;

  lines[0] = header;
  return lines.join("\n").trim();
}

export function normalizeTestCase(testCase: TestCase): TestCase {
  const id = String(testCase.id ?? "").trim().toUpperCase();
  const title = normalizeWhitespace(testCase.title) || "Untitled test case";

  return {
    ...testCase,
    id,
    title,
    body: ensureTestCaseBodyConsistency({
      id,
      title,
      body: testCase.body,
    }),
    preconditions: normalizeList(testCase.preconditions),
    steps: normalizeList(testCase.steps),
    expectedResults: normalizeList(testCase.expectedResults),
    tags: normalizeList(testCase.tags),
    notes: testCase.notes ? normalizeMultilineText(testCase.notes) : testCase.notes,
  };
}

export function buildTestCaseSignature(
  testCase: Pick<TestCase, "title" | "body">
): string {
  const normalizedTitle = normalizeCaseTitle(testCase.title);

  const detailLines = normalizeMultilineText(testCase.body)
    .split("\n")
    .slice(1)
    .map((line) => normalizeWhitespace(line).toLowerCase())
    .filter(Boolean)
    .slice(0, 4);

  return [normalizedTitle, ...detailLines].join(" | ");
}

export function findDuplicateTestCases(cases: TestCase[]): DuplicateCaseGroup[] {
  const grouped = new Map<string, string[]>();

  for (const rawCase of cases) {
    const testCase = normalizeTestCase(rawCase);
    const signature = buildTestCaseSignature(testCase);

    if (!signature) continue;

    const existing = grouped.get(signature) ?? [];
    existing.push(testCase.id);
    grouped.set(signature, existing);
  }

  return Array.from(grouped.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([signature, ids]) => ({
      signature,
      ids,
    }));
}

export function validateTestSuite(
  suite: TestSuiteArtifact | null | undefined
): TestSuiteValidationResult {
  const cases = suite?.cases ?? [];
  const duplicateGroups = findDuplicateTestCases(cases);

  return {
    duplicateGroups,
    hasDuplicates: duplicateGroups.length > 0,
    totalCases: cases.length,
  };
}

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

export function parseGuidedAnswerToRefinedRequirement(
  message: string
): Partial<RefinedRequirement> | null {
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
      const inPartCut =
        outIdx >= 0 ? inPart.slice(0, Math.max(0, outIdx - (inIdx + 3))) : inPart;
      inScope.push(...splitList(inPartCut));
    }

    if (outIdx >= 0) {
      const outPart = scopeRaw.slice(outIdx + 4);
      outOfScope.push(...splitList(outPart));
    }

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

export function isStructuredRequirementInput(message: string): boolean {
  const t = String(message ?? "").toLowerCase();

  return (
    t.includes("functional scope:") ||
    t.includes("business rules:") ||
    t.includes("acceptance criteria:") ||
    t.includes("edge cases") ||
    t.includes("non-functional constraints:") ||
    t.includes("test strategy hooks:") ||
    t.includes("risk areas:") ||
    t.includes("coverage targets:") ||
    t.includes("minimal repro scenarios:") ||
    t.includes("open questions") ||
    t.includes("objective:") ||
    t.includes("primary risk:") ||
    t.includes("context / assumptions:") ||
    t.includes("context:") ||
    t.includes("constraints:") ||
    t.includes("scope:") ||
    t.includes("success criteria:") ||
    t.includes("primary risk focus:")
  );
}

function splitStructuredRequirementList(value: string): string[] {
  const raw = normalizeMultilineText(value);
  if (!raw) return [];

  const bulletParts = raw
    .split("\n")
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  const commaParts =
    bulletParts.length === 1
      ? bulletParts[0]
          .split(/,|\s\/\s|\s\|\s/g)
          .map((part) => part.trim())
          .filter(Boolean)
      : bulletParts;

  return Array.from(new Set(commaParts)).slice(0, 20);
}

function splitMessageBeforeFirstTestCase(message: string): string {
  const raw = String(message ?? "").replace(/\r/g, "");
  const match = raw.match(/^\s*TC-\d{3}\s*[:\-–—]/im);

  if (!match || match.index == null) {
    return raw;
  }

  return raw.slice(0, match.index).trim();
}

function normalizeRequirementSectionHeaders(message: string): string {
  const raw = String(message ?? "").replace(/\r/g, "");

  const labels = [
    "Functional Scope:",
    "Business Rules:",
    "Acceptance Criteria:",
    "Edge Cases / Negative Paths:",
    "Edge Cases:",
    "Non-Functional Constraints:",
    "Test Strategy Hooks:",
    "Risk Areas:",
    "Coverage Targets:",
    "Minimal Repro Scenarios:",
    "Open Questions / Clarifications:",
    "Open Questions:",
    "Objective:",
    "Primary Risk:",
    "Context / Assumptions:",
    "Context:",
    "Constraints:",
    "Scope:",
    "Success Criteria:",
    "Primary Risk Focus:",
  ];

  let normalized = raw;

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`([^\\n])\\s+(${escaped})`, "gi");
    normalized = normalized.replace(regex, "$1\n$2");
  }

  return normalized;
}

export function parseStructuredRequirementInput(
  message: string
): Partial<RefinedRequirement> | null {
  const raw = normalizeRequirementSectionHeaders(
    splitMessageBeforeFirstTestCase(message)
  );
  const lines = raw.split("\n");

  const supportedSections = new Map<string, keyof RefinedRequirement>([
    ["functional scope", "functionalScope"],
    ["business rules", "businessRules"],
    ["acceptance criteria", "acceptanceCriteria"],
    ["edge cases / negative paths", "edgeCases"],
    ["edge cases", "edgeCases"],
    ["non-functional constraints", "nonFunctionalConstraints"],
    ["test strategy hooks", "testStrategyHooks"],
    ["risk areas", "riskAreas"],
    ["coverage targets", "coverageTargets"],
    ["minimal repro scenarios", "minimalReproScenarios"],
    ["open questions / clarifications", "openQuestions"],
    ["open questions", "openQuestions"],

    // Legacy labels mapped deterministically into current artifact shape.
    ["objective", "objective"],
    ["primary risk", "riskAreas"],
    ["primary risk focus", "riskAreas"],
    ["context", "context"],
    ["context / assumptions", "nonFunctionalConstraints"],
    ["constraints", "nonFunctionalConstraints"],
    ["scope", "functionalScope"],
    ["success criteria", "acceptanceCriteria"],
  ]);

  const sectionValues = new Map<keyof RefinedRequirement, string[]>();
  let currentSection: keyof RefinedRequirement | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionMatch = line.match(
      /^(functional scope|business rules|acceptance criteria|edge cases \/ negative paths|edge cases|non-functional constraints|test strategy hooks|risk areas|coverage targets|minimal repro scenarios|open questions \/ clarifications|open questions|objective|primary risk|primary risk focus|context|context \/ assumptions|constraints|scope|success criteria)\s*:\s*(.*)$/i
    );

    if (sectionMatch) {
      const sectionKey = sectionMatch[1].toLowerCase();
      const mappedSection = supportedSections.get(sectionKey) ?? null;
      const firstValue = sectionMatch[2]?.trim() ?? "";

      currentSection = mappedSection;

      if (mappedSection) {
        const existing = sectionValues.get(mappedSection) ?? [];
        if (firstValue) {
          existing.push(firstValue);
        }
        sectionValues.set(mappedSection, existing);
      }

      continue;
    }

    if (currentSection) {
      const existing = sectionValues.get(currentSection) ?? [];
      existing.push(line);
      sectionValues.set(currentSection, existing);
    }
  }

  const partial: Partial<RefinedRequirement> = {};

  const objective = normalizeWhitespace(
    (sectionValues.get("objective") ?? []).join(" ")
  );
  if (objective) partial.objective = objective.slice(0, 240);

  const context = normalizeMultilineText(
    (sectionValues.get("context") ?? []).join("\n")
  );
  if (context) partial.context = context.slice(0, 600);

  const functionalScope = splitStructuredRequirementList(
    (sectionValues.get("functionalScope") ?? []).join("\n")
  );
  if (functionalScope.length) partial.functionalScope = functionalScope;

  const businessRules = splitStructuredRequirementList(
    (sectionValues.get("businessRules") ?? []).join("\n")
  );
  if (businessRules.length) partial.businessRules = businessRules;

  const acceptanceCriteria = splitStructuredRequirementList(
    (sectionValues.get("acceptanceCriteria") ?? []).join("\n")
  );
  if (acceptanceCriteria.length) partial.acceptanceCriteria = acceptanceCriteria;

  const edgeCases = splitStructuredRequirementList(
    (sectionValues.get("edgeCases") ?? []).join("\n")
  );
  if (edgeCases.length) partial.edgeCases = edgeCases;

  const nonFunctionalConstraints = splitStructuredRequirementList(
    (sectionValues.get("nonFunctionalConstraints") ?? []).join("\n")
  );
  if (nonFunctionalConstraints.length) {
    partial.nonFunctionalConstraints = nonFunctionalConstraints;
  }

  const testStrategyHooks = splitStructuredRequirementList(
    (sectionValues.get("testStrategyHooks") ?? []).join("\n")
  );
  if (testStrategyHooks.length) partial.testStrategyHooks = testStrategyHooks;

  const riskAreas = splitStructuredRequirementList(
    (sectionValues.get("riskAreas") ?? []).join("\n")
  );
  if (riskAreas.length) partial.riskAreas = riskAreas;

  const coverageTargets = splitStructuredRequirementList(
    (sectionValues.get("coverageTargets") ?? []).join("\n")
  );
  if (coverageTargets.length) partial.coverageTargets = coverageTargets;

  const minimalReproScenarios = splitStructuredRequirementList(
    (sectionValues.get("minimalReproScenarios") ?? []).join("\n")
  );
  if (minimalReproScenarios.length) {
    partial.minimalReproScenarios = minimalReproScenarios;
  }

  const openQuestions = splitStructuredRequirementList(
    (sectionValues.get("openQuestions") ?? []).join("\n")
  );
  if (openQuestions.length) partial.openQuestions = openQuestions;

  return Object.keys(partial).length ? partial : null;
}

export function mergeArtifact(
  existing: SessionArtifact | null,
  patch: Partial<RefinedRequirement>
): SessionArtifact {
  const prev: SessionArtifact =
    existing && typeof existing === "object" ? existing : {};
  const prevRR: RefinedRequirement =
    prev.refinedRequirement && typeof prev.refinedRequirement === "object"
      ? prev.refinedRequirement
      : {};

  const dedupe = (arr: string[]) =>
    Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));

  const nextRR: RefinedRequirement = {
    ...prevRR,
    ...(patch.objective ? { objective: patch.objective } : {}),
    ...(patch.context ? { context: patch.context } : {}),
    ...(patch.inScope?.length
      ? { inScope: dedupe([...(prevRR.inScope ?? []), ...patch.inScope]) }
      : {}),
    ...(patch.outOfScope?.length
      ? { outOfScope: dedupe([...(prevRR.outOfScope ?? []), ...patch.outOfScope]) }
      : {}),
    ...(patch.integrations?.length
      ? { integrations: dedupe([...(prevRR.integrations ?? []), ...patch.integrations]) }
      : {}),
    ...(patch.riskFocus?.length
      ? { riskFocus: dedupe([...(prevRR.riskFocus ?? []), ...patch.riskFocus]) }
      : {}),
    ...(patch.functionalScope?.length
      ? {
          functionalScope: dedupe([
            ...(prevRR.functionalScope ?? []),
            ...patch.functionalScope,
          ]),
        }
      : {}),
    ...(patch.businessRules?.length
      ? {
          businessRules: dedupe([
            ...(prevRR.businessRules ?? []),
            ...patch.businessRules,
          ]),
        }
      : {}),
    ...(patch.acceptanceCriteria?.length
      ? {
          acceptanceCriteria: dedupe([
            ...(prevRR.acceptanceCriteria ?? []),
            ...patch.acceptanceCriteria,
          ]),
        }
      : {}),
    ...(patch.edgeCases?.length
      ? {
          edgeCases: dedupe([...(prevRR.edgeCases ?? []), ...patch.edgeCases]),
        }
      : {}),
    ...(patch.nonFunctionalConstraints?.length
      ? {
          nonFunctionalConstraints: dedupe([
            ...(prevRR.nonFunctionalConstraints ?? []),
            ...patch.nonFunctionalConstraints,
          ]),
        }
      : {}),
    ...(patch.testStrategyHooks?.length
      ? {
          testStrategyHooks: dedupe([
            ...(prevRR.testStrategyHooks ?? []),
            ...patch.testStrategyHooks,
          ]),
        }
      : {}),
    ...(patch.riskAreas?.length
      ? {
          riskAreas: dedupe([...(prevRR.riskAreas ?? []), ...patch.riskAreas]),
        }
      : {}),
    ...(patch.coverageTargets?.length
      ? {
          coverageTargets: dedupe([
            ...(prevRR.coverageTargets ?? []),
            ...patch.coverageTargets,
          ]),
        }
      : {}),
    ...(patch.minimalReproScenarios?.length
      ? {
          minimalReproScenarios: dedupe([
            ...(prevRR.minimalReproScenarios ?? []),
            ...patch.minimalReproScenarios,
          ]),
        }
      : {}),
    ...(patch.openQuestions?.length
      ? {
          openQuestions: dedupe([
            ...(prevRR.openQuestions ?? []),
            ...patch.openQuestions,
          ]),
        }
      : {}),
  };

  return {
    refinedRequirement: nextRR,
    ...(prev.testSuite ? { testSuite: prev.testSuite } : {}),
    ...(prev.reviewResult ? { reviewResult: prev.reviewResult } : {}),
    ...(prev.featureWorkspace ? { featureWorkspace: prev.featureWorkspace } : {}),
  };
}

export function getTestSuite(
  artifact: SessionArtifact | null | undefined
): TestSuiteArtifact | null {
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
  if (rr.context) lines.push(`- Context: ${rr.context}`);

  if (rr.functionalScope?.length) {
    lines.push("- Functional Scope:");
    for (const s of rr.functionalScope.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.businessRules?.length) {
    lines.push("- Business Rules:");
    for (const s of rr.businessRules.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.acceptanceCriteria?.length) {
    lines.push("- Acceptance Criteria:");
    for (const s of rr.acceptanceCriteria.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.edgeCases?.length) {
    lines.push("- Edge Cases / Negative Paths:");
    for (const s of rr.edgeCases.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.nonFunctionalConstraints?.length) {
    lines.push("- Non-Functional Constraints:");
    for (const s of rr.nonFunctionalConstraints.slice(0, 12)) {
      lines.push(`  - ${s}`);
    }
  }

  if (rr.testStrategyHooks?.length) {
    lines.push("- Test Strategy Hooks:");
    for (const s of rr.testStrategyHooks.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.riskAreas?.length) {
    lines.push("- Risk Areas:");
    for (const s of rr.riskAreas.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.coverageTargets?.length) {
    lines.push("- Coverage Targets:");
    for (const s of rr.coverageTargets.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.minimalReproScenarios?.length) {
    lines.push("- Minimal Repro Scenarios:");
    for (const s of rr.minimalReproScenarios.slice(0, 12)) {
      lines.push(`  - ${s}`);
    }
  }

  if (rr.openQuestions?.length) {
    lines.push("- Open Questions / Clarifications:");
    for (const s of rr.openQuestions.slice(0, 12)) lines.push(`  - ${s}`);
  }

  const suite = getTestSuite(artifact);
  if (suite) {
    const validation = validateTestSuite(suite);

    lines.push("");
    lines.push(
      `TEST SUITE (pinned): v${suite.version}, total cases: ${suite.cases.length}`
    );

    if (validation.hasDuplicates) {
      lines.push(`- Duplicate groups detected: ${validation.duplicateGroups.length}`);
    }

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
  return artifact as unknown as Prisma.InputJsonValue;
}