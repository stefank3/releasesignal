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
//
// M12.15 FOLLOW-UP CHANGE:
// - align Requirement / Test Suite / Review with the compact dashboard card style
// - keep compact artifact cards visually aligned
// - preserve artifact-driven behavior and avoid turning the workspace into a full analytics dashboard
//
// M15 CHANGE:
// - surface deterministic suite export action from the Test Suite card
// - keep export formatting in the dedicated server export layer
// - UI only triggers the export API and does not mutate/read-map artifact content
//
// M16 CHANGE:
// - wire persisted execution evidence into the workspace through a dedicated display component
// - keep execution display read-only and artifact-driven
// - do not calculate execution truth, review score changes, or release readiness in this file
//
// M17 CLEANUP:
// - remove the large release-readiness report from the compact workspace summary
// - keep this file focused on artifact summary cards only
// - release readiness remains available through the dedicated readiness service/component
// - future M17 reporting should use a separate dashboard surface or collapsed panel

"use client";

import React from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { ExecutionEvidenceSummary } from "./ExecutionEvidenceSummary";
import { TestSuiteExportMenu } from "./TestSuiteExportMenu";

type Props = {
  chat: UseChatSessionReturn;
  resolvedTheme?: "light" | "dark";
};

type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

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

function getToneStyles(
  tone: Tone,
  isDark: boolean
): { border: string; background: string } {
  switch (tone) {
    case "positive":
      return {
        border: isDark
          ? "1px solid rgba(34,197,94,0.28)"
          : "1px solid rgba(22,163,74,0.22)",
        background: isDark
          ? "rgba(34,197,94,0.14)"
          : "rgba(22,163,74,0.10)",
      };
    case "warning":
      return {
        border: isDark
          ? "1px solid rgba(245,158,11,0.30)"
          : "1px solid rgba(217,119,6,0.24)",
        background: isDark
          ? "rgba(245,158,11,0.14)"
          : "rgba(245,158,11,0.10)",
      };
    case "negative":
      return {
        border: isDark
          ? "1px solid rgba(239,68,68,0.28)"
          : "1px solid rgba(220,38,38,0.22)",
        background: isDark
          ? "rgba(239,68,68,0.14)"
          : "rgba(239,68,68,0.10)",
      };
    case "info":
      return {
        border: isDark
          ? "1px solid rgba(96,165,250,0.28)"
          : "1px solid rgba(37,99,235,0.22)",
        background: isDark
          ? "rgba(96,165,250,0.14)"
          : "rgba(37,99,235,0.08)",
      };
    default:
      return {
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(15,23,42,0.04)",
      };
  }
}

function DashboardTile(args: {
  label: string;
  value: string;
  tone: Tone;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const toneStyles = getToneStyles(args.tone, isDark);

  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        padding: "8px 9px",
        borderRadius: 12,
        border: toneStyles.border,
        background: toneStyles.background,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.72 }}>
        {args.label}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1.35,
          color: isDark ? "#ffffff" : "#0f172a",
        }}
      >
        {args.value}
      </div>
    </div>
  );
}

function DashboardSummaryCard(args: {
  title: string;
  ready: boolean;
  emphasis: string;
  description: string;
  tiles: Array<{
    label: string;
    value: string;
    tone: Tone;
  }>;
  helpText?: string;
  meta?: string;
  actionSlot?: React.ReactNode;
  tourAnchor?: string;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const accentTone: Tone = args.ready ? "info" : "neutral";

  return (
    <div
      data-tour-anchor={args.tourAnchor}
      style={{
        border: getAccentBorder(accentTone, isDark),
        borderRadius: 14,
        padding: 12,
        background: getAccentBackground(accentTone, isDark),
        display: "grid",
        gap: 10,
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

      <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.82 }}>
        {args.description}
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {args.tiles.map((tile) => (
          <DashboardTile
            key={`${args.title}-${tile.label}`}
            label={tile.label}
            value={tile.value}
            tone={tile.tone}
            resolvedTheme={args.resolvedTheme}
          />
        ))}
      </div>

      {args.helpText ? (
        <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.74 }}>
          {args.helpText}
        </div>
      ) : null}

      {args.meta ? (
        <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
          {args.meta}
        </div>
      ) : null}

      {args.actionSlot ? (
        <div
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
            paddingTop: 8,
          }}
        >
          {args.actionSlot}
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
  if (score >= 90) return "Strong";
  if (score >= 75) return "Usable";
  if (score >= 50) return "Mixed";
  return "Weak";
}

function toReleaseHealthLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function toOverallTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "unknown") return "neutral";
  if (normalized.includes("not ready")) return "warning";
  if (normalized.includes("ready")) return "positive";
  if (normalized.includes("healthy")) return "positive";
  if (normalized.includes("needs")) return "warning";
  if (normalized.includes("degraded")) return "negative";
  if (normalized.includes("blocked")) return "negative";

  return "info";
}

function toCoverageTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "unknown") return "neutral";
  if (normalized.includes("review")) return "positive";
  if (normalized.includes("suite ready")) return "info";
  if (normalized.includes("requirement only")) return "warning";
  if (normalized.includes("missing")) return "warning";

  return "info";
}

function toExecutionTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "unknown") return "neutral";
  if (normalized.includes("passed")) return "positive";
  if (normalized.includes("not started")) return "warning";
  if (normalized.includes("failed")) return "negative";
  if (normalized.includes("blocked")) return "negative";
  if (normalized.includes("partial")) return "warning";

  return "info";
}

function toFailureBurdenTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "unknown") return "neutral";
  if (normalized.includes("none")) return "positive";
  if (normalized.includes("low")) return "info";
  if (normalized.includes("medium")) return "warning";
  if (normalized.includes("high")) return "negative";

  return "info";
}

function getAccentBorder(tone: Tone, isDark: boolean): string {
  switch (tone) {
    case "positive":
      return isDark
        ? "1px solid rgba(34,197,94,0.24)"
        : "1px solid rgba(22,163,74,0.18)";
    case "warning":
      return isDark
        ? "1px solid rgba(245,158,11,0.24)"
        : "1px solid rgba(217,119,6,0.18)";
    case "negative":
      return isDark
        ? "1px solid rgba(239,68,68,0.24)"
        : "1px solid rgba(220,38,38,0.18)";
    case "info":
      return isDark
        ? "1px solid rgba(96,165,250,0.24)"
        : "1px solid rgba(37,99,235,0.18)";
    default:
      return isDark
        ? "1px solid rgba(255,255,255,0.10)"
        : "1px solid rgba(15,23,42,0.10)";
  }
}

