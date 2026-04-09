// app/chat/components/ChatWorkflowBanner.tsx
// M12 Step 1:
// Extract workflow progression banner from ChatPanel so the panel stays focused
// on workspace layout and input orchestration.
//
// M12.11 CHANGE:
// - improve first-run clarity without changing workflow behavior
// - add contextual help/onboarding copy driven only by existing workflow status
// - keep banner presentational-only and artifact/workflow-state agnostic
//
// M12.15 FOLLOW-UP CHANGE:
// - add light release-health reinforcement to the workflow banner
// - keep banner presentational-only and compact
// - do not move release-health logic or calculation into the banner

"use client";

import React from "react";
import type { WorkflowStatus } from "../chat.types";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

type Props = {
  status: WorkflowStatus;
  chat?: Pick<
    UseChatSessionReturn,
    "sessionArtifact"
  >;
  resolvedTheme?: "light" | "dark";
};

function getGuidanceFromStatus(status: WorkflowStatus): {
  helpLabel: string;
  helpText: string;
} {
  const title = String(status.title ?? "").toLowerCase();
  const description = String(status.description ?? "").toLowerCase();
  const nextAction = String(status.nextAction ?? "").toLowerCase();
  const combined = `${title} ${description} ${nextAction}`;

  // M12.11 NOTE:
  // Contextual onboarding/help is derived from display status only.
  // No workflow decisions are made here.
  if (
    combined.includes("requirement") ||
    combined.includes("clarif") ||
    combined.includes("strategy")
  ) {
    return {
      helpLabel: "How to start",
      helpText:
        "Begin by shaping the requirement. Once the requirement is clear, generate the test suite from the saved artifact.",
    };
  }

  if (
    combined.includes("test design") ||
    combined.includes("generate tests") ||
    combined.includes("suite")
  ) {
    return {
      helpLabel: "What to do here",
      helpText:
        "Use this step to create or refine the test suite. The workspace stays centered on the latest saved requirement and suite.",
    };
  }

  if (
    combined.includes("review") ||
    combined.includes("score") ||
    combined.includes("coverage")
  ) {
    return {
      helpLabel: "What to expect",
      helpText:
        "Review evaluates the current saved suite against the current saved requirement and highlights gaps, risks, and improvement areas.",
    };
  }

  return {
    helpLabel: "Need a starting point?",
    helpText:
      "Follow the next suggested action below. The workspace will keep showing the latest saved artifacts for this session.",
  };
}

function toReleaseHealthLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function toHealthTone(
  value: string | null | undefined
): "neutral" | "positive" | "warning" | "negative" | "info" {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "unknown") return "neutral";
  if (normalized.includes("ready")) return "positive";
  if (normalized.includes("healthy")) return "positive";
  if (normalized.includes("passed")) return "positive";
  if (normalized.includes("not started")) return "warning";
  if (normalized.includes("not ready")) return "warning";
  if (normalized.includes("needs")) return "warning";
  if (normalized.includes("degraded")) return "negative";
  if (normalized.includes("failed")) return "negative";
  if (normalized.includes("suite ready")) return "info";
  if (normalized.includes("low")) return "info";

  return "info";
}

function getToneStyles(
  tone: "neutral" | "positive" | "warning" | "negative" | "info",
  isDark: boolean
): { border: string; background: string } {
  switch (tone) {
    case "positive":
      return {
        border: isDark
          ? "1px solid rgba(34,197,94,0.24)"
          : "1px solid rgba(22,163,74,0.18)",
        background: isDark
          ? "rgba(34,197,94,0.12)"
          : "rgba(22,163,74,0.08)",
      };
    case "warning":
      return {
        border: isDark
          ? "1px solid rgba(245,158,11,0.24)"
          : "1px solid rgba(217,119,6,0.18)",
        background: isDark
          ? "rgba(245,158,11,0.12)"
          : "rgba(245,158,11,0.08)",
      };
    case "negative":
      return {
        border: isDark
          ? "1px solid rgba(239,68,68,0.24)"
          : "1px solid rgba(220,38,38,0.18)",
        background: isDark
          ? "rgba(239,68,68,0.12)"
          : "rgba(239,68,68,0.08)",
      };
    case "info":
      return {
        border: isDark
          ? "1px solid rgba(96,165,250,0.24)"
          : "1px solid rgba(37,99,235,0.18)",
        background: isDark
          ? "rgba(96,165,250,0.12)"
          : "rgba(37,99,235,0.07)",
      };
    default:
      return {
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(15,23,42,0.04)",
      };
  }
}

function HealthInlineChip(args: {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "warning" | "negative" | "info";
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const toneStyles = getToneStyles(args.tone, isDark);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: 999,
        border: toneStyles.border,
        background: toneStyles.background,
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight: 900,
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      <span style={{ opacity: 0.72 }}>{args.label}</span>
      <span>{args.value}</span>
    </div>
  );
}

export default function ChatWorkflowBanner({
  status,
  chat,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";
  const guidance = getGuidanceFromStatus(status);

  const releaseHealth = chat?.sessionArtifact?.releaseHealth ?? null;
  const releaseHealthOverall = releaseHealth
    ? toReleaseHealthLabel(releaseHealth.overallStatus)
    : null;
  const releaseHealthExecution = releaseHealth
    ? toReleaseHealthLabel(releaseHealth.executionStatus)
    : null;

  const showHealthStrip = !!releaseHealth;
  const overallTone = toHealthTone(releaseHealthOverall);
  const executionTone = toHealthTone(releaseHealthExecution);

  return (
    <div
      style={{
        marginBottom: 10,
        padding: "12px 14px",
        borderRadius: 14,
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
        color: isDark ? "#ffffff" : "#0f172a",
        display: "grid",
        gap: 8,
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
        <div style={{ fontSize: 12, fontWeight: 950 }}>{status.title}</div>

        {/* M12.11 NOTE:
            Small onboarding/help marker only.
            Visual guidance, no state or action ownership. */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            padding: "4px 8px",
            borderRadius: 999,
            border: isDark
              ? "1px solid rgba(255,255,255,0.12)"
              : "1px solid rgba(15,23,42,0.12)",
            background: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(255,255,255,0.7)",
            opacity: 0.9,
          }}
        >
          Guided workflow
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
        {status.description}
      </div>

      <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
        Next: <strong style={{ fontWeight: 900 }}>{status.nextAction}</strong>
      </div>

      {showHealthStrip ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 2,
          }}
        >
          <HealthInlineChip
            label="Release health"
            value={releaseHealthOverall ?? "Unknown"}
            tone={overallTone}
            resolvedTheme={resolvedTheme}
          />
          <HealthInlineChip
            label="Execution"
            value={releaseHealthExecution ?? "Unknown"}
            tone={executionTone}
            resolvedTheme={resolvedTheme}
          />
        </div>
      ) : null}

      {/* M12.11 NOTE:
          First-run/contextual help surface.
          Content stays presentational and follows the already-resolved status. */}
      <div
        style={{
          marginTop: 2,
          padding: "8px 10px",
          borderRadius: 10,
          border: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(15,23,42,0.08)",
          background: isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.72)",
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.82 }}>
          {guidance.helpLabel}
        </div>

        <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
          {guidance.helpText}
        </div>
      </div>
    </div>
  );
}