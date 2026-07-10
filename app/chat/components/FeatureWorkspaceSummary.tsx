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
import { buildReleaseReadinessSummary } from "@/lib/release-readiness/releaseReadinessService";
import type { ReleaseReadinessStatus } from "@/lib/release-readiness/releaseReadinessTypes";
import type { UseChatSessionReturn } from "../hooks/useChatSession";
import { ExecutionEvidenceSummary } from "./ExecutionEvidenceSummary";
import { TestSuiteExportMenu } from "./TestSuiteExportMenu";

type Props = {
  chat: UseChatSessionReturn;
  resolvedTheme?: "light" | "dark";
  commandCenter?: boolean;
  onCreditsMayHaveChanged?: () => void;
};

type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

function StatusChip(args: {
  ready: boolean;
  active?: boolean;
  label?: string;
  tone?: "neutral" | "positive" | "warning" | "negative" | "info";
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const tone = args.tone ?? (args.ready ? "positive" : args.active ? "info" : "neutral");

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
        border: tone === "positive"
          ? isDark
            ? "1px solid rgba(34,197,94,0.28)"
            : "1px solid rgba(22,163,74,0.25)"
          : tone === "info"
            ? isDark
              ? "1px solid rgba(96,165,250,0.28)"
              : "1px solid rgba(37,99,235,0.22)"
          : tone === "warning"
            ? isDark
              ? "1px solid rgba(245,158,11,0.30)"
              : "1px solid rgba(217,119,6,0.24)"
          : tone === "negative"
            ? isDark
              ? "1px solid rgba(239,68,68,0.30)"
              : "1px solid rgba(220,38,38,0.24)"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        background: tone === "positive"
          ? isDark
            ? "rgba(34,197,94,0.14)"
            : "rgba(22,163,74,0.10)"
          : tone === "info"
            ? isDark
              ? "rgba(96,165,250,0.14)"
              : "rgba(37,99,235,0.08)"
          : tone === "warning"
            ? isDark
              ? "rgba(245,158,11,0.13)"
              : "rgba(245,158,11,0.10)"
          : tone === "negative"
            ? isDark
              ? "rgba(239,68,68,0.12)"
              : "rgba(220,38,38,0.08)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.04)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      {args.label ??
        (args.ready ? "Complete" : args.active ? "In progress" : "Not started yet")}
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

function getCommandCenterTileStyles(
  tone: Tone,
  isDark: boolean
): { border: string; background: string } {
  switch (tone) {
    case "positive":
      return {
        border: isDark
          ? "1px solid rgba(34,197,94,0.22)"
          : "1px solid rgba(22,163,74,0.18)",
        background: isDark
          ? "rgba(34,197,94,0.08)"
          : "rgba(22,163,74,0.06)",
      };
    case "warning":
      return {
        border: isDark
          ? "1px solid rgba(245,158,11,0.28)"
          : "1px solid rgba(217,119,6,0.22)",
        background: isDark
          ? "rgba(245,158,11,0.10)"
          : "rgba(245,158,11,0.07)",
      };
    case "negative":
      return {
        border: isDark
          ? "1px solid rgba(239,68,68,0.26)"
          : "1px solid rgba(220,38,38,0.20)",
        background: isDark
          ? "rgba(239,68,68,0.10)"
          : "rgba(220,38,38,0.07)",
      };
    case "info":
      return {
        border: isDark
          ? "1px solid rgba(96,165,250,0.26)"
          : "1px solid rgba(37,99,235,0.20)",
        background: isDark
          ? "rgba(96,165,250,0.10)"
          : "rgba(37,99,235,0.06)",
      };
    default:
      return {
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark
          ? "rgba(255,255,255,0.035)"
          : "rgba(15,23,42,0.025)",
      };
  }
}

function DashboardTile(args: {
  label: string;
  value: string;
  tone: Tone;
  resolvedTheme: "light" | "dark";
  commandCenter?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";
  const toneStyles = args.commandCenter
    ? getCommandCenterTileStyles(args.tone, isDark)
    : getToneStyles(args.tone, isDark);

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
  active?: boolean;
  stepLabel: string;
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
  statusLabel?: string;
  statusTone?: "neutral" | "positive" | "warning" | "negative" | "info";
  resolvedTheme: "light" | "dark";
  commandCenter?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";
  const accentTone: Tone = args.active ? "info" : args.ready ? "positive" : "neutral";
  const cardBorder = args.commandCenter
    ? getCommandCenterCardBorder(accentTone, isDark)
    : getAccentBorder(accentTone, isDark);
  const cardBackground = args.commandCenter
    ? getCommandCenterCardBackground(args.active ? "info" : "neutral", isDark)
    : getAccentBackground(accentTone, isDark);

  return (
    <div
      data-tour-anchor={args.tourAnchor}
      style={{
        border: cardBorder,
        borderRadius: args.commandCenter ? 12 : 14,
        padding: 12,
        background: cardBackground,
        display: "grid",
        gap: 10,
        minHeight: args.commandCenter ? 276 : 250,
        alignContent: "start",
        gridTemplateRows: args.commandCenter
          ? "auto auto auto 1fr auto"
          : undefined,
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
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 950,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: args.active
                ? isDark
                  ? "rgba(147,197,253,0.95)"
                  : "rgba(37,99,235,0.86)"
                : isDark
                  ? "rgba(255,255,255,0.58)"
                  : "rgba(15,23,42,0.55)",
            }}
          >
            {args.stepLabel}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 950,
              color: isDark ? "#ffffff" : "#0f172a",
            }}
          >
            {args.title}
          </div>
        </div>

        <StatusChip
          ready={args.ready}
          active={args.active}
          label={args.statusLabel}
          tone={args.statusTone}
          resolvedTheme={args.resolvedTheme}
        />
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
            commandCenter={args.commandCenter}
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

function openArtifactRow(kind: "requirement" | "suite" | "review" | "execution") {
  const row = document.querySelector<HTMLDetailsElement>(
    `[data-artifact-row="${kind}"]`
  );
  if (!row) return;

  row.open = true;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
}

function ArtifactOpenButton(args: {
  label: string;
  kind: "requirement" | "suite" | "review" | "execution";
  resolvedTheme: "light" | "dark";
  disabled?: boolean;
  onClickAction?: () => void;
}) {
  const isDark = args.resolvedTheme === "dark";
  const disabled = args.disabled ?? false;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (args.onClickAction) {
          args.onClickAction();
          return;
        }
        openArtifactRow(args.kind);
      }}
      style={{
        width: "100%",
        borderRadius: 10,
        border: isDark
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(15,23,42,0.12)",
        background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
        color: isDark ? "#ffffff" : "#0f172a",
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.58 : 1,
      }}
    >
      {args.label}
    </button>
  );
}

