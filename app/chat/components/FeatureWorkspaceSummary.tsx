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
import { getArtifactConsistencyState } from "@/lib/chat/artifact";
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
  testDesign?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";
  const tone =
    args.tone ??
    (args.testDesign && args.active
      ? "info"
      : args.ready
        ? "positive"
        : args.active
          ? "info"
          : "neutral");

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
        border: args.testDesign
          ? tone === "positive"
            ? isDark
              ? "1px solid #3B5745"
              : "1px solid #BFD5BD"
            : tone === "warning"
              ? isDark
                ? "1px solid #57482A"
                : "1px solid #DCC791"
              : tone === "negative"
                ? isDark
                  ? "1px solid #573330"
                  : "1px solid #D9AAA4"
                : tone === "info"
                  ? isDark
                    ? "1px solid #57402F"
                    : "1px solid #E4C4B0"
                  : isDark
                    ? "1px solid #38362D"
                    : "1px solid #DFD9C8"
          : tone === "positive"
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
        background: args.testDesign
          ? tone === "positive"
            ? isDark
              ? "#26332B"
              : "#E2ECE0"
            : tone === "warning"
              ? isDark
                ? "#342C1B"
                : "#F4E8CB"
              : tone === "negative"
                ? isDark
                  ? "#362220"
                  : "#F5E0DC"
                : tone === "info"
                  ? isDark
                    ? "#3A2A22"
                    : "#F5E3D6"
                  : isDark
                    ? "#21201C"
                    : "#EDEAE0"
          : tone === "positive"
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
        color: args.testDesign
          ? tone === "positive"
            ? isDark
              ? "#7CC08A"
              : "#2F7A44"
            : tone === "warning"
              ? isDark
                ? "#E0AE5A"
                : "#96690F"
              : tone === "negative"
                ? isDark
                  ? "#E8776A"
                  : "#B0392E"
                : tone === "info"
                  ? isDark
                    ? "#D97757"
                    : "#C15F3C"
                  : isDark
                    ? "#C9C4B6"
                    : "#45413A"
          : isDark
            ? "#ffffff"
            : "#0f172a",
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
  testDesign?: boolean;
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
        border: args.testDesign
          ? isDark
            ? "1px solid #57402F"
            : "1px solid #E4C4B0"
          : isDark
            ? "1px solid rgba(120,180,255,0.24)"
            : "1px solid rgba(37,99,235,0.20)",
        background: args.testDesign
          ? isDark
            ? "#3A2A22"
            : "#F5E3D6"
          : isDark
            ? "rgba(120,180,255,0.08)"
            : "rgba(37,99,235,0.06)",
        color: args.testDesign
          ? isDark
            ? "#D97757"
            : "#C15F3C"
          : isDark
            ? "#ffffff"
            : "#0f172a",
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
  testDesign?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";
  const toneStyles = args.testDesign
    ? {
        border:
          args.tone === "positive"
            ? isDark
              ? "1px solid #3B5745"
              : "1px solid #BFD5BD"
            : args.tone === "warning"
              ? isDark
                ? "1px solid #57482A"
                : "1px solid #DCC791"
              : args.tone === "negative"
                ? isDark
                  ? "1px solid #573330"
                  : "1px solid #D9AAA4"
                : isDark
                  ? "1px solid #38362D"
                  : "1px solid #DFD9C8",
        background: isDark ? "#21201C" : "#EDEAE0",
      }
    : args.commandCenter
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
          color: args.testDesign
            ? isDark
              ? "#EDEAE3"
              : "#262521"
            : isDark
              ? "#ffffff"
              : "#0f172a",
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
  testDesign?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";
  const accentTone: Tone = args.active ? "info" : args.ready ? "positive" : "neutral";
  const cardBorder = args.testDesign
    ? args.active
      ? isDark
        ? "1px solid #8A5240"
        : "1px solid #D8A18A"
      : isDark
        ? "1px solid #3A382F"
        : "1px solid #D9D3C2"
    : args.commandCenter
      ? getCommandCenterCardBorder(accentTone, isDark)
      : getAccentBorder(accentTone, isDark);
  const cardBackground = args.testDesign
    ? isDark
      ? "#2B2A26"
      : "#FCFBF6"
    : args.commandCenter
      ? getCommandCenterCardBackground(args.active ? "info" : "neutral", isDark)
      : getAccentBackground(accentTone, isDark);

  return (
    <div
      data-tour-anchor={args.tourAnchor}
      style={{
        border: cardBorder,
        borderRadius: args.testDesign ? 13 : args.commandCenter ? 12 : 14,
        padding: 12,
        background: cardBackground,
        display: "grid",
        gap: 10,
        minHeight: args.testDesign ? 0 : args.commandCenter ? 276 : 250,
        height: args.testDesign ? "100%" : undefined,
        alignContent: "start",
        gridTemplateRows: args.commandCenter
          ? "auto auto auto 1fr auto"
          : args.testDesign
            ? "auto auto auto auto 1fr auto"
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
                ? args.testDesign
                  ? isDark
                    ? "#D97757"
                    : "#C15F3C"
                  : isDark
                    ? "rgba(147,197,253,0.95)"
                    : "rgba(37,99,235,0.86)"
                : isDark
                  ? args.testDesign
                    ? "#7D796C"
                    : "rgba(255,255,255,0.58)"
                  : args.testDesign
                    ? "#8B8577"
                    : "rgba(15,23,42,0.55)",
            }}
          >
            {args.stepLabel}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 950,
              color: args.testDesign
                ? isDark
                  ? "#EDEAE3"
                  : "#262521"
                : isDark
                  ? "#ffffff"
                  : "#0f172a",
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
          testDesign={args.testDesign}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.4,
          color: args.testDesign
            ? isDark
              ? "#EDEAE3"
              : "#262521"
            : isDark
              ? "#ffffff"
              : "#0f172a",
        }}
      >
        {args.emphasis}
      </div>

      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          opacity: 0.82,
          display: args.testDesign ? "-webkit-box" : undefined,
          WebkitLineClamp: args.testDesign ? 2 : undefined,
          WebkitBoxOrient: args.testDesign ? "vertical" : undefined,
          overflow: args.testDesign ? "hidden" : undefined,
        }}
      >
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
            testDesign={args.testDesign}
          />
        ))}
      </div>

      {args.helpText ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.45,
            opacity: 0.74,
            display: args.testDesign ? "-webkit-box" : undefined,
            WebkitLineClamp: args.testDesign ? 2 : undefined,
            WebkitBoxOrient: args.testDesign ? "vertical" : undefined,
            overflow: args.testDesign ? "hidden" : undefined,
          }}
        >
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

