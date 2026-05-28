"use client";

import React from "react";

type Props = {
  resolvedTheme?: "light" | "dark";
  isNarrow?: boolean;
  children: React.ReactNode;
  inputSlot: React.ReactNode;
};

export const ActivityTimelinePanel = React.forwardRef<HTMLDivElement, Props>(
  function ActivityTimelinePanel(
    {
      resolvedTheme = "dark",
      isNarrow = false,
      children,
      inputSlot,
    },
    ref
  ) {
    const isDark = resolvedTheme === "dark";

    const panelHeight = isNarrow
      ? "clamp(430px, 66vh, 720px)"
      : "clamp(520px, 68vh, 780px)";

    return (
      <section
        aria-label="Activity timeline"
        style={{
          border: isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
          borderRadius: 18,
          background: isDark ? "rgba(255,255,255,0.032)" : "rgba(15,23,42,0.025)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          height: panelHeight,
          boxShadow: isDark
            ? "0 8px 30px rgba(0,0,0,0.14)"
            : "0 8px 24px rgba(15,23,42,0.05)",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
            color: isDark ? "#ffffff" : "#0f172a",
            display: "grid",
            gap: 3,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950 }}>
            Activity Timeline
          </div>
          <div style={{ fontSize: 11, opacity: 0.66, lineHeight: 1.4 }}>
            Supporting conversation and previous workspace activity. Latest
            artifact documents stay in the workspace surface above.
          </div>
        </div>

        <div
          ref={ref}
          style={{
            padding: 14,
            overflow: "auto",
            overscrollBehavior: "contain",
            minHeight: 0,
          }}
        >
          {children}
        </div>

        <div
          style={{
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid rgba(15,23,42,0.10)",
            padding: 12,
            background: isDark ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.55)",
          }}
        >
          {inputSlot}
        </div>
      </section>
    );
  }
);
