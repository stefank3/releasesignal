// app/chat/components/ExecutionEvidenceSummary.tsx
// M16 Execution Evidence Layer:
// Read-only workspace card for the latest persisted execution evidence.
//
// Architecture rule:
// ExecutionIntelligenceArtifact -> UI display only.
//
// No execution parsing.
// No case matching.
// No summary calculation.
// No release-readiness calculation.
// No review-score mutation.

"use client";

import React from "react";
import type {
  ExecutionIntelligenceArtifact,
  SessionArtifact,
} from "../chat.types";
import { UploadTestResultsButton } from "./execution/UploadTestResultsButton";

type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

type Props = {
  execution: ExecutionIntelligenceArtifact | null | undefined;
  sessionId?: string | null;
  resolvedTheme?: "light" | "dark";
  uploadDisabled?: boolean;
  onExecutionUploadSuccess?: (args: {
    executionIntelligence: ExecutionIntelligenceArtifact;
    artifact?: SessionArtifact | null;
    artifactUpdatedAt?: string | null;
  }) => void;
};

function toDisplayLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getStatusTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "unknown") return "neutral";
  if (normalized === "passed") return "positive";
  if (normalized === "failed") return "negative";
  if (normalized === "blocked") return "negative";
  if (normalized === "partial") return "warning";

  return "info";
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
          : "rgba(220,38,38,0.10)",
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

function EvidenceTile(args: {
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
            ? "1px solid rgba(96,165,250,0.28)"
            : "1px solid rgba(37,99,235,0.22)"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        background: args.ready
          ? isDark
            ? "rgba(96,165,250,0.14)"
            : "rgba(37,99,235,0.08)"
          : isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.04)",
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      {args.ready ? "Available" : "Pending"}
    </span>
  );
}

export function ExecutionEvidenceSummary({
  execution,
  sessionId = null,
  resolvedTheme = "dark",
  uploadDisabled = false,
  onExecutionUploadSuccess,
}: Props) {
  const isDark = resolvedTheme === "dark";
  const ready = !!execution;

  const statusTone = getStatusTone(execution?.suiteStatus);
  const summary = execution?.summary;

  const runLabel =
    execution?.runLabel?.trim() ||
    execution?.runId?.trim() ||
    "No execution run saved yet";

  const linkedSuite =
    typeof execution?.suiteVersion === "number"
      ? `v${execution.suiteVersion}`
      : "Unknown";

  return (
    <div
      style={{
        border: getAccentBorder(ready ? statusTone : "neutral", isDark),
        borderRadius: 14,
        padding: 12,
        background: getAccentBackground(ready ? statusTone : "neutral", isDark),
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
          Execution Evidence
        </div>

        <StatusChip ready={ready} resolvedTheme={resolvedTheme} />
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.4,
          color: isDark ? "#ffffff" : "#0f172a",
        }}
      >
        {ready
          ? `Latest run: ${runLabel}`
          : "No execution evidence imported yet"}
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.82 }}>
        {ready
          ? "This card shows what happened when the persisted suite was executed. It is separate from design review and release readiness."
          : "Upload Release Signal execution CSV results to show pass/fail evidence for the current suite."}
      </div>

      {onExecutionUploadSuccess ? (
        <UploadTestResultsButton
          sessionId={sessionId}
          disabled={uploadDisabled}
          resolvedTheme={resolvedTheme}
          onUploadSuccess={onExecutionUploadSuccess}
        />
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <EvidenceTile
          label="Status"
          value={ready ? toDisplayLabel(execution?.suiteStatus) : "Not Started"}
          tone={ready ? statusTone : "warning"}
          resolvedTheme={resolvedTheme}
        />
        <EvidenceTile
          label="Linked suite"
          value={ready ? linkedSuite : "—"}
          tone={ready ? "info" : "neutral"}
          resolvedTheme={resolvedTheme}
        />
        <EvidenceTile
          label="Source"
          value={ready ? toDisplayLabel(execution?.source) : "—"}
          tone={ready ? "info" : "neutral"}
          resolvedTheme={resolvedTheme}
        />
        <EvidenceTile
          label="Total results"
          value={ready && summary ? String(summary.total) : "0"}
          tone={ready ? "info" : "neutral"}
          resolvedTheme={resolvedTheme}
        />
      </div>

      {ready && summary ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          <EvidenceTile
            label="Passed"
            value={String(summary.passed)}
            tone="positive"
            resolvedTheme={resolvedTheme}
          />
          <EvidenceTile
            label="Failed"
            value={String(summary.failed)}
            tone={summary.failed > 0 ? "negative" : "neutral"}
            resolvedTheme={resolvedTheme}
          />
          <EvidenceTile
            label="Timed out"
            value={String(summary.timedOut)}
            tone={summary.timedOut > 0 ? "negative" : "neutral"}
            resolvedTheme={resolvedTheme}
          />
          <EvidenceTile
            label="Skipped"
            value={String(summary.skipped)}
            tone={summary.skipped > 0 ? "warning" : "neutral"}
            resolvedTheme={resolvedTheme}
          />
          <EvidenceTile
            label="Blocked"
            value={String(summary.blocked)}
            tone={summary.blocked > 0 ? "negative" : "neutral"}
            resolvedTheme={resolvedTheme}
          />
          <EvidenceTile
            label="Unknown"
            value={String(summary.unknown)}
            tone={summary.unknown > 0 ? "warning" : "neutral"}
            resolvedTheme={resolvedTheme}
          />
        </div>
      ) : null}

      <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.74 }}>
        {ready
          ? "Execution evidence is persisted as a structured artifact and does not change the review score."
          : "Release Signal execution CSV uploads use the native template. Tool-specific report imports remain future adapter work."}
      </div>

      {ready ? (
        <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
          {[
            execution?.observedAt ? `Observed: ${execution.observedAt}` : null,
            execution?.runId ? `Run ID: ${execution.runId}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
