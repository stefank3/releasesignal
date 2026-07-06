// app/chat/components/ChatMessageList.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted chat message rendering from page.tsx (no behavior change).
//
// CHANGE (M8.9 Copy Actions Cleanup):
// - removes duplicate wrapper-level copy buttons
// - relies on card-native copy actions where available
// - keeps rendering behavior clean and consistent
//
// CHANGE (M9):
// - small UI polish for evolving test suite sessions
// - clearer empty-state wording for persistent Cases mode
// - lightweight detection of "Test Suite vX" plain-text responses
//
// CHANGE (M10 UI Pass):
// - add theme-aware message rendering
// - remove hardcoded dark-only text/surface assumptions
// - keep behavior unchanged while supporting light / dark / system themes
//
// CHANGE (M12 Step 4B):
// - add callback bridge for editable test suite persistence
// - allow CasesTextCard to send edited cases back into session orchestration
// - keep this component as a prop-passing layer only
//
// CHANGE (M12 Step 6 / UI hardening):
// - surface deterministic workflow guidance for cases responses
// - tolerate multiple message payload shapes while UI mapping is stabilized
//
// M12.9 CHANGE:
// - wire contextual workflow action props into RequirementCard / CasesTextCard
// - keep this component as a rendering + prop-passing layer only
// - no workflow logic or API calls here
//
// M12.9 Phase 2 CHANGE:
// - wire Generate Next Batch props into CasesTextCard
// - wire Refine Requirement props into RequirementCard
// - keep visibility/enablement parent-driven
// - no workflow execution in this component
//
// M12.9 Phase 2 CHANGE:
// - wire Improve / Regenerate Suite props into CasesTextCard
// - keep it distinct from Generate Next Batch
// - keep parent-driven visibility/enablement
//
// M12.10 CHANGE:
// - highlight the latest requirement, suite, and review in long sessions
// - make older stacked suite outputs visually secondary
// - keep latest-visibility state derived only from rendered item order
// - avoid altering workflow logic or execution behavior
//
// M12.11 CHANGE:
// - improve first-run empty-state clarity inside the message area
// - add lightweight presentational onboarding labels for assistant artifacts
// - keep all action visibility and workflow state parent-driven

"use client";

import React from "react";

import type { TestCase } from "@/lib/chat/artifact";
import type { WorkflowGuidance } from "@/lib/server/chat/workflowAssistantService";

import type {
  CasesResult,
  ChatItem,
  Mode,
  ReviewResult,
  SessionArtifact,
} from "../chat.types";

import ReviewCard from "../cards/ReviewCard";
import CasesTextCard from "../cards/CasesTextCard";
import CasesLegacyCard from "../cards/CasesLegacyCard";
import RequirementCard from "../cards/RequirementCard";
import {
  formatArtifactVersion,
  joinProvenanceParts,
} from "./workspace/ArtifactProvenanceLabel";

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

function looksLikeJson(s: string) {
  const t = String(s ?? "").trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

/**
 * M9 CHANGE:
 * Detect the rendered evolving-suite response shape returned by the backend:
 *
 * Test Suite v2
 * Total test cases: 5
 */
function looksLikePersistedTestSuiteText(s: string): boolean {
  const t = String(s ?? "").trim();
  return /^Test Suite v\d+\s*\nTotal test cases:\s*\d+/i.test(t);
}

/**
 * M12.10 CHANGE:
 * Keep requirement detection centralized so latest-artifact highlighting
 * stays purely presentational and derived from rendered content.
 */
function looksLikeRequirementText(s: string): boolean {
  return String(s ?? "")
    .trimStart()
    .startsWith("Refined Technical Requirement");
}

type LatestArtifactIndexes = {
  latestRequirementIndex: number;
  latestPersistedSuiteIndex: number;
  latestReviewIndex: number;
};

/**
 * M12.10 CHANGE:
 * Identify the newest visible requirement / suite / review entries using
 * message order only. No workflow logic is inferred here.
 */
function getLatestArtifactIndexes(items: ChatItem[]): LatestArtifactIndexes {
  let latestRequirementIndex = -1;
  let latestPersistedSuiteIndex = -1;
  let latestReviewIndex = -1;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (
      item.kind === "text" &&
      item.role !== "user" &&
      looksLikeRequirementText(item.text)
    ) {
      latestRequirementIndex = i;
    }

    if (
      item.kind === "casesText" &&
      looksLikePersistedTestSuiteText(item.text)
    ) {
      latestPersistedSuiteIndex = i;
    }

    if (item.kind === "review") {
      latestReviewIndex = i;
    }
  }

  return {
    latestRequirementIndex,
    latestPersistedSuiteIndex,
    latestReviewIndex,
  };
}