function getAccentBackground(tone: Tone, isDark: boolean): string {
  switch (tone) {
    case "positive":
      return isDark ? "rgba(34,197,94,0.05)" : "rgba(22,163,74,0.05)";
    case "warning":
      return isDark ? "rgba(245,158,11,0.05)" : "rgba(245,158,11,0.05)";
    case "negative":
      return isDark ? "rgba(239,68,68,0.05)" : "rgba(239,68,68,0.05)";
    case "info":
      return isDark ? "rgba(96,165,250,0.05)" : "rgba(37,99,235,0.05)";
    default:
      return isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.025)";
  }
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

  // M15:
  // Export uses the active persisted session id only.
  // The export menu calls the dedicated export API and does not own export logic.
  const exportSessionId =
    ((chat as { activeSessionId?: string | null }).activeSessionId ?? null) ||
    ((chat as { sessionId?: string | null }).sessionId ?? null);

  // M16:
  // Execution evidence is rendered from the persisted artifact only.
  // The UI does not calculate execution truth, mutate artifacts, or infer release readiness.
  const executionEvidence = chat.sessionArtifact?.executionIntelligence ?? null;
  const executionEvidenceReady = !!executionEvidence;

  const currentStage = normalizeStageTitle(chat.workflowStatus.title);
  const nextAction = chat.workflowStatus.nextAction;

  const hasAnyArtifacts =
    requirementReady ||
    suiteReady ||
    reviewReady ||
    executionEvidenceReady;

  const requirementEmphasis = requirementReady
    ? "Latest refined requirement is available"
    : "Requirement refinement is still needed";

  const suiteEmphasis = suiteReady
    ? `Latest suite: v${suiteVersion ?? "—"}`
    : "No persisted suite yet";

  const reviewStrength = toRelativeStrength(reviewScore);
  const reviewEmphasis = reviewReady
    ? reviewStrength
      ? `${reviewStrength} review result${
          typeof reviewScore === "number" ? ` (${reviewScore}/100)` : ""
        }`
      : "Latest review result is available"
    : "No persisted review yet";

  const requirementTiles = [
    {
      label: "State",
      value: requirementReady ? "Saved" : "Missing",
      tone: requirementReady ? "positive" : "warning",
    },
    {
      label: "Workflow",
      value: requirementReady ? "Can drive design" : "Needs refinement",
      tone: requirementReady ? "info" : "warning",
    },
    {
      label: "Artifact",
      value: requirementReady ? "Requirement artifact" : "Not available",
      tone: requirementReady ? "info" : "neutral",
    },
    {
      label: "Readiness",
      value: requirementReady ? "Ready" : "Pending",
      tone: requirementReady ? "positive" : "neutral",
    },
  ] as const;

  const suiteTiles = [
    {
      label: "Version",
      value: suiteReady ? `v${suiteVersion ?? "—"}` : "—",
      tone: suiteReady ? "info" : "neutral",
    },
    {
      label: "Cases",
      value: suiteReady ? String(suiteCount) : "0",
      tone: suiteReady ? "info" : "neutral",
    },
    {
      label: "State",
      value: suiteReady ? "Saved" : "Missing",
      tone: suiteReady ? "positive" : "warning",
    },
    {
      label: "Readiness",
      value: suiteReady ? "Ready" : "Pending",
      tone: suiteReady ? "positive" : "neutral",
    },
  ] as const;

  const reviewTiles = [
    {
      label: "Score",
      value:
        reviewReady && typeof reviewScore === "number"
          ? `${reviewScore}/100`
          : "—",
      tone:
        reviewReady && typeof reviewScore === "number"
          ? reviewScore >= 90
            ? "positive"
            : reviewScore >= 75
              ? "info"
              : reviewScore >= 50
                ? "warning"
                : "negative"
          : "neutral",
    },
    {
      label: "Strength",
      value: reviewReady ? reviewStrength ?? "Available" : "—",
      tone: reviewReady
        ? reviewStrength === "Strong"
          ? "positive"
          : reviewStrength === "Usable"
            ? "info"
            : reviewStrength === "Mixed"
              ? "warning"
              : "negative"
        : "neutral",
    },
    {
      label: "State",
      value: reviewReady ? "Saved" : "Missing",
      tone: reviewReady ? "positive" : "warning",
    },
    {
      label: "Readiness",
      value: reviewReady ? "Ready" : "Pending",
      tone: reviewReady ? "positive" : "neutral",
    },
  ] as const;

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
              ? "The cards below show the latest saved requirement, suite, review, and execution evidence."
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
        <DashboardSummaryCard
          title="Requirement"
          tourAnchor="requirement-card"
          ready={requirementReady}
          emphasis={requirementEmphasis}
          description={
            requirementReady
              ? "A refined requirement is present and can drive downstream workflow actions."
              : "The feature scope still needs refinement before downstream workflow steps."
          }
          tiles={[...requirementTiles]}
          helpText={
            requirementReady
              ? "This is the saved requirement artifact used as the basis for test design."
              : "Start here when the feature scope, rules, or risks still need to be clarified."
          }
          meta={
            requirementReady
              ? "Requirement artifact present"
              : "No refined requirement saved yet"
          }
          resolvedTheme={resolvedTheme}
        />

        <DashboardSummaryCard
          title="Test Suite"
          tourAnchor="test-suite-card"
          ready={suiteReady}
          emphasis={suiteEmphasis}
          description={
            suiteReady
              ? "A generated test suite is available for this workspace."
              : "No persisted suite exists yet for this feature."
          }
          tiles={[...suiteTiles]}
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
          actionSlot={
            suiteReady ? (
              <TestSuiteExportMenu
                sessionId={exportSessionId}
                disabled={!suiteReady}
              />
            ) : null
          }
          resolvedTheme={resolvedTheme}
        />

        <DashboardSummaryCard
          title="Review"
          tourAnchor="review-card"
          ready={reviewReady}
          emphasis={reviewEmphasis}
          description={
            reviewReady
              ? "A persisted review result is available for the current suite."
              : "Coverage review has not yet been completed for this suite."
          }
          tiles={[...reviewTiles]}
          helpText={
            reviewReady
              ? "This reflects the latest saved review outcome for the current suite."
              : "Run review after a suite exists to evaluate coverage, gaps, and improvement areas."
          }
          meta={
            reviewReady
              ? `Review score: ${
                  typeof reviewScore === "number"
                    ? `${reviewScore}/100`
                    : "available"
                }`
              : "Run Test Review against the current suite"
          }
          resolvedTheme={resolvedTheme}
        />

        <div data-tour-anchor="execution-evidence-card">
          <ExecutionEvidenceSummary
            execution={executionEvidence}
            sessionId={exportSessionId}
            uploadDisabled={!suiteReady}
            resolvedTheme={resolvedTheme}
            onExecutionUploadSuccess={chat.applyExecutionEvidenceUpload}
          />
        </div>
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
