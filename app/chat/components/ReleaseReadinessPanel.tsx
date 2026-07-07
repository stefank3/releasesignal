// app/chat/components/ReleaseReadinessPanel.tsx
// M17 Release Readiness:
// Collapsed/expandable report surface for deterministic release readiness.
// This keeps the compact FeatureWorkspaceSummary clean while still exposing
// the readiness report in the chat workspace.

"use client";

import React from "react";
import type { SessionArtifact } from "@/lib/chat/artifact";
import { buildReleaseReadinessSummary } from "@/lib/release-readiness/releaseReadinessService";
import type { ReleaseReadinessStatus } from "@/lib/release-readiness/releaseReadinessTypes";
import { ReleaseReadinessSummary } from "./ReleaseReadinessSummary";
import { ExecutionResultsBreakdown } from "./readiness/ExecutionResultsBreakdown";
import { ArtifactProvenanceLabel } from "./workspace/ArtifactProvenanceLabel";

type Props = {
  sessionArtifact: SessionArtifact | null | undefined;
  resolvedTheme?: "light" | "dark";
  commandCenter?: boolean;
};

export const STATUS_LABELS: Record<ReleaseReadinessStatus, string> = {
  insufficient_data: "Not enough data yet",
  not_ready: "Not Ready",
  weak: "Weak Readiness",
  partial: "Partial Readiness",
  ready_with_risk: "Ready With Risk",
  ready: "Ready",
  blocked: "Blocked",
};

function getReadinessBand(status: ReleaseReadinessStatus): string {
  switch (status) {
    case "ready":
    case "ready_with_risk":
      return "Strong";
    case "partial":
    case "weak":
      return "Moderate";
    case "not_ready":
    case "blocked":
    case "insufficient_data":
    default:
      return "Low";
  }
}

function getStatusTone(status: ReleaseReadinessStatus): {
  border: string;
  background: string;
} {
  switch (status) {
    case "ready":
      return {
        border: "1px solid rgba(34,197,94,0.28)",
        background: "rgba(34,197,94,0.08)",
      };
    case "ready_with_risk":
    case "partial":
    case "weak":
      return {
        border: "1px solid rgba(245,158,11,0.28)",
        background: "rgba(245,158,11,0.08)",
      };
    case "not_ready":
    case "blocked":
      return {
        border: "1px solid rgba(239,68,68,0.28)",
        background: "rgba(239,68,68,0.08)",
      };
    case "insufficient_data":
    default:
      return {
        border: "1px solid rgba(148,163,184,0.22)",
        background: "rgba(148,163,184,0.06)",
      };
  }
}

