// app/chat/chat.types.ts
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted type definitions from page.tsx (no behavior change).

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
};

// M9 CHANGE: persistent suite types mirrored from backend artifact model.
export type TestSuiteCase = {
  id: string; // e.g. TC-001
  title: string;
  body: string;
};

export type TestSuiteArtifact = {
  version: number;
  cases: TestSuiteCase[];
  createdAt: string;
  lastUpdatedAt: string;
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;
  // M9 CHANGE: evolving persisted test suite for Cases mode continuity.
  testSuite?: TestSuiteArtifact;
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
  | { kind: "casesText"; role: "bot"; text: string; requestId?: string }
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