/**
 * Coach readability fallback:
 * If bot reply is JSON, attempt to show a short readable summary.
 */
function tryFormatCoachJson(text: string): string | null {
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
      obj.highSignalApproach.testIdeas?.length
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

function isWorkflowGuidance(value: unknown): value is WorkflowGuidance {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<WorkflowGuidance>;

  return (
    typeof candidate.message === "string" &&
    typeof candidate.rationale === "string" &&
    (candidate.recommendedAction === "generate_more_cases" ||
      candidate.recommendedAction === "review_suite" ||
      candidate.recommendedAction === "refine_requirement" ||
      candidate.recommendedAction === "ready_for_execution")
  );
}

function getWorkflowGuidance(item: ChatItem): WorkflowGuidance | null {
  const candidate = item as ChatItem & {
    workflowGuidance?: unknown;
    payload?: { workflowGuidance?: unknown };
    response?: { workflowGuidance?: unknown };
    data?: { workflowGuidance?: unknown };
    meta?: { workflowGuidance?: unknown };
  };

  const possibleValues = [
    candidate.workflowGuidance,
    candidate.payload?.workflowGuidance,
    candidate.response?.workflowGuidance,
    candidate.data?.workflowGuidance,
    candidate.meta?.workflowGuidance,
  ];

  for (const value of possibleValues) {
    if (isWorkflowGuidance(value)) {
      return value;
    }
  }

  return null;
}

function getRequirementVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (artifact?.refinedRequirement as { version?: number } | undefined)?.version;
}

function getSuiteBasedOnRequirementVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (
    artifact?.testSuite as { basedOnRequirementVersion?: number } | undefined
  )?.basedOnRequirementVersion;
}

function getReviewBasedOnRequirementVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (
    artifact?.reviewResult as { basedOnRequirementVersion?: number } | undefined
  )?.basedOnRequirementVersion;
}

function getReviewBasedOnSuiteVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (
    artifact?.reviewResult as { basedOnSuiteVersion?: number } | undefined
  )?.basedOnSuiteVersion;
}

function buildRequirementProvenanceLabel(
  artifact: SessionArtifact | null | undefined
): string {
  return (
    joinProvenanceParts([
      "Technical Requirement",
      formatArtifactVersion("Requirement", getRequirementVersion(artifact)),
    ]) || "Technical Requirement"
  );
}

function buildSuiteProvenanceLabel(
  artifact: SessionArtifact | null | undefined
): string {
  return (
    joinProvenanceParts([
      formatArtifactVersion("Test Suite", artifact?.testSuite?.version),
      getSuiteBasedOnRequirementVersion(artifact)
        ? `Based on Requirement v${getSuiteBasedOnRequirementVersion(artifact)}`
        : null,
    ]) || "Test Suite"
  );
}

function buildReviewProvenanceLabel(
  artifact: SessionArtifact | null | undefined
): string {
  const suiteVersion = getReviewBasedOnSuiteVersion(artifact);
  const requirementVersion = getReviewBasedOnRequirementVersion(artifact);
  const basedOn =
    suiteVersion && requirementVersion
      ? `Based on Test Suite v${suiteVersion} and Requirement v${requirementVersion}`
      : suiteVersion
        ? `Based on Test Suite v${suiteVersion}`
        : requirementVersion
          ? `Based on Requirement v${requirementVersion}`
          : null;

  return (
    joinProvenanceParts([
      "Review Result",
      basedOn,
    ]) || "Review Result"
  );
}

function formatRecommendedAction(
  action: WorkflowGuidance["recommendedAction"]
): string {
  switch (action) {
    case "generate_more_cases":
      return "Generate more test cases";
    case "review_suite":
      return "Review the suite";
    case "refine_requirement":
      return "Refine the requirement";
    case "ready_for_execution":
      return "Ready for execution";
    default:
      return "Next step";
  }
}

