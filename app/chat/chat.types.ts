// app/chat/chat.types.ts
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted type definitions from page.tsx (no behavior change).
//
// CHANGE (M12 Foundation):
// - add workflow progression types
// - add forward-compatible editable test suite case shape
// - add optional persisted review artifact support
// - add feature-centric workspace grouping type
// - keep all existing M7/M9 contracts backward compatible
//
// CHANGE (M12 Step 6 / 7A):
// - add workflow guidance contract to API + casesText UI items
// - keep shared-session rendering type-safe across workflow modes
//
// M12.14 CHANGE:
// - add execution intelligence client contract
// - add deterministic failure classification client types
// - keep response typing aligned with classification-aware execution artifacts
//
// M12.15 CHANGE:
// - add release health client contract
// - keep response typing aligned with deterministic release-health artifacts
// - keep existing UI contracts backward compatible

/**
 * Chat modes:
 * - coach: model returns structured JSON (server renders to readable text)
 * - review: model returns structured JSON (score/breakdown/gaps/improvements)
 * - cases: model returns STRICT plain-text test cases (copy-paste for Jira/Xray)
 *
 * WHY (M5.1): cases is intentionally NOT JSON. Contract is locked to plain text.
 */
export type Mode = "coach" | "review" | "cases";

/** Review breakdown component scores (max caps are part of the scoring model). */
export type ReviewBreakdown = {
  businessRelevance: number; // 0-25
  riskCoverage: number; // 0-25
  designQuality: number; // 0-20
  levelAndScope: number; // 0-15
  diagnosticValue: number; // 0-15
};

/** Structured output returned by the API in review mode. */
export type ReviewResult = {
  score: number; // 0-100
  verdict: string;
  breakdown: ReviewBreakdown;
  riskGaps: string[];
  antiPatterns: string[];
  improvements: string[];
};

/**
 * Legacy Cases JSON types (kept for history replay ONLY).
 * WHY (M5.1): Older builds may have persisted cases as JSON in chat history.
 * New cases mode is plain text and should not rely on these types.
 */
export type TestCasePriority = "P0" | "P1" | "P2";
export type TestCaseType = "UI" | "API" | "Integration" | "E2E";

export type GeneratedTestCase = {
  id: string; // "TC-001"
  title: string;
  priority: TestCasePriority;
  type: TestCaseType;
  preconditions: string[];
  steps: string[];
  expectedResults: string[];
  testData?: Record<string, unknown>;
  tags?: string[];
};

export type CasesResult = {
  suiteTitle: string;
  assumptions: string[];
  testCases: GeneratedTestCase[];
  optionalClarifications?: string[];
};

// ==============================
// M7.4: Guided Strategy Interaction payload types (frontend contract)
// ==============================
export type SuggestionGroup = {
  label: string;
  type: "single" | "multi";
  options: string[];
};

export type CoachSuggestions = {
  groups: SuggestionGroup[];
  template: string;
};

// ==============================
// M7.7: Session Artifact (Pinned requirement) types
// ==============================
export type RefinedRequirement = {
  objective?: string;
  context?: string;
  inScope?: string[];
  outOfScope?: string[];
  integrations?: string[];
  riskFocus?: string[];
  acceptanceCriteria?: string[];

  // M12 bridge / compatibility fields
  functionalScope?: string[];
  businessRules?: string[];
  edgeCases?: string[];
  edgeCasesNegativePaths?: string[];
  nonFunctionalConstraints?: string[];
  testStrategyHooks?: string[];
  riskAreas?: string[];
  coverageTargets?: string[];
  minimalReproScenarios?: string[];
  openQuestions?: string[];
  openQuestionsClarifications?: string[];
};

// ==============================
// M12: Workflow progression types
// ==============================
export type WorkflowStage = "requirement" | "design" | "review" | "complete";

export type WorkflowStatus = {
  stage: WorkflowStage;
  hasRequirement: boolean;
  hasTestSuite: boolean;
  hasReview: boolean;
  title: string;
  description: string;
  nextAction: string;
};

export type WorkflowGuidance = {
  recommendedAction:
    | "generate_more_cases"
    | "review_suite"
    | "refine_requirement"
    | "ready_for_execution";
  message: string;
  rationale: string;
};

// ==============================
// M12.14: Execution intelligence types
// ==============================
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

export type FailureClassification =
  | "locator_issue"
  | "flaky_behavior"
  | "environment_issue"
  | "real_defect"
  | "unknown";

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
  failureSummary?: FailureClassificationSummary;
};

// ==============================
// M12.15: Release health types
// ==============================
export type ReleaseHealthCoverageStatus =
  | "missing_requirement"
  | "requirement_only"
  | "suite_ready"
  | "review_ready";

export type ReleaseHealthExecutionStatus =
  | "not_started"
  | "passed"
  | "failed"
  | "partial"
  | "blocked"
  | "unknown";

export type ReleaseHealthFailureBurden =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "unknown";

export type ReleaseHealthOverallStatus =
  | "not_ready"
  | "needs_review"
  | "ready_for_execution"
  | "healthy"
  | "degraded"
  | "blocked"
  | "unknown";

export type ReleaseHealthArtifact = {
  computedAt: string;
  coverageStatus: ReleaseHealthCoverageStatus;
  executionStatus: ReleaseHealthExecutionStatus;
  failureBurden: ReleaseHealthFailureBurden;
  overallStatus: ReleaseHealthOverallStatus;

  requirementPresent: boolean;
  suitePresent: boolean;
  reviewPresent: boolean;
  executionPresent: boolean;
  failureClassificationPresent: boolean;

  suiteVersion: number | null;
  reviewScore: number | null;
  executionTotal: number;
  executionFailed: number;
  executionTimedOut: number;
  totalClassifiedFailures: number;

  reasons: string[];
};