function TestDesignSuiteSummary(args: {
  chat: UseChatSessionReturn;
  resolvedTheme: "light" | "dark";
}) {
  const suite = args.chat.sessionArtifact?.testSuite;
  if (!suite) return null;

  const isDark = args.resolvedTheme === "dark";
  const review = args.chat.sessionArtifact?.reviewResult;
  const reviewed = args.chat.hasReviewArtifact;
  const suiteBasedOnRequirementVersion = (
    suite as typeof suite & { basedOnRequirementVersion?: number }
  ).basedOnRequirementVersion;
  const reviewValue = reviewed
    ? typeof review?.score === "number"
      ? `Yes · ${review.score}/100`
      : "Yes"
    : "Not reviewed";
  const lineage =
    typeof suiteBasedOnRequirementVersion === "number"
      ? `Generated from Requirement v${suiteBasedOnRequirementVersion}`
      : "Requirement lineage unavailable";
  const tileStyle: React.CSSProperties = {
    borderRadius: 10,
    border: isDark ? "1px solid #38362D" : "1px solid #DFD9C8",
    background: isDark ? "#21201C" : "#EDEAE0",
    padding: "9px 12px",
    display: "grid",
    gap: 4,
  };
  const labelStyle: React.CSSProperties = {
    color: isDark ? "#7D796C" : "#8B8577",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".1em",
    textTransform: "uppercase",
  };

  return (
    <section
      aria-label="Current Test Suite summary"
      style={{
        borderRadius: 12,
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        background: isDark ? "#2B2A26" : "#FCFBF6",
        padding: "14px 16px",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span
            style={{
              color: isDark ? "#EDEAE3" : "#262521",
              fontSize: 13.5,
              fontWeight: 800,
            }}
          >
            Test Suite
          </span>
          <span
            style={{
              borderRadius: 999,
              border: isDark ? "1px solid #3B5745" : "1px solid #BFD5BD",
              background: isDark ? "#26332B" : "#E2ECE0",
              color: isDark ? "#7CC08A" : "#2F7A44",
              padding: "3px 9px",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            Saved · v{suite.version}
          </span>
        </div>
        <span
          style={{
            color: isDark ? "#7D796C" : "#8B8577",
            fontSize: 12,
          }}
        >
          {lineage}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 8,
        }}
      >
        {[
          ["Version", `v${suite.version}`],
          ["Cases", String(suite.cases.length)],
          ["State", "Saved"],
          ["Reviewed", reviewValue],
        ].map(([label, value]) => (
          <div key={label} style={tileStyle}>
            <div style={labelStyle}>{label}</div>
            <div
              style={{
                color:
                  label === "State" || (label === "Reviewed" && reviewed)
                    ? isDark
                      ? "#7CC08A"
                      : "#2F7A44"
                    : isDark
                      ? "#EDEAE3"
                      : "#262521",
                fontSize: 15,
                fontWeight: 800,
                lineHeight: 1.25,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          color: isDark ? "#A39F92" : "#6F6A5C",
          fontSize: 11.5,
          lineHeight: 1.45,
        }}
      >
        <span>AI-assisted — review generated cases before you rely on them.</span>
        <span style={{ color: isDark ? "#7D796C" : "#8B8577", fontSize: 11 }}>
          Persisted suite artifact
        </span>
      </div>
    </section>
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
  const testDesignVisual = chat.mode === "cases" && !commandCenter;
  const testReviewVisual = chat.mode === "review" && !commandCenter;
  const workspaceVisual =
    chat.mode === "coach" || testDesignVisual || testReviewVisual;

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
  const artifactConsistency = getArtifactConsistencyState(chat.sessionArtifact);
  const reviewWithLineage = chat.sessionArtifact?.reviewResult as
    | (NonNullable<typeof chat.sessionArtifact>["reviewResult"] & {
        basedOnRequirementVersion?: number;
        basedOnSuiteVersion?: number;
      })
    | undefined;
  const reviewLineageCurrent =
    typeof reviewWithLineage?.basedOnRequirementVersion === "number" &&
    typeof reviewWithLineage?.basedOnSuiteVersion === "number" &&
    typeof artifactConsistency.requirementVersion === "number" &&
    typeof artifactConsistency.suiteVersion === "number" &&
    reviewWithLineage.basedOnRequirementVersion ===
      artifactConsistency.requirementVersion &&
    reviewWithLineage.basedOnSuiteVersion === artifactConsistency.suiteVersion;
  const reviewVisualStatus = !reviewReady
    ? null
    : artifactConsistency.reviewStale
      ? "Stale"
      : reviewLineageCurrent
        ? "Current"
        : "Lineage unknown";
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
    ? testReviewVisual && reviewVisualStatus !== "Current"
      ? reviewVisualStatus === "Stale"
        ? "Saved review is stale"
        : "Saved review lineage is unknown"
      : reviewStrength
      ? `${testReviewVisual ? "Review strength: " : ""}${reviewStrength}${
          testReviewVisual ? "" : " review result"
        }${
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
      label: workspaceVisual ? "Artifact state" : "State",
      value: requirementReady
        ? "Saved"
        : workspaceVisual
          ? "No saved requirement"
          : "Not started yet",
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
      label: "Review strength",
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
        border: workspaceVisual
          ? isDark
            ? "1px solid #3A382F"
            : "1px solid #D9D3C2"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        borderRadius: workspaceVisual ? 14 : 18,
        padding: 14,
        background: workspaceVisual
          ? isDark
            ? "#262521"
            : "#F6F4ED"
          : isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(15,23,42,0.03)",
        color: workspaceVisual
          ? isDark
            ? "#EDEAE3"
            : "#262521"
          : isDark
            ? "#ffffff"
            : "#0f172a",
        display: "grid",
        gap: 12,
      }}
    >
      {testDesignVisual && suiteReady ? (
        <TestDesignSuiteSummary chat={chat} resolvedTheme={resolvedTheme} />
      ) : null}

      <div
        style={
          workspaceVisual
            ? {
                display: "grid",
                gap: 8,
                borderRadius: 14,
                border: isDark ? "1px solid #55452F" : "1px solid #DFC9AE",
                background: isDark
                  ? "linear-gradient(135deg,#33291F 0%,#262521 72%)"
                  : "linear-gradient(135deg,#F0E2CE 0%,#F6F4ED 72%)",
                padding: "15px 18px",
              }
            : { display: "grid", gap: 8 }
        }
      >
        <StageBadge
          text={`Stage ${stageIndex} of 5 - ${displayedStage}`}
          resolvedTheme={resolvedTheme}
          testDesign={workspaceVisual}
        />

        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: workspaceVisual ? 18 : 13,
              fontWeight: 950,
              lineHeight: 1.25,
            }}
          >
            Feature Workspace
          </div>

          <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.45 }}>
            {workspaceVisual
              ? displayedStage
              : "This workspace tracks saved requirements, test suites, reviews, and execution evidence."}
          </div>

          <div style={{ fontSize: 11, opacity: 0.68, lineHeight: 1.45 }}>
            {hasAnyArtifacts
              ? workspaceVisual
                ? nextAction
                : "The cards below show the latest saved requirement, suite, review, and execution evidence."
              : "No saved workspace artifacts exist yet. Start by refining a requirement or pasting a Jira/API change description."}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: commandCenter
            ? "repeat(auto-fit, minmax(210px, 1fr))"
            : workspaceVisual
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
              : workspaceVisual
                ? stageIndex === 1
                  ? "STEP 1 · NOW"
                  : "STEP 1"
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
          testDesign={workspaceVisual}
        />

        <DashboardSummaryCard
          title="Test Suite"
          tourAnchor="test-suite-card"
          ready={suiteReady}
          active={stageIndex === 2}
          stepLabel={
            commandCenter
              ? "STEP 2"
              : workspaceVisual
                ? stageIndex === 2
                  ? "STEP 2 · NOW"
                  : "STEP 2"
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
            ) : suiteReady && !workspaceVisual ? (
              <TestSuiteExportMenu
                sessionId={exportSessionId}
                disabled={!suiteReady}
              />
            ) : null
          }
          resolvedTheme={resolvedTheme}
          commandCenter={commandCenter}
          testDesign={workspaceVisual}
        />

        <DashboardSummaryCard
          title="Review"
          tourAnchor="review-card"
          ready={testReviewVisual ? reviewLineageCurrent : reviewReady}
          active={stageIndex === 3}
          stepLabel={
            commandCenter
              ? "STEP 3"
              : workspaceVisual
                ? stageIndex === 3
                  ? "STEP 3 · NOW"
                  : "STEP 3"
              : stageIndex === 3 && !reviewReady
                ? "Step 3 - Now"
                : "Step 3"
          }
          emphasis={
            commandCenter && reviewReady ? "Review strength result" : reviewEmphasis
          }
          description={
            commandCenter
              ? reviewReady
                ? "Review Score is suite quality, not readiness"
                : "No review artifact yet"
              : reviewReady
                ? testReviewVisual
                  ? reviewVisualStatus === "Current"
                    ? "This review matches the current requirement and test suite."
                    : reviewVisualStatus === "Stale"
                      ? "This review was created from earlier requirement or test-suite versions."
                      : "This review does not include enough version information to confirm whether it matches the current workspace."
                  : "A saved review result is available for the current suite."
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
          testDesign={workspaceVisual}
          statusLabel={testReviewVisual && reviewVisualStatus ? reviewVisualStatus : undefined}
          statusTone={
            testReviewVisual && reviewVisualStatus
              ? reviewVisualStatus === "Current"
                ? "positive"
                : reviewVisualStatus === "Stale"
                  ? "warning"
                  : "neutral"
              : undefined
          }
        />

        <div
          data-tour-anchor="execution-evidence-card"
          style={workspaceVisual ? { display: "grid" } : undefined}
        >
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
              testDesign={workspaceVisual}
            />
          ) : workspaceVisual ? (
            <DashboardSummaryCard
              title="Execution Evidence"
              ready={executionEvidenceReady}
              active={stageIndex === 4}
              stepLabel={stageIndex === 4 ? "STEP 4 · NOW" : "STEP 4"}
              statusLabel={executionEvidenceReady ? executionStatus : undefined}
              statusTone={
                executionEvidenceReady ? toExecutionTone(executionStatus) : undefined
              }
              emphasis={
                executionEvidenceReady
                  ? "Execution results are available"
                  : "No execution results yet"
              }
              description={
                executionEvidenceReady
                  ? "Persisted execution evidence is linked to the current suite."
                  : "Upload execution results after the test suite is ready."
              }
              tiles={[...executionTiles]}
              helpText={
                executionEvidenceReady
                  ? "Open the execution artifact below for the detailed status breakdown."
                  : "The execution artifact below contains the existing upload action."
              }
              meta={
                executionEvidenceReady
                  ? "Execution artifact present"
                  : suiteReady
                    ? "Ready for execution results"
                    : "Generate the suite before uploading results"
              }
              resolvedTheme={resolvedTheme}
              testDesign
            />
          ) : (
            <div>
              <ExecutionEvidenceSummary
                execution={executionEvidence}
                sessionId={exportSessionId}
                uploadDisabled={!suiteReady}
                resolvedTheme={resolvedTheme}
                commandCenter={commandCenter}
                onExecutionUploadSuccess={chat.applyExecutionEvidenceUpload}
              />
            </div>
          )}
        </div>
      </div>

      {commandCenter || workspaceVisual ? null : (
        <div
        style={{
          display: "grid",
          gap: 4,
          fontSize: 11,
          opacity: 0.78,
          lineHeight: 1.45,
          borderTop: workspaceVisual
            ? isDark
              ? "1px solid #3A382F"
              : "1px solid #D9D3C2"
            : isDark
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