function WorkflowGuidanceCard(args: {
  guidance: WorkflowGuidance;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        border: isDark
          ? "1px solid rgba(120,180,255,0.28)"
          : "1px solid rgba(37,99,235,0.20)",
        borderRadius: 14,
        padding: 12,
        background: isDark
          ? "rgba(120,180,255,0.08)"
          : "rgba(37,99,235,0.05)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      <div
        style={{ fontSize: 11, opacity: 0.72, fontWeight: 900, marginBottom: 6 }}
      >
        Assistant Insight
      </div>

      <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 6 }}>
        {formatRecommendedAction(args.guidance.recommendedAction)}
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
        {args.guidance.message}
      </div>

      <div
        style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.72, marginTop: 8 }}
      >
        Why: {args.guidance.rationale}
      </div>
    </div>
  );
}

/**
 * M12.10 CHANGE:
 * Shared artifact status label used to distinguish latest vs older stacked
 * results without changing card internals or message ordering.
 */
function ArtifactStatusPill(args: {
  label: string;
  resolvedTheme: "light" | "dark";
  tone: "latest" | "previous";
}) {
  const isDark = args.resolvedTheme === "dark";
  const isLatest = args.tone === "latest";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.2,
        border: isLatest
          ? isDark
            ? "1px solid rgba(74,222,128,0.40)"
            : "1px solid rgba(22,163,74,0.28)"
          : isDark
            ? "1px solid rgba(255,255,255,0.14)"
            : "1px solid rgba(15,23,42,0.12)",
        background: isLatest
          ? isDark
            ? "rgba(74,222,128,0.10)"
            : "rgba(22,163,74,0.08)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.04)",
        color: isDark ? "#ffffff" : "#0f172a",
        opacity: isLatest ? 1 : 0.72,
      }}
    >
      {args.label}
    </div>
  );
}

/**
 * M12.11 CHANGE:
 * Lightweight onboarding label for first-run readability inside long sessions.
 * This stays descriptive only and does not control actions or visibility.
 */
function ContextLabel(args: {
  label: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.25,
        textTransform: "uppercase",
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.035)",
        color: isDark ? "#ffffff" : "#0f172a",
        opacity: 0.82,
      }}
    >
      {args.label}
    </div>
  );
}

function EmptyStateCard(args: {
  mode: Mode;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  const title =
    args.mode === "coach"
      ? "Start with the requirement"
      : args.mode === "review"
        ? "Start with the suite to review"
        : "Start with the feature or saved requirement";

  const body =
    args.mode === "coach"
      ? "Start by refining a requirement or pasting a Jira/API change description. The workspace will help clarify scope, risks, and the next step."
      : args.mode === "review"
        ? "Paste the current test suite or plan to review. The workspace will return a score, coverage breakdown, and prioritized improvement areas."
        : "Use the saved refined requirement or describe additional coverage to generate a persistent test suite for this workspace.";

  const footer =
    args.mode === "coach"
      ? "Release Signal helps structure the requirement, generate a test suite, review coverage gaps, and summarize readiness."
      : args.mode === "review"
        ? "Release readiness is a signal; your QA/release owner remains responsible for final approval."
        : "Generated suites can then be reviewed and improved as the session evolves. Review generated tests before using them.";

  return (
    <div
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        padding: 14,
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 8,
      }}
    >
      <ContextLabel label="Empty state" resolvedTheme={args.resolvedTheme} />
      <div style={{ fontSize: 13, fontWeight: 950 }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>{body}</div>
      <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.68 }}>{footer}</div>
    </div>
  );
}

type Props = {
  items: ChatItem[];
  mode: Mode;
  sessionArtifact?: SessionArtifact | null;
  resolvedTheme?: "light" | "dark";
  hiddenItemIndexes?: number[];

  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;

  onGenerateTestsAction?: () => void;
  canGenerateTests?: boolean;
  isGeneratingTests?: boolean;

  onRefineRequirementAction?: () => void;
  canRefineRequirement?: boolean;
  isRefiningRequirement?: boolean;

  onReviewTestSuiteAction?: () => void;
  canReviewTestSuite?: boolean;
  isReviewingTestSuite?: boolean;

  onGenerateNextBatchAction?: () => void;
  canGenerateNextBatch?: boolean;
  isGeneratingNextBatch?: boolean;

  onRegenerateSuiteAction?: () => void;
  canRegenerateSuite?: boolean;
  isRegeneratingSuite?: boolean;
};