function ChecklistItem({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden="true">{complete ? "✓" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}

function CompactChecklistItem({
  label,
  complete,
  warning,
  resolvedTheme,
}: {
  label: string;
  complete: boolean;
  warning?: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        border: warning
          ? "1px solid rgba(245,158,11,0.28)"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 10,
        padding: "8px 10px",
        background: warning
          ? "rgba(245,158,11,0.08)"
          : isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(15,23,42,0.025)",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      <span aria-hidden="true">{complete ? "✓" : warning ? "!" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}

export function ReleaseReadinessPanel({
  sessionArtifact,
  resolvedTheme = "dark",
  commandCenter = false,
}: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDark = resolvedTheme === "dark";

  const readiness = React.useMemo(
    () => buildReleaseReadinessSummary(sessionArtifact ?? null),
    [sessionArtifact]
  );

  const tone = getStatusTone(readiness.status);
  const readinessBand = getReadinessBand(readiness.status);
  const isMissingExecution =
    readiness.status === "insufficient_data" &&
    !readiness.factors.executionEvidencePresent;

  return (
    <section
      data-tour-anchor="release-readiness-panel"
      style={{
        marginBottom: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        background: commandCenter
          ? isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.78)"
          : isDark
            ? "rgba(255,255,255,0.035)"
            : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          padding: 16,
          display: "grid",
          gap: 12,
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 950 }}>
              {commandCenter ? "Release Readiness" : "Release Readiness Report"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.45 }}>
              Decision-support signal derived from requirement, suite, review,
              and execution evidence. Your QA/release owner remains responsible
              for final approval.
            </div>
            <ArtifactProvenanceLabel
              label="Calculated from your saved artifacts using fixed rules - the same inputs always give the same result"
              resolvedTheme={resolvedTheme}
            />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <span
              style={{
                border: tone.border,
                background: tone.background,
                borderRadius: 999,
                padding: "5px 9px",
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {STATUS_LABELS[readiness.status]}
            </span>

            <span
              style={{
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.10)",
                background: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(15,23,42,0.04)",
                borderRadius: 999,
                padding: "5px 9px",
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              Confidence: {readiness.confidence}
            </span>

            <span
              aria-hidden="true"
              style={{
                fontSize: 16,
                opacity: 0.7,
                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 120ms ease",
              }}
            >
              ▾
            </span>
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}>
          {isMissingExecution
            ? "Add execution results to generate your readiness signal."
            : readiness.status === "insufficient_data"
              ? "Add a test suite, a coverage review, and execution results to generate your readiness signal."
            : readiness.summary}
        </div>

        {isMissingExecution ? (
          <div
            style={{
              display: "grid",
              gap: 6,
              border: isDark
                ? "1px solid rgba(255,255,255,0.10)"
                : "1px solid rgba(15,23,42,0.10)",
              borderRadius: 12,
              padding: "10px 12px",
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)",
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            <ChecklistItem
              label="Requirement"
              complete={readiness.factors.requirementPresent}
            />
            <ChecklistItem
              label="Test Suite"
              complete={readiness.factors.suitePresent}
            />
            <ChecklistItem
              label="Review"
              complete={readiness.factors.reviewPresent}
            />
            <ChecklistItem
              label="Execution Evidence missing"
              complete={false}
            />
          </div>
        ) : commandCenter ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <div
              style={{
                border: tone.border,
                borderRadius: 12,
                padding: "10px 12px",
                background: tone.background,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
                Status / Band
              </div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 950 }}>
                {STATUS_LABELS[readiness.status]}
              </div>
              <div style={{ marginTop: 2, fontSize: 11, opacity: 0.72 }}>
                {readinessBand}
              </div>
            </div>

            <div
              style={{
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.10)",
                borderRadius: 12,
                padding: "10px 12px",
                background: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(15,23,42,0.025)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
                Confidence
              </div>
              <div style={{ marginTop: 4, fontSize: 18, fontWeight: 950 }}>
                {readiness.confidence}
              </div>
            </div>

            <div
              style={{
                border: isDark
                  ? "1px solid rgba(96,165,250,0.22)"
                  : "1px solid rgba(37,99,235,0.18)",
                borderRadius: 12,
                padding: "10px 12px",
                background: isDark
                  ? "rgba(96,165,250,0.08)"
                  : "rgba(37,99,235,0.05)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
                Guardrail
              </div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>
                Release Signal supports your release decision; it does not
                approve releases. The QA/release owner has the final call.
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            }}
          >
            <div
              style={{
                border: tone.border,
                borderRadius: 12,
                padding: "10px 12px",
                background: tone.background,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
                Readiness
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950 }}>
                {STATUS_LABELS[readiness.status]}
              </div>
            </div>

            <div
              style={{
                border: tone.border,
                borderRadius: 12,
                padding: "10px 12px",
                background: tone.background,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
                Band
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950 }}>
                {readinessBand}
              </div>
            </div>

            <div
              style={{
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.10)",
                borderRadius: 12,
                padding: "10px 12px",
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
                Confidence
              </div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 950 }}>
                {readiness.confidence}
              </div>
            </div>
          </div>
        )}

        {commandCenter ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <CompactChecklistItem
              label="Requirement"
              complete={readiness.factors.requirementPresent}
              resolvedTheme={resolvedTheme}
            />
            <CompactChecklistItem
              label="Test suite"
              complete={readiness.factors.suitePresent}
              resolvedTheme={resolvedTheme}
            />
            <CompactChecklistItem
              label="Review"
              complete={readiness.factors.reviewPresent}
              resolvedTheme={resolvedTheme}
            />
            <CompactChecklistItem
              label="Execution state"
              complete={readiness.factors.executionEvidencePresent}
              warning={
                readiness.factors.executionEvidencePresent &&
                readiness.status !== "ready"
              }
              resolvedTheme={resolvedTheme}
            />
          </div>
        ) : null}

        <div
          style={{
            fontSize: 11,
            opacity: commandCenter ? 0.78 : 0.68,
            lineHeight: 1.45,
          }}
        >
          {commandCenter
            ? "AI-assisted - review before you rely on it. Final release approval stays with your QA/release owner."
            : "A decision-support signal calculated from your saved artifacts using fixed rules - final release approval stays with your QA/release owner."}
        </div>

        {commandCenter ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              borderTop: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(15,23,42,0.08)",
              paddingTop: 10,
              fontSize: 12,
              fontWeight: 900,
              color: isDark ? "rgba(147,197,253,0.95)" : "rgba(37,99,235,0.90)",
            }}
          >
            <span>
              {isOpen ? "Hide readiness detail" : "View readiness detail"}
            </span>
            <span style={{ opacity: 0.62, fontWeight: 700 }}>
              inputs - reasons - warnings - recommended actions
            </span>
          </div>
        ) : null}
      </button>

      {isOpen ? (
        <div
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
            padding: 12,
          }}
        >
          {commandCenter ? null : (
            <ExecutionResultsBreakdown
              factors={readiness.factors}
              commandCenter={commandCenter}
            />
          )}
          <ReleaseReadinessSummary
            readiness={readiness}
            commandCenter={commandCenter}
          />
        </div>
      ) : null}
    </section>
  );
}
