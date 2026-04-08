// app/chat/components/FeatureWorkspaceSummary.tsx
// M12 Step 3:
// First visible feature-workspace layer.
// Shows artifact-backed session state for:
// - Refined Requirement
// - Test Suite
// - Review
//
// M12.10 CHANGE:
// - make current workspace stage easier to scan at a glance
// - emphasize the latest persisted artifact state over generic readiness
// - surface immediate next-step guidance without moving workflow logic
// - keep all summary state artifact-driven and parent-derived
//
// M12.11 CHANGE:
// - improve first-run readability of workspace state
// - clarify what each persisted artifact means in the workflow
// - strengthen empty-state guidance without changing any workflow behavior
//
// M12.15 CHANGE:
// - add first visible release-health summary card
// - keep all health display artifact-driven and read-only
// - do not compute release health in UI
// - surface explicit partial-state degradation from persisted artifact only

"use client";

import React from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

type Props = {
  chat: UseChatSessionReturn;
  resolvedTheme?: "light" | "dark";
};

function StatusChip(args: {
  ready: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 74,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        border: args.ready
          ? isDark
            ? "1px solid rgba(34,197,94,0.28)"
            : "1px solid rgba(22,163,74,0.25)"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        background: args.ready
          ? isDark
            ? "rgba(34,197,94,0.14)"
            : "rgba(22,163,74,0.10)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.04)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      {args.ready ? "Ready" : "Pending"}
    </span>
  );
}

function StageBadge(args: {
  text: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        border: isDark
          ? "1px solid rgba(120,180,255,0.24)"
          : "1px solid rgba(37,99,235,0.20)",
        background: isDark
          ? "rgba(120,180,255,0.08)"
          : "rgba(37,99,235,0.06)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      {args.text}
    </div>
  );
}

function SummaryCard(args: {
  title: string;
  ready: boolean;
  description: string;
  meta?: string;
  emphasis?: string;
  helpText?: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        padding: 12,
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 950,
            color: isDark ? "#ffffff" : "#0f172a",
          }}
        >
          {args.title}
        </div>

        <StatusChip ready={args.ready} resolvedTheme={args.resolvedTheme} />
      </div>

      {args.emphasis ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1.4,
            color: isDark ? "#ffffff" : "#0f172a",
          }}
        >
          {args.emphasis}
        </div>
      ) : null}

      <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.8 }}>
        {args.description}
      </div>

      {args.helpText ? (
        <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.72 }}>
          {args.helpText}
        </div>
      ) : null}

      {args.meta ? (
        <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
          {args.meta}
        </div>
      ) : null}
    </div>
  );
}

function normalizeStageTitle(title: string | undefined): string {
  return (
    String(title ?? "").replace(/^Workspace stage:\s*/i, "").trim() || "Unknown"
  );
}

function toRelativeStrength(score: number | null | undefined): string | null {
  if (typeof score !== "number") return null;
  if (score >= 90) return "Strong review result";
  if (score >= 75) return "Usable review result";
  if (score >= 50) return "Mixed review result";
  return "Weak review result";
}

function toReleaseHealthLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function FeatureWorkspaceSummary({
  chat,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  const requirementReady = chat.hasPinnedRequirement;
  const suiteReady = chat.hasPersistentTestSuite;
  const reviewReady = chat.hasReviewArtifact;

  const suiteVersion = chat.sessionArtifact?.testSuite?.version;
  const suiteCount = chat.sessionArtifact?.testSuite?.cases?.length ?? 0;
  const reviewScore = chat.sessionArtifact?.reviewResult?.score;

  const releaseHealth = chat.sessionArtifact?.releaseHealth ?? null;
  const releaseHealthReady = !!releaseHealth;
  const releaseHealthOverall = releaseHealth
    ? toReleaseHealthLabel(releaseHealth.overallStatus)
    : null;
  const releaseHealthCoverage = releaseHealth
    ? toReleaseHealthLabel(releaseHealth.coverageStatus)
    : null;
  const releaseHealthExecution = releaseHealth
    ? toReleaseHealthLabel(releaseHealth.executionStatus)
    : null;
  const releaseHealthFailureBurden = releaseHealth
    ? toReleaseHealthLabel(releaseHealth.failureBurden)
    : null;

  const currentStage = normalizeStageTitle(chat.workflowStatus.title);
  const nextAction = chat.workflowStatus.nextAction;

  const hasAnyArtifacts =
    requirementReady || suiteReady || reviewReady || releaseHealthReady;

  const requirementEmphasis = requirementReady
    ? "Latest refined requirement is available"
    : "Requirement refinement is still needed";

  const suiteEmphasis = suiteReady
    ? `Latest suite: v${suiteVersion ?? "—"}`
    : "No persisted suite yet";

  const reviewStrength = toRelativeStrength(reviewScore);
  const reviewEmphasis = reviewReady
    ? reviewStrength
      ? `${reviewStrength}${typeof reviewScore === "number" ? ` (${reviewScore}/100)` : ""}`
      : "Latest review result is available"
    : "No persisted review yet";

  const releaseHealthEmphasis = releaseHealthReady
    ? `Overall status: ${releaseHealthOverall}`
    : "No release health computed yet";

  const releaseHealthMeta = releaseHealthReady
    ? [
        releaseHealthCoverage ? `Coverage: ${releaseHealthCoverage}` : null,
        releaseHealthExecution ? `Execution: ${releaseHealthExecution}` : null,
        releaseHealthFailureBurden
          ? `Failure burden: ${releaseHealthFailureBurden}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Release health will appear once the dashboard signal is available";

  return (
    <div
      style={{
        marginBottom: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        padding: 14,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gap: 8 }}>
        <StageBadge
          text={`Current stage: ${currentStage}`}
          resolvedTheme={resolvedTheme}
        />

        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 950 }}>
            Feature Workspace
          </div>

          <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.45 }}>
            This session is tracked as a QA workspace backed by persisted artifacts.
          </div>

          <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
            {hasAnyArtifacts
              ? "The cards below show the latest saved requirement, suite, review, and release-health state for this workspace."
              : "No saved workspace artifacts exist yet. Start with the next recommended step below to begin building the workspace state."}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <SummaryCard
          title="Requirement"
          ready={requirementReady}
          emphasis={requirementEmphasis}
          description={
            requirementReady
              ? "A refined requirement is present and can drive downstream workflow actions."
              : "The feature scope still needs refinement before downstream workflow steps."
          }
          helpText={
            requirementReady
              ? "This is the saved requirement artifact used as the basis for test design."
              : "Start here when the feature scope, rules, or risks still need to be clarified."
          }
          meta={
            requirementReady
              ? "Strategy artifact present"
              : "No refined requirement saved yet"
          }
          resolvedTheme={resolvedTheme}
        />

        <SummaryCard
          title="Test Suite"
          ready={suiteReady}
          emphasis={suiteEmphasis}
          description={
            suiteReady
              ? "A generated test suite is available for this workspace."
              : "No persisted suite exists yet for this feature."
          }
          helpText={
            suiteReady
              ? "This is the latest saved suite artifact for the current requirement."
              : "Generate the suite after the requirement is clear and saved."
          }
          meta={
            suiteReady
              ? `${suiteCount} case${suiteCount === 1 ? "" : "s"} in the current persisted suite`
              : "Generate the suite from the refined requirement"
          }
          resolvedTheme={resolvedTheme}
        />

        <SummaryCard
          title="Review"
          ready={reviewReady}
          emphasis={reviewEmphasis}
          description={
            reviewReady
              ? "A persisted review result is available for the current suite."
              : "Coverage review has not yet been completed for this suite."
          }
          helpText={
            reviewReady
              ? "This reflects the latest saved review outcome for the current suite."
              : "Run review after a suite exists to evaluate coverage, gaps, and improvement areas."
          }
          meta={
            reviewReady
              ? `Review score: ${
                  typeof reviewScore === "number" ? `${reviewScore}/100` : "available"
                }`
              : "Run Test Review against the current suite"
          }
          resolvedTheme={resolvedTheme}
        />

        <SummaryCard
          title="Release Health"
          ready={releaseHealthReady}
          emphasis={releaseHealthEmphasis}
          description={
            releaseHealthReady
              ? "A deterministic release-health artifact is available from the latest persisted workspace state."
              : "Release health has not yet been surfaced for this workspace."
          }
          helpText={
            releaseHealthReady
              ? "This view is read-only and reflects the latest saved health rollup from requirement, suite, review, and execution artifacts."
              : "This will become visible once release-health data is computed and persisted by the backend."
          }
          meta={releaseHealthMeta}
          resolvedTheme={resolvedTheme}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 4,
          fontSize: 11,
          opacity: 0.78,
          lineHeight: 1.45,
          borderTop: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(15,23,42,0.08)",
          paddingTop: 10,
        }}
      >
        <div>
          Current stage: <strong style={{ fontWeight: 900 }}>{currentStage}</strong>
        </div>
        <div>
          Next step: <strong style={{ fontWeight: 900 }}>{nextAction}</strong>
        </div>
      </div>
    </div>
  );
}