// app/chat/components/ChatHeader.tsx
// M7: Extract header row from page.tsx (title + sidebar collapse + UserBar)
//
// CHANGE (M7.6 Branding):
// - product naming updated to Release Signal
// - subtitle clarified to better reflect the product's purpose
//
// CHANGE (M8.1 Workflow Selector):
// - replaces plain mode terminology in the visible UI
// - keeps internal modes unchanged: coach / cases / review
// - introduces workflow-style selection: Strategy / Test Design / Test Review
// - adds a short hint under the selector for clarity during beta
//
// CHANGE (M8.2 Workflow Progress Indicator):
// - adds visible step progression: Strategy -> Test Design -> Test Review
// - highlights the active workflow step
// - reinforces the intended product flow during beta
//
// V1.1 UI CLEANUP:
// - keep the workflow tabs as the primary navigation
// - remove the duplicate stepper so workspace content appears sooner
//
// CHANGE (M10 UI Pass):
// - add theme-aware header rendering
// - remove dark-only toolbar/header styling
// - improve light-mode contrast and readability

"use client";

import React from "react";
import UserBar from "../UserBar";

type Mode = "coach" | "cases" | "review";

type Props = {
  sidebarCollapsed: boolean;
  onToggleSidebarAction: () => void;
  creditRefreshKey?: number;

  // M8.1:
  // Current internal mode from session/page state.
  mode: Mode;

  // M8.1:
  // Callback used to switch modes from the header selector.
  onModeChangeAction: (mode: Mode) => void;

  // M10 UI:
  // Resolved by page shell and passed down so chrome stays consistent.
  resolvedTheme?: "light" | "dark";
};

const MODE_META: Record<
  Mode,
  {
    label: string;
    hint: string;
  }
> = {
  coach: {
    label: "Strategy",
    hint: "Refine requirements and risks first",
  },
  cases: {
    label: "Test Design",
    hint: "Generate structured test suites",
  },
  review: {
    label: "Test Review",
    hint: "Review coverage gaps and risks",
  },
};

const WORKFLOW_ORDER: Mode[] = ["coach", "cases", "review"];

export default function ChatHeader({
  sidebarCollapsed,
  onToggleSidebarAction,
  creditRefreshKey = 0,
  mode,
  onModeChangeAction,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  const textColor = isDark ? "#ffffff" : "#0f172a";
  const subtleText = isDark ? "rgba(255,255,255,0.75)" : "rgba(15,23,42,0.72)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 10,
      }}
    >
      {/* Top row: sidebar toggle + branding + user controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggleSidebarAction}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand history panel" : "Collapse history panel"}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            border: isDark
              ? "1px solid rgba(255,255,255,0.18)"
              : "1px solid rgba(15,23,42,0.14)",
            background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
            color: textColor,
            fontWeight: 950,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
            boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
          }}
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 900,
              margin: 0,
              lineHeight: 1.15,
              color: textColor,
            }}
          >
            Release Signal
          </h1>
          <div
            style={{
              fontSize: 12,
              color: subtleText,
              marginTop: 4,
            }}
          >
            AI-assisted QA workspace for requirements, test design, and readiness signals
          </div>
        </div>

        <div style={{ flex: "0 0 auto" }}>
          <UserBar creditRefreshKey={creditRefreshKey} />
        </div>
      </div>

      {/* M8.1: Workflow selector */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 14,
          border: isDark
            ? "1px solid rgba(255,255,255,0.12)"
            : "1px solid rgba(15,23,42,0.10)",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
          boxShadow: isDark ? "none" : "0 6px 14px rgba(15,23,42,0.04)",
        }}
      >
        {/* Workflow selector */}
        <div
          data-tour-anchor="workflow-navigation"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {WORKFLOW_ORDER.map((item) => {
            const isActive = item === mode;
            const meta = MODE_META[item];

            return (
              <button
                key={item}
                type="button"
                onClick={() => onModeChangeAction(item)}
                aria-pressed={isActive}
                title={meta.hint}
                style={{
                  borderRadius: 999,
                  padding: "8px 14px",
                  border: isActive
                    ? isDark
                      ? "1px solid rgba(255,255,255,0.28)"
                      : "1px solid rgba(15,23,42,0.18)"
                    : isDark
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(15,23,42,0.12)",
                  background: isActive
                    ? isDark
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(15,23,42,0.08)"
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "#ffffff",
                  color: textColor,
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  cursor: "pointer",
                  transition: "all 120ms ease",
                  boxShadow: isDark ? "none" : "0 3px 8px rgba(15,23,42,0.04)",
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
