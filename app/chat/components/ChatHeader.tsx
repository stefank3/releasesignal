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

"use client";

import React from "react";
import UserBar from "../UserBar";

type Mode = "coach" | "cases" | "review";

type Props = {
  sidebarCollapsed: boolean;
  onToggleSidebarAction: () => void;

  // M8.1:
  // Current internal mode from session/page state.
  mode: Mode;

  // M8.1:
  // Callback used to switch modes from the header selector.
  onModeChangeAction: (mode: Mode) => void;
};

const MODE_META: Record<
  Mode,
  {
    label: string;
    hint: string;
    step: number;
  }
> = {
  coach: {
    label: "Strategy",
    hint: "Clarify requirements and risks",
    step: 1,
  },
  cases: {
    label: "Test Design",
    hint: "Generate structured test cases",
    step: 2,
  },
  review: {
    label: "Test Review",
    hint: "Evaluate coverage and gaps",
    step: 3,
  },
};

const WORKFLOW_ORDER: Mode[] = ["coach", "cases", "review"];

export default function ChatHeader({
  sidebarCollapsed,
  onToggleSidebarAction,
  mode,
  onModeChangeAction,
}: Props) {
  const activeModeMeta = MODE_META[mode];
  const activeStep = activeModeMeta.step;

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
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 950,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
            Release Signal
          </h1>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            AI-assisted QA review, strategy refinement, and test design
          </div>
        </div>

        <div style={{ flex: "0 0 auto" }}>
          <UserBar />
        </div>
      </div>

      {/* M8.1 + M8.2: Workflow selector + progress indicator */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {/* Workflow selector */}
        <div
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
                    ? "1px solid rgba(255,255,255,0.28)"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* M8.2: Workflow progress indicator */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          {WORKFLOW_ORDER.map((item, index) => {
            const meta = MODE_META[item];
            const isActive = item === mode;
            const isCompleted = meta.step < activeStep;

            return (
              <React.Fragment key={`step-${item}`}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: isActive
                      ? "1px solid rgba(255,255,255,0.26)"
                      : "1px solid rgba(255,255,255,0.10)",
                    background: isActive
                      ? "rgba(255,255,255,0.12)"
                      : isCompleted
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.03)",
                    opacity: isActive ? 1 : isCompleted ? 0.92 : 0.72,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: isActive ? 900 : 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.18)",
                      fontSize: 11,
                      fontWeight: 900,
                      background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
                    }}
                  >
                    {meta.step}
                  </span>

                  <span>{meta.label}</span>
                </div>

                {index < WORKFLOW_ORDER.length - 1 ? (
                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: 12,
                      opacity: 0.45,
                      fontWeight: 900,
                    }}
                  >
                    →
                  </span>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        {/* Active mode hint for immediate workflow clarity */}
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          <strong style={{ fontWeight: 800 }}>{activeModeMeta.label}:</strong>{" "}
          {activeModeMeta.hint}
        </div>
      </div>
    </div>
  );
}