function normalizeStageTitle(title: string | undefined): string {
  return (
    String(title ?? "").replace(/^Workspace stage:\s*/i, "").trim() || "Unknown"
  );
}

function getStageIndex(args: {
  requirementReady: boolean;
  suiteReady: boolean;
  reviewReady: boolean;
  executionEvidenceReady: boolean;
  readinessCalculated?: boolean;
}): number {
  if (args.readinessCalculated) return 5;
  if (args.executionEvidenceReady) return 4;
  if (args.reviewReady) return 3;
  if (args.suiteReady) return 2;
  return 1;
}

function isReadinessCalculated(status: ReleaseReadinessStatus): boolean {
  return status !== "insufficient_data";
}

function getReadinessStageLabel(status: ReleaseReadinessStatus): string {
  if (isReadinessCalculated(status)) return "Readiness signal calculated";
  return "Review release readiness";
}

function getReadinessNextAction(status: ReleaseReadinessStatus): string {
  switch (status) {
    case "ready":
      return "Review the readiness signal, then make the final release decision.";
    case "ready_with_risk":
      return "Review remaining warnings and decide whether the residual risk is acceptable.";
    case "not_ready":
      return "Address failed or skipped execution results, then re-upload evidence and review readiness again.";
    default:
      return "Review the readiness signal and decide the next release action.";
  }
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

function getCommandCenterCardBorder(tone: Tone, isDark: boolean): string {
  if (tone === "info") {
    return isDark
      ? "1px solid #D97757"
      : "1px solid #C15F3C";
  }

  return isDark
    ? "1px solid #3A382F"
    : "1px solid #D9D3C2";
}

function getCommandCenterCardBackground(tone: Tone, isDark: boolean): string {
  if (tone === "info") {
    return isDark
      ? "linear-gradient(180deg, rgba(217,119,87,0.16), #2B2A26)"
      : "linear-gradient(180deg, rgba(193,95,60,0.10), #FCFBF6)";
  }

  return isDark ? "#2B2A26" : "#FCFBF6";
}

export default function FeatureWorkspaceSummary({
  chat,
  resolvedTheme = "dark",
  commandCenter = false,
  onCreditsMayHaveChanged,
}: Props) {
  const isDark = resolvedTheme === "dark";

  const requirementReady = chat.hasPinnedRequirement;
  const suiteReady = chat.hasPersistentTestSuite;
  const reviewReady = chat.hasReviewArtifact;

  const suiteVersion = chat.sessionArtifact?.testSuite?.version;
  const suiteCount = chat.sessionArtifact?.testSuite?.cases?.length ?? 0;
  const suiteP1Count =
    chat.sessionArtifact?.testSuite?.cases?.filter((item) => item.priority === "P1")
      .length ?? 0;
  const reviewScore = chat.sessionArtifact?.reviewResult?.score;
  const reviewGapCount = chat.sessionArtifact?.reviewResult?.riskGaps?.length ?? 0;
  const requirementVersion = (
    chat.sessionArtifact?.refinedRequirement as { version?: number } | undefined
  )?.version;
  const requirementRiskCount =
    (chat.sessionArtifact?.refinedRequirement?.riskAreas?.length ?? 0) ||
    (chat.sessionArtifact?.refinedRequirement?.riskFocus?.length ?? 0);

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
  const readiness = buildReleaseReadinessSummary(chat.sessionArtifact ?? null);
  const readinessCalculated = isReadinessCalculated(readiness.status);

  const currentStage = normalizeStageTitle(chat.workflowStatus.title);
  const displayedStage = readinessCalculated
    ? getReadinessStageLabel(readiness.status)
    : currentStage;
  const nextAction = readinessCalculated
    ? getReadinessNextAction(readiness.status)
    : chat.workflowStatus.nextAction;
  const stageIndex = getStageIndex({
    requirementReady,
    suiteReady,
    reviewReady,
    executionEvidenceReady,
    readinessCalculated,
  });

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
  const executionStatus = toReleaseHealthLabel(executionEvidence?.suiteStatus);
  const executionSummary = executionEvidence?.summary;
  const reviewActionLabel = reviewReady
    ? "View latest review"
    : suiteReady
      ? "Review test suite"
      : "Review unavailable";
  const executionActionLabel = executionEvidenceReady
    ? "View execution results"
    : "Upload execution results";

  const requirementTiles = [
    {
      label: "State",
      value: requirementReady ? "Saved" : "Not started yet",
      tone: requirementReady ? "positive" : "neutral",
    },
    {
      label: commandCenter ? "Version" : "Workflow",
      value: commandCenter
        ? requirementReady
          ? `v${requirementVersion ?? 1}`
          : "-"
        : requirementReady
          ? "Can drive design"
          : "Needs refinement",
      tone: requirementReady ? "info" : "neutral",
    },
    {
      label: "Artifact",
      value: requirementReady
        ? commandCenter
          ? "Ready"
          : "Requirement artifact"
        : "-",
      tone: requirementReady ? "info" : "neutral",
    },
    {
      label: commandCenter ? "Risks" : "Workspace",
      value: commandCenter
        ? requirementReady
          ? String(requirementRiskCount)
          : "-"
        : requirementReady
          ? "Available"
          : "Not started yet",
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
      label: commandCenter ? "Cases" : "State",
      value: commandCenter
        ? suiteReady
          ? String(suiteCount)
          : "-"
        : suiteReady
          ? "Saved"
          : "Not started yet",
      tone: suiteReady ? "positive" : "neutral",
    },
    {
      label: commandCenter ? "P1" : "Workspace",
      value: commandCenter
        ? suiteReady
          ? String(suiteP1Count)
          : "-"
        : suiteReady
          ? "Available"
          : "Not started yet",
      tone: suiteReady ? "positive" : "neutral",
    },
  ] as const;

  const reviewTiles = [
    {
      label: commandCenter ? "Score" : "Review Score",
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
      label: commandCenter ? "Grade" : "Strength",
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
      label: commandCenter ? "Gaps" : "State",
      value: commandCenter
        ? reviewReady
          ? String(reviewGapCount)
          : "-"
        : reviewReady
          ? "Saved"
          : "Not started yet",
      tone: reviewReady ? "positive" : "neutral",
    },
    {
      label: commandCenter ? "Suite" : "Workspace",
      value: commandCenter
        ? reviewReady
          ? `v${suiteVersion ?? "—"}`
          : "-"
        : reviewReady
          ? "Available"
          : "Not started yet",
      tone: reviewReady ? "positive" : "neutral",
    },
  ] as const;

  const executionTiles = [
    {
      label: "Status",
      value: executionEvidenceReady ? executionStatus : "-",
      tone: executionEvidenceReady ? toExecutionTone(executionStatus) : "neutral",
    },
    {
      label: "Linked suite",
      value:
        executionEvidenceReady && typeof executionEvidence?.suiteVersion === "number"
          ? `v${executionEvidence.suiteVersion}`
          : "-",
      tone: executionEvidenceReady ? "info" : "neutral",
    },
    {
      label: "Source",
      value: executionEvidenceReady
        ? toReleaseHealthLabel(executionEvidence?.source)
        : "-",
      tone: executionEvidenceReady ? "info" : "neutral",
    },
    {
      label: "Total",
      value:
        executionEvidenceReady && executionSummary
          ? String(executionSummary.total)
          : "-",
      tone: executionEvidenceReady ? "info" : "neutral",
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
          text={`Stage ${stageIndex} of 5 - ${displayedStage}`}
          resolvedTheme={resolvedTheme}
        />

        {commandCenter ? null : (
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 950 }}>
              Feature Workspace
            </div>

            <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.45 }}>
              This session is tracked as a QA workspace backed by persisted
              artifacts, not free-form AI text.
            </div>

            <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
              {hasAnyArtifacts
                ? "The cards below show the latest saved requirement, suite, review, and execution evidence."
                : "No saved workspace artifacts exist yet. Start by refining a requirement or pasting a Jira/API change description."}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: commandCenter
            ? "repeat(auto-fit, minmax(210px, 1fr))"
            : "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <DashboardSummaryCard
          title="Requirement"
          tourAnchor="requirement-card"
          ready={requirementReady}
          active={stageIndex === 1}
          stepLabel={
            commandCenter
              ? "STEP 1"
              : stageIndex === 1 && !requirementReady
                ? "Step 1 - Now"
                : "Step 1"
          }
          emphasis={
            commandCenter && requirementReady
              ? "Saved and driving design"
              : requirementEmphasis
          }
          description={
            commandCenter
              ? requirementReady
                ? "Saved requirement artifact"
                : "Requirement not saved yet"
              : requirementReady
                ? "A refined requirement is present and can drive downstream workflow actions."
                : "The feature scope still needs refinement before downstream workflow steps."
          }
          tiles={[...requirementTiles]}
          helpText={commandCenter ? undefined : (
            requirementReady
              ? "This is the saved requirement artifact used as the basis for test design."
              : "Start here when the feature scope, rules, or risks still need to be clarified."
          )}
          meta={commandCenter ? undefined : (
            requirementReady
              ? "Requirement artifact present"
              : "No refined requirement saved yet"
          )}
          actionSlot={
            commandCenter ? (
              <ArtifactOpenButton
                label="Open full view"
                kind="requirement"
                resolvedTheme={resolvedTheme}
              />
            ) : null
          }
          resolvedTheme={resolvedTheme}
          commandCenter={commandCenter}
        />

        <DashboardSummaryCard
          title="Test Suite"
          tourAnchor="test-suite-card"
          ready={suiteReady}
          active={stageIndex === 2}
          stepLabel={
            commandCenter
              ? "STEP 2"
              : stageIndex === 2 && !suiteReady
                ? "Step 2 - Now"
                : "Step 2"
          }
          emphasis={
            commandCenter && suiteReady
              ? `Generated from v${requirementVersion ?? 1}`
              : suiteEmphasis
          }
          description={
            commandCenter
              ? suiteReady
                ? "Persisted test suite artifact"
                : "No suite artifact yet"
              : suiteReady
                ? "A generated test suite is available for this workspace."
                : "No persisted suite exists yet for this feature."
          }
          tiles={[...suiteTiles]}
          helpText={commandCenter ? undefined : (
            suiteReady
              ? "This is the latest saved suite artifact for the current requirement."
              : "Generate the suite after the requirement is clear and saved."
          )}
          meta={commandCenter ? undefined : (
            suiteReady
              ? `${suiteCount} case${suiteCount === 1 ? "" : "s"} in the current persisted suite`
              : "Generate the suite from the refined requirement"
          )}
          actionSlot={
            commandCenter ? (
              <ArtifactOpenButton
                label={`Open test suite${suiteCount ? ` (${suiteCount})` : ""}`}
                kind="suite"
                resolvedTheme={resolvedTheme}
              />
            ) : suiteReady ? (
              <TestSuiteExportMenu
                sessionId={exportSessionId}
                disabled={!suiteReady}
              />
            ) : null
          }
          resolvedTheme={resolvedTheme}
          commandCenter={commandCenter}
        />

        <DashboardSummaryCard
          title="Review"
          tourAnchor="review-card"
          ready={reviewReady}
          active={stageIndex === 3}
          stepLabel={
            commandCenter
              ? "STEP 3"
              : stageIndex === 3 && !reviewReady
                ? "Step 3 - Now"
                : "Step 3"
          }
          emphasis={
            commandCenter && reviewReady ? "Suite quality result" : reviewEmphasis
          }
          description={
            commandCenter
              ? reviewReady
                ? "Review Score is suite quality, not readiness"
                : "No review artifact yet"
              : reviewReady
                ? "A persisted review result is available for the current suite."
                : "Coverage review has not yet been completed for this suite."
          }
          tiles={[...reviewTiles]}
          helpText={commandCenter ? undefined : (
            reviewReady
              ? "This reflects the latest saved review outcome for the current suite."
              : "Run review after a suite exists to evaluate coverage, gaps, and improvement areas."
          )}
          meta={commandCenter ? undefined : (
            reviewReady
              ? `Review score: ${
                  typeof reviewScore === "number"
                    ? `${reviewScore}/100`
                    : "available"
                }`
              : "Run Test Review against the current suite"
          )}
          actionSlot={
            commandCenter ? (
              <ArtifactOpenButton
                label={reviewActionLabel}
                kind="review"
                resolvedTheme={resolvedTheme}
                disabled={
                  !reviewReady &&
                  (!suiteReady || !chat.canReviewTestSuite || chat.isRunningWorkflowAction)
                }
                onClickAction={
                  reviewReady
                    ? undefined
                    : suiteReady
                      ? () => {
                          void (async () => {
                            const creditsMayHaveChanged =
                              await chat.reviewTestSuite();
                            if (creditsMayHaveChanged) {
                              onCreditsMayHaveChanged?.();
                            }
                          })();
                        }
                      : undefined
                }
              />
            ) : null
          }
          resolvedTheme={resolvedTheme}
          commandCenter={commandCenter}
        />

        <div data-tour-anchor="execution-evidence-card">
          {commandCenter ? (
            <DashboardSummaryCard
              title="Execution"
              ready={executionEvidenceReady}
              active={stageIndex === 4}
              stepLabel="STEP 4"
              statusLabel={
                executionEvidenceReady ? executionStatus : undefined
              }
              statusTone={
                executionEvidenceReady ? toExecutionTone(executionStatus) : undefined
              }
              emphasis={
                executionEvidenceReady ? "Results uploaded" : "No execution results yet"
              }
              description={
                executionEvidenceReady
                  ? "Execution evidence is persisted separately from review."
                  : "Upload execution results after the suite is ready."
              }
              tiles={[...executionTiles]}
              actionSlot={
                <ArtifactOpenButton
                  label={executionActionLabel}
                  kind="execution"
                  resolvedTheme={resolvedTheme}
                  disabled={!executionEvidenceReady && !suiteReady}
                />
              }
              resolvedTheme={resolvedTheme}
              commandCenter={commandCenter}
            />
          ) : (
            <ExecutionEvidenceSummary
              execution={executionEvidence}
              sessionId={exportSessionId}
              uploadDisabled={!suiteReady}
              resolvedTheme={resolvedTheme}
              commandCenter={commandCenter}
              onExecutionUploadSuccess={chat.applyExecutionEvidenceUpload}
            />
          )}
        </div>
      </div>

      {commandCenter ? null : (
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
          Current stage: <strong style={{ fontWeight: 900 }}>{displayedStage}</strong>
        </div>
        <div>
          Next step: <strong style={{ fontWeight: 900 }}>{nextAction}</strong>
        </div>
      </div>
      )}
    </div>
  );
}
