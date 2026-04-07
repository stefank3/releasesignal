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
//
// BUG FIX (M12.8 contract bridge):
// - bridge legacy coach fields into locked requirement fields during merge
// - keep legacy fields for compatibility, but do not allow unified fields to remain empty
// - keep artifact context useful during transition even when older artifacts only contain legacy sections
//
// M12.12 CHANGE:
// - extend requirement artifact contract with ingestion bridge fields
// - preserve legacy + M12.8 compatibility
// - keep merge/context logic deterministic during transition
//
// M12.13 CHANGE:
// - add structured execution intelligence artifact support
// - keep execution data deterministic and artifact-owned
// - support suite-level + case-level execution state without adding workflow logic here
// - preserve existing requirement/test/review behavior and backward compatibility
//
// M12.14 CHANGE:
// - add deterministic failure-classification contract support
// - keep classification artifact-owned and parser/service-consumable
// - support case-level classification + suite-level summary without adding workflow logic here
// - preserve existing execution ingestion behavior when classification is absent

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

  // Locked unified QA requirement fields for M12.8 / M12.12 bridge.
  functionalScope?: string[];
  businessRules?: string[];
  acceptanceCriteria?: string[];

  // Transitional field retained for compatibility.
  edgeCases?: string[];

  // M12.12 bridge field.
  edgeCasesNegativePaths?: string[];

  nonFunctionalConstraints?: string[];

  // Transitional flattened strategy field retained for compatibility.
  testStrategyHooks?: string[];

  riskAreas?: string[];
  coverageTargets?: string[];
  minimalReproScenarios?: string[];

  // Transitional field retained for compatibility.
  openQuestions?: string[];

  // M12.12 bridge field.
  openQuestionsClarifications?: string[];
};

export type ExecutionSource =
  | "playwright"
  | "selenium"
  | "postman"
  | "ci"
  | "unknown";

export type ExecutionCaseStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "blocked"
  | "timed_out"
  | "unknown";

export type ExecutionSuiteStatus =
  | "passed"
  | "failed"
  | "partial"
  | "blocked"
  | "unknown";

// M12.14:
// Stable deterministic failure buckets.
// "unknown" is retained so malformed/insufficient classification input does not
// force a false positive category.
export type FailureClassification =
  | "locator_issue"
  | "flaky_behavior"
  | "environment_issue"
  | "real_defect"
  | "unknown";

// M12.14:
// Optional rule code surface for parser/service layers.
// This remains deterministic and explicit; UI should only consume it.
export type FailureClassificationRule =
  | "locator_not_found"
  | "stale_element_reference"
  | "detached_element"
  | "ambiguous_selector"
  | "assertion_mismatch"
  | "unexpected_response"
  | "environment_unavailable"
  | "network_failure"
  | "dependency_failure"
  | "test_timeout"
  | "intermittent_pass_after_retry"
  | "inconclusive"
  | "unknown";

export type FailureClassificationSummary = {
  totalClassified: number;
  locatorIssue: number;
  flakyBehavior: number;
  environmentIssue: number;
  realDefect: number;
  unknown: number;
};

export type ExecutionCaseResult = {
  caseId: string;
  status: ExecutionCaseStatus;
  observedAt: string;
  source: ExecutionSource;
  externalCaseRef?: string;
  externalCaseName?: string;
  durationMs?: number;
  errorMessage?: string;
  rawOutcome?: string;

  // M12.14:
  // Optional because M12.13 execution artifacts may exist without classification.
  failureClassification?: FailureClassification;
  failureClassificationRule?: FailureClassificationRule;
};

export type ExecutionSummary = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  timedOut: number;
  unknown: number;
};

export type ExecutionIntelligenceArtifact = {
  source: ExecutionSource;
  suiteVersion: number | null;
  runId?: string;
  runLabel?: string;
  observedAt: string;
  suiteStatus: ExecutionSuiteStatus;
  summary: ExecutionSummary;
  caseResults: ExecutionCaseResult[];

  // M12.14:
  // Built deterministically from normalized case results.
  failureSummary?: FailureClassificationSummary;
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
  executionIntelligence?: ExecutionIntelligenceArtifact;
  lastUpdatedAt?: string;
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;
  testSuite?: TestSuiteArtifact;
  reviewResult?: PersistedReviewResult;
  executionIntelligence?: ExecutionIntelligenceArtifact;
  featureWorkspace?: FeatureWorkspaceArtifact;
};

