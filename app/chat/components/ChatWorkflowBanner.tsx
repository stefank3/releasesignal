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
// V1.1 UI CLEANUP:
// - keep lightweight workflow guidance
// - remove visible release-health chips so Release Readiness remains primary

"use client";

import React from "react";
import type { WorkflowStatus } from "../chat.types";

type Props = {
  status: WorkflowStatus;
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
        "Start by refining a requirement or pasting a Jira/API change description. Review the saved requirement before using it for test design.",
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
        "Use this step to create or refine the test suite from saved artifacts. Review generated tests before using them.",
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
        "Review compares the saved suite with the saved requirement and highlights coverage gaps, risks, and improvement areas.",
    };
  }

  return {
    helpLabel: "Need a starting point?",
    helpText:
      "Follow the next suggested action below. Release Signal keeps the latest saved artifacts visible as the workspace state.",
  };
}

export default function ChatWorkflowBanner({
  status,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";
  const guidance = getGuidanceFromStatus(status);

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
          Next step
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
        {status.description}
      </div>

      <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
        Next: <strong style={{ fontWeight: 900 }}>{status.nextAction}</strong>
      </div>

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
