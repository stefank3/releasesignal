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

"use client";

import React from "react";

import type { TestCase } from "@/lib/chat/artifact";
import type { WorkflowGuidance } from "@/lib/server/chat/workflowAssistantService";

import type { ChatItem, Mode, ReviewResult, CasesResult } from "../chat.types";

import ReviewCard from "../cards/ReviewCard";
import CasesTextCard from "../cards/CasesTextCard";
import CasesLegacyCard from "../cards/CasesLegacyCard";
import RequirementCard from "../cards/RequirementCard";

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

type Props = {
  items: ChatItem[];
  mode: Mode;
  resolvedTheme?: "light" | "dark";

  // M12 Step 4B:
  // callback passed down from session orchestration so editable cases
  // can persist through the artifact layer.
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;
};

export default function ChatMessageList({
  items,
  mode,
  resolvedTheme = "dark",
  onUpdateTestSuiteAction,
}: Props) {
  const isDark = resolvedTheme === "dark";

  const emptyStateColor = isDark
    ? "rgba(255,255,255,0.78)"
    : "rgba(15,23,42,0.78)";
  const requestIdColor = isDark ? "#ffffff" : "#0f172a";
  const unknownColor = isDark
    ? "rgba(255,255,255,0.7)"
    : "rgba(15,23,42,0.7)";

  if (items.length === 0) {
    return (
      <div style={{ color: emptyStateColor, fontSize: 13, lineHeight: 1.55 }}>
        {mode === "coach"
          ? "Describe a feature. I’ll draft a risk-based approach + test ideas immediately, then refine the requirement as the session evolves."
          : mode === "review"
            ? "Paste test cases or a test plan. I’ll return a score, breakdown, and prioritized improvements."
            : "Describe the feature or use the Refined Requirement. I’ll generate a persistent plain-text test suite that can evolve across this session."}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {items.map((it, idx) => {
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

        // ---------------- TEXT ----------------
        if (it.kind === "text") {
          const isUser = it.role === "user";

          const textToShow =
            !isUser && mode === "coach" && looksLikeJson(it.text)
              ? tryFormatCoachJson(it.text) ?? it.text
              : it.text;

          const isRequirement =
            !isUser &&
            mode === "coach" &&
            typeof textToShow === "string" &&
            textToShow.startsWith("Refined Technical Requirement");

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
              <div
                style={{
                  display: "flex",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                }}
              >
                {isRequirement ? (
                  <div style={{ width: "100%", maxWidth: "100%" }}>
                    <RequirementCard text={textToShow} />
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

        // ---------------- REVIEW ----------------
        if (it.kind === "review") {
          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <ReviewCard
                review={it.review as ReviewResult}
                resolvedTheme={resolvedTheme}
              />
            </div>
          );
        }

        // ---------------- CASES TEXT ----------------
        if (it.kind === "casesText") {
          const isPersistedSuite = looksLikePersistedTestSuiteText(it.text);
          const workflowGuidance = getWorkflowGuidance(it);

          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              {isPersistedSuite ? (
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.66,
                    color: requestIdColor,
                  }}
                >
                  Persistent suite workspace
                </div>
              ) : null}

              {workflowGuidance ? (
                <WorkflowGuidanceCard
                  guidance={workflowGuidance}
                  resolvedTheme={resolvedTheme}
                />
              ) : null}

              <CasesTextCard
                text={it.text}
                onUpdateTestSuiteAction={onUpdateTestSuiteAction}
              />
            </div>
          );
        }

        // ---------------- LEGACY CASES ----------------
        if (it.kind === "casesLegacy") {
          return (
            <div key={key} style={{ display: "grid", gap: 10 }}>
              <CasesLegacyCard cases={it.cases as CasesResult} />
            </div>
          );
        }

        // ---------------- ERROR ----------------
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