export type TestSuiteValidationResult = {
  duplicateGroups: DuplicateCaseGroup[];
  hasDuplicates: boolean;
  totalCases: number;
  malformedCaseIds: string[];
  hasMalformedCases: boolean;
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

export function findMalformedTestCases(cases: TestCase[]): string[] {
  const malformedIds: string[] = [];

  for (const rawCase of cases) {
    const testCase = normalizeTestCase(rawCase);
    const body = normalizeMultilineText(testCase.body);
    const title = normalizeWhitespace(testCase.title);

    const hasType = /(^|\n)\s*Type\s*:/i.test(body);
    const hasPriority = /(^|\n)\s*Priority\s*:/i.test(body);
    const hasPreconditions = /(^|\n)\s*Preconditions\s*:/i.test(body);
    const hasSteps =
      /(^|\n)\s*Test Steps\s*:/i.test(body) ||
      /(^|\n)\s*Steps\s*:/i.test(body);
    const hasExpected =
      /(^|\n)\s*Expected Result(s)?\s*:/i.test(body);

    const suspiciousShortTitle = title.length < 12;
    const suspiciousTruncatedEnding = /(when|if|with|without|and|or|observe)$/i.test(
      title
    );

    if (
      !title ||
      !body ||
      !hasType ||
      !hasPriority ||
      !hasPreconditions ||
      !hasSteps ||
      !hasExpected ||
      suspiciousShortTitle ||
      suspiciousTruncatedEnding
    ) {
      malformedIds.push(testCase.id);
    }
  }

  return malformedIds;
}

export function validateTestSuite(
  suite: TestSuiteArtifact | null | undefined
): TestSuiteValidationResult {
  const cases = suite?.cases ?? [];
  const duplicateGroups = findDuplicateTestCases(cases);
  const malformedCaseIds = findMalformedTestCases(cases);

  return {
    duplicateGroups,
    hasDuplicates: duplicateGroups.length > 0,
    totalCases: cases.length,
    malformedCaseIds,
    hasMalformedCases: malformedCaseIds.length > 0,
  };
}

export function normalizeExecutionSource(value: string): ExecutionSource {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (normalized === "playwright") return "playwright";
  if (normalized === "selenium") return "selenium";
  if (normalized === "postman") return "postman";
  if (normalized === "ci") return "ci";

  return "unknown";
}

export function normalizeExecutionCaseStatus(value: string): ExecutionCaseStatus {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (["passed", "pass", "ok", "success"].includes(normalized)) return "passed";
  if (["failed", "fail", "error"].includes(normalized)) return "failed";
  if (["skipped", "skip"].includes(normalized)) return "skipped";
  if (["blocked", "block"].includes(normalized)) return "blocked";
  if (["timed_out", "timeout", "timed out"].includes(normalized)) {
    return "timed_out";
  }

  return "unknown";
}

export function normalizeExecutionSuiteStatus(value: string): ExecutionSuiteStatus {
  const normalized = normalizeWhitespace(value).toLowerCase();

  if (["passed", "pass", "ok", "success"].includes(normalized)) return "passed";
  if (["failed", "fail", "error"].includes(normalized)) return "failed";
  if (["partial", "mixed"].includes(normalized)) return "partial";
  if (["blocked", "block"].includes(normalized)) return "blocked";

  return "unknown";
}

// M12.14:
// Normalize explicit deterministic failure category values only.
// Unknown/unsupported values collapse to "unknown" instead of forcing a category.
export function normalizeFailureClassification(
  value: string | null | undefined
): FailureClassification {
  const normalized = normalizeWhitespace(String(value ?? "")).toLowerCase();

  if (normalized === "locator_issue" || normalized === "locator issue") {
    return "locator_issue";
  }

  if (normalized === "flaky_behavior" || normalized === "flaky behavior") {
    return "flaky_behavior";
  }

  if (normalized === "environment_issue" || normalized === "environment issue") {
    return "environment_issue";
  }

  if (normalized === "real_defect" || normalized === "real defect") {
    return "real_defect";
  }

  return "unknown";
}

// M12.14:
// Normalize explicit deterministic rule codes only.
// This keeps parser/service outputs stable across refresh and persistence.
export function normalizeFailureClassificationRule(
  value: string | null | undefined
): FailureClassificationRule {
  const normalized = normalizeWhitespace(String(value ?? "")).toLowerCase();

  if (normalized === "locator_not_found") return "locator_not_found";
  if (normalized === "stale_element_reference") return "stale_element_reference";
  if (normalized === "detached_element") return "detached_element";
  if (normalized === "ambiguous_selector") return "ambiguous_selector";
  if (normalized === "assertion_mismatch") return "assertion_mismatch";
  if (normalized === "unexpected_response") return "unexpected_response";
  if (normalized === "environment_unavailable") return "environment_unavailable";
  if (normalized === "network_failure") return "network_failure";
  if (normalized === "dependency_failure") return "dependency_failure";
  if (normalized === "test_timeout") return "test_timeout";
  if (normalized === "intermittent_pass_after_retry") {
    return "intermittent_pass_after_retry";
  }
  if (normalized === "inconclusive") return "inconclusive";

  return "unknown";
}

export function buildExecutionSummary(
  caseResults: ExecutionCaseResult[]
): ExecutionSummary {
  const summary: ExecutionSummary = {
    total: caseResults.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    blocked: 0,
    timedOut: 0,
    unknown: 0,
  };

  for (const result of caseResults) {
    switch (result.status) {
      case "passed":
        summary.passed += 1;
        break;
      case "failed":
        summary.failed += 1;
        break;
      case "skipped":
        summary.skipped += 1;
        break;
      case "blocked":
        summary.blocked += 1;
        break;
      case "timed_out":
        summary.timedOut += 1;
        break;
      default:
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}

// M12.14:
// Build suite-level failure summary from normalized case classifications only.
// Passed/skipped/etc do not contribute to classification totals.
export function buildFailureClassificationSummary(
  caseResults: ExecutionCaseResult[]
): FailureClassificationSummary {
  const summary: FailureClassificationSummary = {
    totalClassified: 0,
    locatorIssue: 0,
    flakyBehavior: 0,
    environmentIssue: 0,
    realDefect: 0,
    unknown: 0,
  };

  for (const result of caseResults) {
    if (result.status !== "failed" && result.status !== "timed_out") {
      continue;
    }

    const classification = normalizeFailureClassification(
      result.failureClassification
    );

    summary.totalClassified += 1;

    switch (classification) {
      case "locator_issue":
        summary.locatorIssue += 1;
        break;
      case "flaky_behavior":
        summary.flakyBehavior += 1;
        break;
      case "environment_issue":
        summary.environmentIssue += 1;
        break;
      case "real_defect":
        summary.realDefect += 1;
        break;
      default:
        summary.unknown += 1;
        break;
    }
  }

  return summary;
}

export function normalizeExecutionCaseResult(
  result: ExecutionCaseResult
): ExecutionCaseResult {
  return {
    caseId: normalizeWhitespace(result.caseId).toUpperCase(),
    status: normalizeExecutionCaseStatus(result.status),
    observedAt: normalizeWhitespace(result.observedAt),
    source: normalizeExecutionSource(result.source),
    ...(result.externalCaseRef
      ? { externalCaseRef: normalizeWhitespace(result.externalCaseRef) }
      : {}),
    ...(result.externalCaseName
      ? { externalCaseName: normalizeWhitespace(result.externalCaseName) }
      : {}),
    ...(typeof result.durationMs === "number" && Number.isFinite(result.durationMs)
      ? { durationMs: Math.max(0, Math.round(result.durationMs)) }
      : {}),
    ...(result.errorMessage
      ? { errorMessage: normalizeMultilineText(result.errorMessage) }
      : {}),
    ...(result.rawOutcome ? { rawOutcome: normalizeWhitespace(result.rawOutcome) } : {}),

    // M12.14:
    // Preserve classification only when explicitly provided.
    ...(result.failureClassification
      ? {
          failureClassification: normalizeFailureClassification(
            result.failureClassification
          ),
        }
      : {}),
    ...(result.failureClassificationRule
      ? {
          failureClassificationRule: normalizeFailureClassificationRule(
            result.failureClassificationRule
          ),
        }
      : {}),
  };
}

export function normalizeExecutionIntelligenceArtifact(
  artifact: ExecutionIntelligenceArtifact
): ExecutionIntelligenceArtifact {
  const caseResults = Array.isArray(artifact.caseResults)
    ? artifact.caseResults
        .map((result) => normalizeExecutionCaseResult(result))
        .filter((result) => !!result.caseId && !!result.observedAt)
    : [];

  return {
    source: normalizeExecutionSource(artifact.source),
    suiteVersion:
      typeof artifact.suiteVersion === "number" && Number.isFinite(artifact.suiteVersion)
        ? artifact.suiteVersion
        : null,
    ...(artifact.runId ? { runId: normalizeWhitespace(artifact.runId) } : {}),
    ...(artifact.runLabel ? { runLabel: normalizeWhitespace(artifact.runLabel) } : {}),
    observedAt: normalizeWhitespace(artifact.observedAt),
    suiteStatus: normalizeExecutionSuiteStatus(artifact.suiteStatus),
    summary: buildExecutionSummary(caseResults),
    caseResults,

    // M12.14:
    // Always rebuild from normalized case results so persisted summary cannot drift.
    failureSummary: buildFailureClassificationSummary(caseResults),
  };
}

export function getExecutionIntelligence(
  artifact: SessionArtifact | null | undefined
): ExecutionIntelligenceArtifact | null {
  const execution = artifact?.executionIntelligence;

  if (!execution || typeof execution !== "object") return null;
  if (!Array.isArray(execution.caseResults)) return null;
  if (typeof execution.observedAt !== "string") return null;
  if (typeof execution.source !== "string") return null;
  if (typeof execution.suiteStatus !== "string") return null;
  if (!execution.summary || typeof execution.summary !== "object") return null;

  return normalizeExecutionIntelligenceArtifact(
    execution as ExecutionIntelligenceArtifact
  );
}

export function withUpdatedExecutionIntelligenceArtifact(
  existingArtifact: SessionArtifact | null,
  executionIntelligence: ExecutionIntelligenceArtifact
): SessionArtifact {
  const prev: SessionArtifact =
    existingArtifact && typeof existingArtifact === "object"
      ? existingArtifact
      : {};

  const normalizedExecution = normalizeExecutionIntelligenceArtifact(
    executionIntelligence
  );

  return {
    ...(prev.refinedRequirement
      ? { refinedRequirement: prev.refinedRequirement }
      : {}),
    ...(prev.testSuite ? { testSuite: prev.testSuite } : {}),
    ...(prev.reviewResult ? { reviewResult: prev.reviewResult } : {}),
    executionIntelligence: normalizedExecution,
    ...(prev.featureWorkspace
      ? {
          featureWorkspace: {
            ...prev.featureWorkspace,
            executionIntelligence: normalizedExecution,
          },
        }
      : {}),
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
    t.includes("context / constraints:") ||
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
    "Context / Constraints:",
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
    ["edge cases / negative paths", "edgeCasesNegativePaths"],
    ["edge cases", "edgeCases"],
    ["non-functional constraints", "nonFunctionalConstraints"],
    ["test strategy hooks", "testStrategyHooks"],
    ["risk areas", "riskAreas"],
    ["coverage targets", "coverageTargets"],
    ["minimal repro scenarios", "minimalReproScenarios"],
    ["open questions / clarifications", "openQuestionsClarifications"],
    ["open questions", "openQuestions"],
    ["context / constraints", "context"],

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
      /^(functional scope|business rules|acceptance criteria|edge cases \/ negative paths|edge cases|non-functional constraints|test strategy hooks|risk areas|coverage targets|minimal repro scenarios|open questions \/ clarifications|open questions|objective|primary risk|primary risk focus|context|context \/ assumptions|context \/ constraints|constraints|scope|success criteria)\s*:\s*(.*)$/i
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

  const edgeCasesNegativePaths = splitStructuredRequirementList(
    (sectionValues.get("edgeCasesNegativePaths") ?? []).join("\n")
  );
  if (edgeCasesNegativePaths.length) {
    partial.edgeCasesNegativePaths = edgeCasesNegativePaths;
    partial.edgeCases = edgeCasesNegativePaths;
  }

  const edgeCases = splitStructuredRequirementList(
    (sectionValues.get("edgeCases") ?? []).join("\n")
  );
  if (edgeCases.length) {
    partial.edgeCases = Array.from(
      new Set([...(partial.edgeCases ?? []), ...edgeCases])
    );
  }

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

  const openQuestionsClarifications = splitStructuredRequirementList(
    (sectionValues.get("openQuestionsClarifications") ?? []).join("\n")
  );
  if (openQuestionsClarifications.length) {
    partial.openQuestionsClarifications = openQuestionsClarifications;
    partial.openQuestions = openQuestionsClarifications;
  }

  const openQuestions = splitStructuredRequirementList(
    (sectionValues.get("openQuestions") ?? []).join("\n")
  );
  if (openQuestions.length) {
    partial.openQuestions = Array.from(
      new Set([...(partial.openQuestions ?? []), ...openQuestions])
    );
  }

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

  // M12.8 / M12.12 bridge:
  // legacy coach patches still populate inScope / riskFocus / integrations.
  // During transition, normalize them into the locked reviewable shape too.
  const normalizedFunctionalScope = dedupe([
    ...(patch.functionalScope ?? []),
    ...(patch.inScope ?? []),
  ]);

  const normalizedRiskAreas = dedupe([
    ...(patch.riskAreas ?? []),
    ...(patch.riskFocus ?? []),
  ]);

  const normalizedNonFunctionalConstraints = dedupe([
    ...(patch.nonFunctionalConstraints ?? []),
    ...(patch.integrations ?? []).map((x) => `Integration dependency: ${x}`),
  ]);

  const normalizedEdgeCasesNegativePaths = dedupe([
    ...(patch.edgeCasesNegativePaths ?? []),
    ...(patch.edgeCases ?? []),
  ]);

  const normalizedOpenQuestionsClarifications = dedupe([
    ...(patch.openQuestionsClarifications ?? []),
    ...(patch.openQuestions ?? []),
  ]);

  const normalizedTestStrategyHooks = dedupe([
    ...(patch.testStrategyHooks ?? []),
  ]);

  const nextRR: RefinedRequirement = {
    ...prevRR,
    ...(patch.objective ? { objective: patch.objective } : {}),
    ...(patch.context ? { context: patch.context } : {}),

    // Keep legacy fields for compatibility during migration.
    ...(patch.inScope?.length
      ? { inScope: dedupe([...(prevRR.inScope ?? []), ...patch.inScope]) }
      : {}),
    ...(patch.outOfScope?.length
      ? { outOfScope: dedupe([...(prevRR.outOfScope ?? []), ...patch.outOfScope]) }
      : {}),
    ...(patch.integrations?.length
      ? {
          integrations: dedupe([
            ...(prevRR.integrations ?? []),
            ...patch.integrations,
          ]),
        }
      : {}),
    ...(patch.riskFocus?.length
      ? { riskFocus: dedupe([...(prevRR.riskFocus ?? []), ...patch.riskFocus]) }
      : {}),

    // Locked unified fields used by deterministic review and artifact context.
    ...(normalizedFunctionalScope.length
      ? {
          functionalScope: dedupe([
            ...(prevRR.functionalScope ?? []),
            ...normalizedFunctionalScope,
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
    ...(normalizedEdgeCasesNegativePaths.length
      ? {
          edgeCases: dedupe([...(prevRR.edgeCases ?? []), ...normalizedEdgeCasesNegativePaths]),
          edgeCasesNegativePaths: dedupe([
            ...(prevRR.edgeCasesNegativePaths ?? []),
            ...normalizedEdgeCasesNegativePaths,
          ]),
        }
      : {}),
    ...(normalizedNonFunctionalConstraints.length
      ? {
          nonFunctionalConstraints: dedupe([
            ...(prevRR.nonFunctionalConstraints ?? []),
            ...normalizedNonFunctionalConstraints,
          ]),
        }
      : {}),
    ...(normalizedTestStrategyHooks.length
      ? {
          testStrategyHooks: dedupe([
            ...(prevRR.testStrategyHooks ?? []),
            ...normalizedTestStrategyHooks,
          ]),
        }
      : {}),
    ...(normalizedRiskAreas.length
      ? {
          riskAreas: dedupe([...(prevRR.riskAreas ?? []), ...normalizedRiskAreas]),
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
    ...(normalizedOpenQuestionsClarifications.length
      ? {
          openQuestions: dedupe([
            ...(prevRR.openQuestions ?? []),
            ...normalizedOpenQuestionsClarifications,
          ]),
          openQuestionsClarifications: dedupe([
            ...(prevRR.openQuestionsClarifications ?? []),
            ...normalizedOpenQuestionsClarifications,
          ]),
        }
      : {}),
  };

  return {
    refinedRequirement: nextRR,
    ...(prev.testSuite ? { testSuite: prev.testSuite } : {}),
    ...(prev.reviewResult ? { reviewResult: prev.reviewResult } : {}),
    ...(prev.executionIntelligence
      ? { executionIntelligence: prev.executionIntelligence }
      : {}),
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

  const functionalScope =
    rr.functionalScope?.length ? rr.functionalScope : rr.inScope ?? [];

  if (functionalScope.length) {
    lines.push("- Functional Scope:");
    for (const s of functionalScope.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.businessRules?.length) {
    lines.push("- Business Rules:");
    for (const s of rr.businessRules.slice(0, 12)) lines.push(`  - ${s}`);
  }

  if (rr.acceptanceCriteria?.length) {
    lines.push("- Acceptance Criteria:");
    for (const s of rr.acceptanceCriteria.slice(0, 12)) lines.push(`  - ${s}`);
  }

  const edgeCasesNegativePaths =
    rr.edgeCasesNegativePaths?.length
      ? rr.edgeCasesNegativePaths
      : rr.edgeCases ?? [];

  if (edgeCasesNegativePaths.length) {
    lines.push("- Edge Cases / Negative Paths:");
    for (const s of edgeCasesNegativePaths.slice(0, 12)) lines.push(`  - ${s}`);
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

  const riskAreas = rr.riskAreas?.length ? rr.riskAreas : rr.riskFocus ?? [];

  if (riskAreas.length) {
    lines.push("- Risk Areas:");
    for (const s of riskAreas.slice(0, 12)) lines.push(`  - ${s}`);
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

  const openQuestionsClarifications =
    rr.openQuestionsClarifications?.length
      ? rr.openQuestionsClarifications
      : rr.openQuestions ?? [];

  if (openQuestionsClarifications.length) {
    lines.push("- Open Questions / Clarifications:");
    for (const s of openQuestionsClarifications.slice(0, 12)) {
      lines.push(`  - ${s}`);
    }
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

  const execution = getExecutionIntelligence(artifact);
  if (execution) {
    lines.push("");
    lines.push(
      `LATEST EXECUTION (pinned): ${execution.source}, status ${execution.suiteStatus}`
    );
    lines.push(
      `- Summary: total ${execution.summary.total}, passed ${execution.summary.passed}, failed ${execution.summary.failed}, skipped ${execution.summary.skipped}, blocked ${execution.summary.blocked}, timed out ${execution.summary.timedOut}, unknown ${execution.summary.unknown}`
    );

    // M12.14:
    // Surface deterministic classification totals in context without turning
    // rendered text into a workflow dependency.
    if (execution.failureSummary) {
      lines.push(
        `- Failure classification: total classified ${execution.failureSummary.totalClassified}, locator issues ${execution.failureSummary.locatorIssue}, flaky behavior ${execution.failureSummary.flakyBehavior}, environment issues ${execution.failureSummary.environmentIssue}, real defects ${execution.failureSummary.realDefect}, unknown ${execution.failureSummary.unknown}`
      );
    }

    if (typeof execution.suiteVersion === "number") {
      lines.push(`- Suite version: v${execution.suiteVersion}`);
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