export default function ChatMessageList({
  items,
  mode,
  sessionArtifact = null,
  resolvedTheme = "dark",
  hiddenItemIndexes = [],
  onUpdateTestSuiteAction,

  onGenerateTestsAction,
  canGenerateTests = false,
  isGeneratingTests = false,

  onRefineRequirementAction,
  canRefineRequirement = false,
  isRefiningRequirement = false,

  onReviewTestSuiteAction,
  canReviewTestSuite = false,
  isReviewingTestSuite = false,

  onGenerateNextBatchAction,
  canGenerateNextBatch = false,
  isGeneratingNextBatch = false,

  onRegenerateSuiteAction,
  canRegenerateSuite = false,
  isRegeneratingSuite = false,
}: Props) {
  const isDark = resolvedTheme === "dark";

  const requestIdColor = isDark ? "#ffffff" : "#0f172a";
  const unknownColor = isDark
    ? "rgba(255,255,255,0.7)"
    : "rgba(15,23,42,0.7)";

  const {
    latestRequirementIndex,
    latestPersistedSuiteIndex,
    latestReviewIndex,
  } = getLatestArtifactIndexes(items);
  const hiddenIndexSet = new Set(hiddenItemIndexes);

  if (items.length === 0) {
    return <EmptyStateCard mode={mode} resolvedTheme={resolvedTheme} />;
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {items.map((it, idx) => {
        if (hiddenIndexSet.has(idx)) return null;

        const rolePart =
          it.kind === "text" ||
          it.kind === "review" ||
          it.kind === "casesText" ||
          it.kind === "casesLegacy" ||
          it.kind === "error"
            ? it.role
            : "item";

        const reqPart = it.requestId ?? "no-rid";
        const key = `${it.kind}-${rolePart}-${reqPart}-${idx}`;

        if (it.kind === "text") {
          const isUser = it.role === "user";

          const textToShow =
            !isUser && mode === "coach" && looksLikeJson(it.text)
              ? tryFormatCoachJson(it.text) ?? it.text
              : it.text;

          const isRequirement =
            !isUser &&
            typeof textToShow === "string" &&
            looksLikeRequirementText(textToShow);

          const isLatestRequirement =
            isRequirement && idx === latestRequirementIndex;

          const bubbleStyle: React.CSSProperties = {
            maxWidth: "78%",
            border: isDark
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(15,23,42,0.12)",
            borderRadius: 16,
            padding: 16,
            background: isUser
              ? isDark
                ? "rgba(0,0,0,0.55)"
                : "rgba(15,23,42,0.08)"
              : isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(15,23,42,0.03)",
            color: isDark ? "#ffffff" : "#0f172a",
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: 1.55,
          };

          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              {!isUser && isRequirement ? (
                <>
                  <ContextLabel
                    label="Requirement artifact"
                    resolvedTheme={resolvedTheme}
                  />
                  <ArtifactStatusPill
                    label={
                      isLatestRequirement
                        ? "Latest refined requirement"
                        : "Earlier refined requirement"
                    }
                    resolvedTheme={resolvedTheme}
                    tone={isLatestRequirement ? "latest" : "previous"}
                  />
                </>
              ) : null}

              <div
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                {isRequirement ? (
                  <div style={{ width: "100%", maxWidth: "100%" }}>
                    <RequirementCard
                      text={textToShow}
                      resolvedTheme={resolvedTheme}
                      provenanceLabel={
                        isLatestRequirement
                          ? buildRequirementProvenanceLabel(sessionArtifact)
                          : undefined
                      }
                      provenanceDescription={
                        isLatestRequirement
                          ? "Generated requirement artifact used for downstream test design."
                          : undefined
                      }
                      onGenerateTestsAction={onGenerateTestsAction}
                      canGenerateTests={canGenerateTests}
                      isGeneratingTests={isGeneratingTests}
                      onRefineRequirementAction={onRefineRequirementAction}
                      canRefineRequirement={canRefineRequirement}
                      isRefiningRequirement={isRefiningRequirement}
                    />
                  </div>
                ) : (
                  <div style={bubbleStyle}>
                    {textToShow}

                    {it.requestId ? (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 10,
                          opacity: 0.55,
                        }}
                      >
                        requestId: {it.requestId.slice(0, 8)}…
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {isRequirement && it.requestId ? (
                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.55,
                    color: requestIdColor,
                  }}
                >
                  requestId: {it.requestId.slice(0, 8)}…
                </div>
              ) : null}
            </div>
          );
        }

        if (it.kind === "review") {
          const isLatestReview = idx === latestReviewIndex;

          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <ContextLabel label="Review artifact" resolvedTheme={resolvedTheme} />
              <ArtifactStatusPill
                label={isLatestReview ? "Latest review result" : "Earlier review result"}
                resolvedTheme={resolvedTheme}
                tone={isLatestReview ? "latest" : "previous"}
              />

              <ReviewCard
                review={it.review as ReviewResult}
                resolvedTheme={resolvedTheme}
                provenanceLabel={
                  isLatestReview
                    ? buildReviewProvenanceLabel(sessionArtifact)
                    : undefined
                }
                provenanceDescription={
                  isLatestReview
                    ? "Persisted review result for the current test design."
                    : undefined
                }
                onImproveTestPlanAction={
                  isLatestReview ? onRegenerateSuiteAction : undefined
                }
                canImproveTestPlan={isLatestReview && canRegenerateSuite}
                isImprovingTestPlan={isLatestReview && isRegeneratingSuite}
                onGenerateFromGapsAction={
                  isLatestReview ? onGenerateNextBatchAction : undefined
                }
                canGenerateFromGaps={isLatestReview && canGenerateNextBatch}
                isGeneratingFromGaps={isLatestReview && isGeneratingNextBatch}
              />
            </div>
          );
        }

        if (it.kind === "casesText") {
          const isPersistedSuite = looksLikePersistedTestSuiteText(it.text);
          const workflowGuidance = getWorkflowGuidance(it);
          const isLatestPersistedSuite =
            isPersistedSuite && idx === latestPersistedSuiteIndex;

          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              {isPersistedSuite ? (
                <>
                  <ContextLabel
                    label="Test suite artifact"
                    resolvedTheme={resolvedTheme}
                  />
                  <ArtifactStatusPill
                    label={
                      isLatestPersistedSuite
                        ? "Latest persistent suite"
                        : "Earlier suite snapshot"
                    }
                    resolvedTheme={resolvedTheme}
                    tone={isLatestPersistedSuite ? "latest" : "previous"}
                  />
                </>
              ) : null}

              {workflowGuidance ? (
                <WorkflowGuidanceCard
                  guidance={workflowGuidance}
                  resolvedTheme={resolvedTheme}
                />
              ) : null}

              <CasesTextCard
                text={it.text}
                resolvedTheme={resolvedTheme}
                onUpdateTestSuiteAction={onUpdateTestSuiteAction}
                onReviewTestSuiteAction={onReviewTestSuiteAction}
                canReviewTestSuite={canReviewTestSuite}
                isReviewingTestSuite={isReviewingTestSuite}
                onGenerateNextBatchAction={onGenerateNextBatchAction}
                canGenerateNextBatch={canGenerateNextBatch}
                isGeneratingNextBatch={isGeneratingNextBatch}
                onRegenerateSuiteAction={onRegenerateSuiteAction}
                canRegenerateSuite={canRegenerateSuite}
                isRegeneratingSuite={isRegeneratingSuite}
                provenanceLabel={
                  isLatestPersistedSuite
                    ? buildSuiteProvenanceLabel(sessionArtifact)
                    : undefined
                }
                provenanceDescription={
                  isLatestPersistedSuite
                    ? "Generated test suite artifact used for review and execution evidence."
                    : undefined
                }
              />
            </div>
          );
        }

        if (it.kind === "casesLegacy") {
          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <CasesLegacyCard cases={it.cases as CasesResult} />
            </div>
          );
        }

        if (it.kind === "error") {
          return (
            <div
              key={key}
              style={{
                border: isDark
                  ? "1px solid rgba(255,80,200,0.55)"
                  : "1px solid rgba(220,38,38,0.40)",
                borderRadius: 16,
                padding: 16,
                background: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(220,38,38,0.05)",
                color: isDark ? "#ffffff" : "#7f1d1d",
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 10 }}>
                {it.title}
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
              >
                {it.details}
              </pre>
            </div>
          );
        }

        return (
          <div
            key={key}
            style={{ fontSize: 12, opacity: 0.7, color: unknownColor }}
          >
            Unknown message type
          </div>
        );
      })}
    </div>
  );
}
