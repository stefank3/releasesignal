// app/chat/hooks/useChatSession.helpers.ts
"use client";

import type {
  CasesResult,
  ChatItem,
  CoachSuggestions,
  Mode,
  ReleaseHealthArtifact,
  ReviewResult,
  SessionArtifact,
  WorkflowStatus,
} from "../chat.types";

export const MAX_MESSAGE_CHARS = 8000;

export function isNearBottom(el: HTMLDivElement, thresholdPx = 140) {
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distance <= thresholdPx;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

function looksLikeRefinedRequirementText(text: string): boolean {
  const t = String(text ?? "").trim();
  return t.startsWith("Refined Technical Requirement");
}

export function buildOversizedInputMessage(args: {
  mode: Mode;
  actualLength: number;
}): string {
  const overBy = Math.max(0, args.actualLength - MAX_MESSAGE_CHARS);

  if (args.mode === "review") {
    return [
      `This review input is too large for a single pass right now (${args.actualLength.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}).`,
      "",
      "Try one of these:",
      "- review a smaller section of the suite",
      "- split the suite into parts",
      "- review the highest-risk area first",
      "",
      `Current input exceeds the limit by ${overBy.toLocaleString()} characters.`,
      "",
      "Large-suite review will be expanded in a later milestone.",
    ].join("\n");
  }

  if (args.mode === "cases") {
    return [
      `This test-design input is too large for a single request right now (${args.actualLength.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}).`,
      "",
      "Try one of these:",
      "- generate tests from a smaller requirement section",
      "- paste only the core scope and constraints",
      "- extend the suite incrementally in follow-up prompts",
      "",
      `Current input exceeds the limit by ${overBy.toLocaleString()} characters.`,
    ].join("\n");
  }

  return [
    `This Strategy input is too large for a single request right now (${args.actualLength.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}).`,
    "",
    "Try one of these:",
    "- shorten the description to the essential scope",
    "- split the requirement into smaller parts",
    "- start with the core workflow first",
    "",
    `Current input exceeds the limit by ${overBy.toLocaleString()} characters.`,
  ].join("\n");
}

export function tryParseReview(text: string): ReviewResult | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      typeof obj.score === "number" &&
      obj.breakdown &&
      typeof obj.breakdown.businessRelevance === "number" &&
      Array.isArray(obj.riskGaps) &&
      Array.isArray(obj.antiPatterns) &&
      Array.isArray(obj.improvements)
    ) {
      return obj as ReviewResult;
    }
  } catch {}
  return null;
}

export function tryParseCasesLegacy(text: string): CasesResult | null {
  try {
    const obj = JSON.parse(text);
    if (
      obj &&
      typeof obj.suiteTitle === "string" &&
      Array.isArray(obj.assumptions) &&
      Array.isArray(obj.testCases)
    ) {
      return obj as CasesResult;
    }
  } catch {}
  return null;
}

export function looksLikeCasesPlainText(text: string): boolean {
  const t = String(text ?? "").replace(/\r/g, "");

  const tcCount = (t.match(/^TC-\d{1,4}\b.*$/gim) || []).length;
  const hasMarkers =
    /(^|\n)\s*Preconditions\s*:/i.test(t) ||
    /(^|\n)\s*Test Steps\s*:/i.test(t) ||
    /(^|\n)\s*Steps\s*:/i.test(t) ||
    /(^|\n)\s*Expected Result(s)?\s*:/i.test(t) ||
    /(^|\n)\s*Priority\s*:/i.test(t) ||
    /(^|\n)\s*Type\s*:/i.test(t);

  return (tcCount >= 1 && hasMarkers) || tcCount >= 2;
}