// ==============================
// M9 / M12: Persistent suite types
// ==============================

/**
 * M9 origin:
 * persisted suite was intentionally lightweight (id/title/body).
 *
 * M12 foundation:
 * keep those fields stable, but add optional structured fields so generated
 * cases can evolve into editable artifacts without breaking current consumers.
 */
export type TestSuiteCase = {
  id: string; // e.g. TC-001
  title: string;
  body: string;

  // M12 forward-compatible editable structure
  priority?: TestCasePriority;
  type?: TestCaseType;
  preconditions?: string[];
  steps?: string[];
  expectedResults?: string[];
  tags?: string[];

  // Tracks whether the case has been manually adjusted after generation.
  edited?: boolean;

  // Optional freeform note for future QA edits / workspace annotations.
  notes?: string;
};

export type TestSuiteArtifact = {
  version: number;
  cases: TestSuiteCase[];
  createdAt: string;
  lastUpdatedAt: string;
};

// ==============================
// M12: Feature-centric workspace grouping
// ==============================
export type FeatureWorkspaceArtifact = {
  featureTitle?: string;
  refinedRequirement?: RefinedRequirement;
  testSuite?: TestSuiteArtifact;
  reviewResult?: ReviewResult;
  executionIntelligence?: ExecutionIntelligenceArtifact;
  releaseHealth?: ReleaseHealthArtifact;
  lastUpdatedAt?: string;
};

/**
 * Current persisted session artifact.
 *
 * Backward compatibility:
 * - refinedRequirement remains top-level
 * - testSuite remains top-level
 *
 * M12 foundation:
 * - add optional persisted review result
 * - add optional feature-centric grouping wrapper
 */
export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;

  // M9 CHANGE: evolving persisted test suite for Cases mode continuity.
  testSuite?: TestSuiteArtifact;

  // M12: optional persisted review artifact for stronger suite/review alignment.
  reviewResult?: ReviewResult;

  // M12.13 / M12.14:
  // optional persisted execution artifact with classification-aware state
  executionIntelligence?: ExecutionIntelligenceArtifact;

  // M12.15:
  // optional persisted release-health artifact
  releaseHealth?: ReleaseHealthArtifact;

  // M12: optional workspace grouping model. Not required yet by existing UI.
  featureWorkspace?: FeatureWorkspaceArtifact;
};

/**
 * UI message model:
 * - text: normal user/bot chat messages
 * - review: structured scorecard output
 * - casesText: strict plain-text test case suite output
 * - casesLegacy: legacy structured cases suite (history replay only)
 * - error: API/runtime errors shown to the user
 */
export type ChatItem =
  | {
      kind: "text";
      role: "user" | "bot";
      text: string;
      requestId?: string;
      // M7.4: bot clarification message can carry suggestions.
      suggestions?: CoachSuggestions;
    }
  | { kind: "review"; role: "bot"; review: ReviewResult; requestId?: string }
  | {
      kind: "casesText";
      role: "bot";
      text: string;
      requestId?: string;
      workflowGuidance?: WorkflowGuidance;
    }
  | { kind: "casesLegacy"; role: "bot"; cases: CasesResult; requestId?: string }
  | { kind: "error"; role: "bot"; title: string; details: string; requestId?: string };

export type PersistedState = {
  mode: Mode;
  items: ChatItem[];
  input: string;
};

/** Rate limit metadata (returned by the API on success + on 429). */
export type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

/**
 * ✅ Chat API response type (kept flexible but avoids "any").
 * NOTE (M5.1): cases returns reply only (plain text).
 */
export type ChatApiResponse = {
  ok: boolean;
  mode?: Mode;
  reply?: string;

  review?: ReviewResult;

  raw?: string;
  error?: string;
  details?: string;

  sessionId?: string;
  creditsCharged?: number;
  creditsRemaining?: number;

  rate?: RateMeta;
  replay?: boolean;

  // ✅ Milestone 6.1: explicit mode mismatch details
  sessionMode?: Mode;
  requestedMode?: Mode;

  // M7.4: suggestions payload (optional)
  suggestions?: CoachSuggestions;

  // M7.4: allow nested suggestions under coach (backend may choose either)
  coach?: {
    suggestions?: CoachSuggestions;
    [k: string]: unknown;
  };

  // M12 Step 6:
  // deterministic workflow guidance returned for cases flow when applicable
  workflowGuidance?: WorkflowGuidance;

  // M12.13 / M12.14:
  // normalized execution payload returned when available
  executionIntelligence?: ExecutionIntelligenceArtifact | null;

  // M12.15:
  // normalized release-health payload returned when available
  releaseHealth?: ReleaseHealthArtifact | null;

  // CHANGE (M7.7): session artifact returned on every /api/chat response (and replay)
  artifact?: SessionArtifact | null;
  artifactUpdatedAt?: string | null;
};

/**
 * --- Chat History types (API: /api/chat/history) ---
 */
export type SessionListItem = {
  id: string;
  title: string | null;
  mode: Mode; // persisted mode
  effectiveMode?: Mode; // optional future-proofing
  createdAt: string;
  lastActivityAt?: string;
  lastMessage: null | { role: string; content: string; createdAt: string };

  // CHANGE (M7.7): lightweight pin metadata for sidebar badge
  hasPinnedRequirement?: boolean;
  artifactUpdatedAt?: string | null;

  // M9 CHANGE: persistent suite metadata for sidebar/history badges
  hasPersistentTestSuite?: boolean;
  testSuiteVersion?: number | null;
  testSuiteCount?: number | null;
};

export type HistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};