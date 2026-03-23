// app/chat/hooks/useChatSession.helpers.ts
"use client";

import type {
  CasesResult,
  ChatItem,
  CoachSuggestions,
  Mode,
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

export function tryFormatCoachJson(text: string): string | null {
  try {
    const obj = JSON.parse(text) as {
      assumptions?: string[];
      riskMatrix?: { risk?: string; likelihood?: string; impact?: string }[];
      highSignalApproach?: { testIdeas?: string[] };
      testCases?: { id?: string; title?: string; priority?: string; level?: string }[];
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
        lines.push(`- ${id ? `${id} ` : ""}${title}${meta ? ` (${meta})` : ""}`.trim());
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

    if (Array.isArray(obj.optionalClarifications) && obj.optionalClarifications.length) {
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

  const textToShow = !replyValue && typeof rawValue === "string" ? rawValue : replyValue;
  return effectiveMode === "coach" && looksLikeJson(textToShow)
    ? tryFormatCoachJson(textToShow) ?? textToShow
    : textToShow;
}

export function extractCoachSuggestions(data: unknown): CoachSuggestions | null {
  if (!isRecord(data)) return null;

  if (data["suggestions"]) {
    return data["suggestions"] as CoachSuggestions;
  }

  if (isRecord(data["coach"]) && (data["coach"] as Record<string, unknown>)["suggestions"]) {
    return (data["coach"] as Record<string, unknown>)["suggestions"] as CoachSuggestions;
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

export function artifactHasReviewSignal(artifact: SessionArtifact | null): boolean {
  if (!isRecord(artifact)) return false;
  return "reviewResult" in artifact || "reviewArtifact" in artifact || "testReview" in artifact;
}

// CHANGE (M12 Step 7B):
// Detect test-suite presence from artifact so history replay can use
// artifact truth before any UI mode assumption.
export function artifactHasTestSuiteSignal(artifact: SessionArtifact | null): boolean {
  if (!isRecord(artifact)) return false;
  return (
    "testSuite" in artifact ||
    "testSuiteArtifact" in artifact ||
    "suite" in artifact ||
    "casesResult" in artifact
  );
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

// BUG FIX (M12 Test Design triage):
// Render persisted suite artifact back into the same plain-text suite shape used by
// the CasesTextCard UI. This allows replay/history restore to use the artifact as
// the source of truth instead of stale assistant message text.
function renderPersistedSuiteText(artifact: SessionArtifact | null): string | null {
  const suite = artifact?.testSuite;

  if (!suite || !Array.isArray(suite.cases) || suite.cases.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push(`Test Suite v${suite.version}`);
  lines.push(`Total test cases: ${suite.cases.length}`);
  lines.push("");

  for (let i = 0; i < suite.cases.length; i++) {
    const testCase = suite.cases[i];
    lines.push(String(testCase.body ?? "").trim());

    if (i < suite.cases.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

// CHANGE (M12 Step 7B):
// Assistant history must be classified per message.
// Content wins first, artifact/workspace is only contextual fallback.
function mapAssistantHistoryItem(args: {
  content: string;
  sessionArtifact?: SessionArtifact | null;
  fallbackMode: Mode;
}): ChatItem {
  const { content, fallbackMode } = args;
  const sessionArtifact = args.sessionArtifact ?? null;

  const maybeReview = tryParseReview(content);
  if (maybeReview) {
    return { kind: "review", role: "bot", review: maybeReview };
  }

  const maybeCasesLegacy = tryParseCasesLegacy(content);
  if (maybeCasesLegacy) {
    return { kind: "casesLegacy", role: "bot", cases: maybeCasesLegacy };
  }

  const persistedSuiteText = renderPersistedSuiteText(sessionArtifact);

  // BUG FIX (M12 Test Design triage):
  // When replaying a workspace in Test Design, the persisted suite artifact is
  // the source of truth. If it exists, do not show stale historical cases text.
  if (fallbackMode === "cases" && persistedSuiteText) {
    return { kind: "casesText", role: "bot", text: persistedSuiteText };
  }

  if (looksLikeCasesPlainText(content)) {
    return { kind: "casesText", role: "bot", text: content };
  }

  // CHANGE (M12 Step 7B):
  // Artifact/session are weak fallbacks only.
  if (artifactHasTestSuiteSignal(sessionArtifact) && fallbackMode === "cases") {
    return { kind: "text", role: "bot", text: content };
  }

  if (artifactHasReviewSignal(sessionArtifact) && fallbackMode === "review") {
    return { kind: "text", role: "bot", text: content };
  }

  return { kind: "text", role: "bot", text: content };
}

// CHANGE (M12 Step 7B):
// Workspace-level effective mode should come from artifact truth first,
// then message-content heuristics, then stored session mode.
function deriveEffectiveHistorySessionMode(args: {
  items: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  sessionMode: Mode;
  sessionArtifact?: SessionArtifact | null;
}): Mode {
  const { items, sessionMode } = args;

  // BUG FIX (M12 Strategy + History triage):
  // Restore mode from the latest assistant signal only.
  // A shared workspace may contain older review/cases messages, but those must
  // not override the current stage for history restore.
  const latestAssistant = [...items].reverse().find((m) => m.role === "assistant");

  if (!latestAssistant) {
    return sessionMode;
  }

  if (tryParseReview(latestAssistant.content)) {
    return "review";
  }

  if (
    tryParseCasesLegacy(latestAssistant.content) ||
    looksLikeCasesPlainText(latestAssistant.content)
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

  const mapped: ChatItem[] = items
    .filter((m) => m.role !== "system")
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

  return { mapped, effectiveSessionMode };
}