function looksLikeJson(s: string) {
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

function looksLikePersistedSuiteHeader(text: string): boolean {
  return /^Test Suite v\d+\s*\nTotal test cases:\s*\d+/i.test(
    String(text ?? "").trim()
  );
}

export function tryFormatCoachJson(text: string): string | null {
  try {
    const obj = JSON.parse(text) as {
      assumptions?: string[];
      riskMatrix?: { risk?: string; likelihood?: string; impact?: string }[];
      highSignalApproach?: { testIdeas?: string[] };
      testCases?: {
        id?: string;
        title?: string;
        priority?: string;
        level?: string;
      }[];
      optionalClarifications?: string[];
    };

    const lines: string[] = [];

    if (Array.isArray(obj.assumptions) && obj.assumptions.length) {
      lines.push("Assumptions:");
      for (const a of obj.assumptions.slice(0, 6)) lines.push(`- ${mdSafe(a)}`);
      lines.push("");
    }

    if (Array.isArray(obj.riskMatrix) && obj.riskMatrix.length) {
      lines.push("Top risks:");
      for (const r of obj.riskMatrix.slice(0, 5)) {
        const risk = mdSafe(r.risk ?? "Risk");
        const li = mdSafe(r.likelihood ?? "");
        const im = mdSafe(r.impact ?? "");
        lines.push(`- ${risk}${li || im ? ` (${li}/${im})` : ""}`);
      }
      lines.push("");
    }

    if (Array.isArray(obj.testCases) && obj.testCases.length) {
      lines.push("Draft test cases:");
      for (const tc of obj.testCases.slice(0, 12)) {
        const id = mdSafe(tc.id ?? "");
        const title = mdSafe(tc.title ?? "");
        const meta = [tc.priority, tc.level].filter(Boolean).join(" · ");
        lines.push(
          `- ${id ? `${id} ` : ""}${title}${meta ? ` (${meta})` : ""}`.trim()
        );
      }
      lines.push("");
    } else if (
      Array.isArray(obj.highSignalApproach?.testIdeas) &&
      obj.highSignalApproach.testIdeas.length
    ) {
      lines.push("Draft test ideas:");
      for (const t of obj.highSignalApproach.testIdeas.slice(0, 12)) {
        lines.push(`- ${mdSafe(t)}`);
      }
      lines.push("");
    }

    if (
      Array.isArray(obj.optionalClarifications) &&
      obj.optionalClarifications.length
    ) {
      lines.push("Optional clarifications:");
      for (const q of obj.optionalClarifications.slice(0, 3)) {
        lines.push(`- ${mdSafe(q)}`);
      }
      lines.push("");
    }

    return lines.length ? lines.join("\n").trim() : null;
  } catch {
    return null;
  }
}

export function getDisplayReplyText(args: {
  data: unknown;
  effectiveMode: Mode;
}): string {
  const { data, effectiveMode } = args;

  const rawValue =
    isRecord(data) && typeof data["raw"] === "string"
      ? (data["raw"] as string)
      : undefined;

  const replyValue =
    isRecord(data) && typeof data["reply"] === "string"
      ? (data["reply"] as string)
      : "No reply returned";

  const textToShow =
    !replyValue && typeof rawValue === "string" ? rawValue : replyValue;

  return effectiveMode === "coach" && looksLikeJson(textToShow)
    ? tryFormatCoachJson(textToShow) ?? textToShow
    : textToShow;
}

export function extractCoachSuggestions(data: unknown): CoachSuggestions | null {
  if (!isRecord(data)) return null;

  if (data["suggestions"]) {
    return data["suggestions"] as CoachSuggestions;
  }

  if (
    isRecord(data["coach"]) &&
    (data["coach"] as Record<string, unknown>)["suggestions"]
  ) {
    return (data["coach"] as Record<string, unknown>)[
      "suggestions"
    ] as CoachSuggestions;
  }

  return null;
}

export function hasSuggestions(v: unknown): v is { suggestions: CoachSuggestions } {
  if (!v || typeof v !== "object") return false;
  return "suggestions" in v && !!(v as { suggestions?: unknown }).suggestions;
}

export function modeLabel(m: Mode) {
  return m === "coach" ? "Strategy" : m === "review" ? "Test Review" : "Test Design";
}

/**
 * M12.18:
 * Current review truth must require a valid persisted review payload,
 * not merely the presence of a property key.
 */
export function artifactHasReviewSignal(artifact: SessionArtifact | null): boolean {
  if (!isRecord(artifact)) return false;

  const reviewResult = artifact.reviewResult;
  if (!isRecord(reviewResult)) return false;

  return (
    typeof reviewResult.score === "number" &&
    isRecord(reviewResult.breakdown) &&
    Array.isArray(reviewResult.riskGaps) &&
    Array.isArray(reviewResult.antiPatterns) &&
    Array.isArray(reviewResult.improvements)
  );
}

export function artifactHasTestSuiteSignal(artifact: SessionArtifact | null): boolean {
  if (!isRecord(artifact)) return false;
  return (
    "testSuite" in artifact ||
    "testSuiteArtifact" in artifact ||
    "suite" in artifact ||
    "casesResult" in artifact
  );
}

export function artifactHasExecutionSignal(artifact: SessionArtifact | null): boolean {
  if (!isRecord(artifact)) return false;
  return "executionIntelligence" in artifact;
}

export function artifactHasReleaseHealthSignal(artifact: SessionArtifact | null): boolean {
  if (!isRecord(artifact)) return false;
  return "releaseHealth" in artifact;
}

export function getReleaseHealthFromArtifact(
  artifact: SessionArtifact | null
): ReleaseHealthArtifact | null {
  if (!isRecord(artifact)) return null;

  const releaseHealth = artifact["releaseHealth"];
  if (!isRecord(releaseHealth)) return null;
  if (typeof releaseHealth["computedAt"] !== "string") return null;
  if (typeof releaseHealth["coverageStatus"] !== "string") return null;
  if (typeof releaseHealth["executionStatus"] !== "string") return null;
  if (typeof releaseHealth["failureBurden"] !== "string") return null;
  if (typeof releaseHealth["overallStatus"] !== "string") return null;
  if (!Array.isArray(releaseHealth["reasons"])) return null;

  return releaseHealth as ReleaseHealthArtifact;
}

function getPersistedSuiteText(artifact: SessionArtifact | null): string | null {
  if (!isRecord(artifact)) return null;

  const testSuite = artifact["testSuite"];
  if (!isRecord(testSuite)) return null;

  const version =
    typeof testSuite["version"] === "number" ? testSuite["version"] : null;
  const cases = Array.isArray(testSuite["cases"]) ? testSuite["cases"] : null;

  if (!version || !cases?.length) return null;

  const caseBodies = cases
    .map((tc) => {
      if (!isRecord(tc)) return "";
      return typeof tc["body"] === "string" ? tc["body"].trim() : "";
    })
    .filter(Boolean);

  if (!caseBodies.length) return null;

  return [
    `Test Suite v${version}`,
    `Total test cases: ${caseBodies.length}`,
    "",
    ...caseBodies,
  ]
    .join("\n")
    .trim();
}

export function deriveWorkflowStatus(args: {
  mode: Mode;
  activeSessionMode: Mode;
  hasRequirement: boolean;
  hasTestSuite: boolean;
  hasReview: boolean;
}): WorkflowStatus {
  const { mode, activeSessionMode, hasRequirement, hasTestSuite, hasReview } = args;
  const effectiveMode = mode ?? activeSessionMode;

  if (!hasRequirement) {
    return {
      stage: "requirement",
      hasRequirement,
      hasTestSuite,
      hasReview,
      title: "Workspace stage: Requirement refinement",
      description:
        "Define the feature scope, constraints, integrations, and risk focus before moving into structured test design.",
      nextAction:
        effectiveMode === "coach"
          ? "Use Strategy to refine the requirement."
          : "Switch to Strategy mode and refine the requirement.",
    };
  }

  if (!hasTestSuite) {
    return {
      stage: "design",
      hasRequirement,
      hasTestSuite,
      hasReview,
      title: "Workspace stage: Test design",
      description:
        "A Refined Requirement is available. The next workflow step is to generate the structured test suite for this feature.",
      nextAction:
        effectiveMode === "cases"
          ? "Generate the suite from the pinned Refined Requirement."
          : "Switch to Test Design mode and generate the suite.",
    };
  }

  if (!hasReview) {
    return {
      stage: "review",
      hasRequirement,
      hasTestSuite,
      hasReview,
      title: "Workspace stage: Coverage review",
      description:
        "A generated test suite exists. The next workflow step is to review coverage, gaps, duplication, and risk alignment.",
      nextAction:
        effectiveMode === "review"
          ? "Run a review against the current generated suite."
          : "Switch to Test Review mode and analyze the current suite.",
    };
  }

  return {
    stage: "complete",
    hasRequirement,
    hasTestSuite,
    hasReview,
    title: "Workspace stage: Workflow in progress",
    description:
      "Requirement, test design, and review artifacts are present. This workspace can now evolve through refinements, edits, and future execution-aware analysis.",
    nextAction:
      "Update the requirement or suite where needed, then regenerate or re-review from the latest artifact state.",
  };
}

function mapAssistantHistoryItem(args: {
  content: string;
  sessionArtifact?: SessionArtifact | null;
  fallbackMode: Mode;
}): ChatItem {
  const { content, fallbackMode } = args;
  const sessionArtifact = args.sessionArtifact ?? null;
  const hasPersistedReviewArtifact = artifactHasReviewSignal(sessionArtifact);

  const maybeReview = tryParseReview(content);

  // M12.18:
  // Historical review-shaped assistant content must not rehydrate as an active
  // review card when the persisted artifact no longer has a valid review.
  if (maybeReview) {
    if (hasPersistedReviewArtifact) {
      return { kind: "review", role: "bot", review: maybeReview };
    }

    return {
      kind: "text",
      role: "bot",
      text: "Previous review result kept in chat history. It is no longer the current persisted review artifact for this workspace.",
    };
  }

  const maybeCasesLegacy = tryParseCasesLegacy(content);
  if (maybeCasesLegacy) {
    return { kind: "casesLegacy", role: "bot", cases: maybeCasesLegacy };
  }

  if (looksLikeCasesPlainText(content) || looksLikePersistedSuiteHeader(content)) {
    return { kind: "casesText", role: "bot", text: content };
  }

  if (artifactHasTestSuiteSignal(sessionArtifact) && fallbackMode === "cases") {
    return { kind: "text", role: "bot", text: content };
  }

  if (hasPersistedReviewArtifact && fallbackMode === "review") {
    return { kind: "text", role: "bot", text: content };
  }

  return { kind: "text", role: "bot", text: content };
}

function deriveEffectiveHistorySessionMode(args: {
  items: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  sessionMode: Mode;
  sessionArtifact?: SessionArtifact | null;
}): Mode {
  const { items, sessionMode, sessionArtifact } = args;

  if (artifactHasReviewSignal(sessionArtifact ?? null)) {
    return "review";
  }

  if (artifactHasTestSuiteSignal(sessionArtifact ?? null)) {
    return "cases";
  }

  const latestAssistant = [...items].reverse().find((m) => m.role === "assistant");

  if (!latestAssistant) {
    return sessionMode;
  }

  // M12.18:
  // Do not infer review mode from old chat history when no persisted review
  // artifact exists anymore.
  if (
    artifactHasReviewSignal(sessionArtifact ?? null) &&
    tryParseReview(latestAssistant.content)
  ) {
    return "review";
  }

  if (
    tryParseCasesLegacy(latestAssistant.content) ||
    looksLikeCasesPlainText(latestAssistant.content) ||
    looksLikePersistedSuiteHeader(latestAssistant.content)
  ) {
    return "cases";
  }

  return sessionMode;
}

export function mapHistoryItems(args: {
  items: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  sessionMode: Mode;
  sessionArtifact?: SessionArtifact | null;
}): { mapped: ChatItem[]; effectiveSessionMode: Mode } {
  const { items, sessionMode, sessionArtifact } = args;

  const effectiveSessionMode = deriveEffectiveHistorySessionMode({
    items,
    sessionMode,
    sessionArtifact: sessionArtifact ?? null,
  });

  const latestRequirementAssistantIndex = sessionArtifact?.refinedRequirement
    ? items.reduce((latestIndex, item, index) => {
        if (
          item.role === "assistant" &&
          looksLikeRefinedRequirementText(item.content)
        ) {
          return index;
        }
        return latestIndex;
      }, -1)
    : -1;

  const hasPersistedSuiteArtifact = artifactHasTestSuiteSignal(
    sessionArtifact ?? null
  );
  const hasPersistedReviewArtifact = artifactHasReviewSignal(
    sessionArtifact ?? null
  );
  const persistedSuiteText = getPersistedSuiteText(sessionArtifact ?? null);

  const mapped: ChatItem[] = items
    .filter((m, index) => {
      if (m.role === "system") return false;

      if (
        latestRequirementAssistantIndex >= 0 &&
        m.role === "assistant" &&
        looksLikeRefinedRequirementText(m.content) &&
        index !== latestRequirementAssistantIndex
      ) {
        return false;
      }

      // M12.9 Phase 2 FIX:
      // When a persisted suite artifact exists, suppress older assistant
      // suite-text messages from history replay. The canonical suite card
      // will be injected from the latest artifact after mapping.
      if (
        hasPersistedSuiteArtifact &&
        m.role === "assistant" &&
        (looksLikeCasesPlainText(m.content) || looksLikePersistedSuiteHeader(m.content))
      ) {
        return false;
      }

      // M12.18:
      // When no persisted review artifact exists anymore, suppress historical
      // review JSON blobs so they cannot be remapped into current review cards.
      if (
        !hasPersistedReviewArtifact &&
        m.role === "assistant" &&
        !!tryParseReview(m.content)
      ) {
        return false;
      }

      return true;
    })
    .map((m) => {
      if (m.role === "user") {
        return { kind: "text", role: "user", text: m.content };
      }

      return mapAssistantHistoryItem({
        content: m.content,
        sessionArtifact: sessionArtifact ?? null,
        fallbackMode: effectiveSessionMode,
      });
    });

  // M12.9 Phase 2 FIX:
  // Inject exactly one canonical suite card from the persisted artifact so
  // refresh/session replay always reflects the latest saved suite state.
  if (persistedSuiteText) {
    mapped.push({
      kind: "casesText",
      role: "bot",
      text: persistedSuiteText,
    });
  }

  return { mapped, effectiveSessionMode };
}