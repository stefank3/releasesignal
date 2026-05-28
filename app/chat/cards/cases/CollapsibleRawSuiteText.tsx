"use client";

import { useState } from "react";
import { SectionLabel, SmallButton } from "./CasesCardControls";

type Props = {
  text: string;
  resolvedTheme?: "light" | "dark";
};

export function CollapsibleRawSuiteText({
  text,
  resolvedTheme = "dark",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        marginTop: 14,
        borderTop: isDark
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(15,23,42,0.08)",
        paddingTop: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <SectionLabel
          title="Raw suite text"
          description="Optional copy-ready rendering of the current suite after local edits."
          resolvedTheme={resolvedTheme}
        />

        <SmallButton
          onClickAction={() => setIsOpen((current) => !current)}
          resolvedTheme={resolvedTheme}
        >
          {isOpen ? "Hide raw suite text" : "Show raw suite text"}
        </SmallButton>
      </div>

      {isOpen ? (
        <pre
          style={{
            margin: "8px 0 0",
            whiteSpace: "pre-wrap",
            fontSize: 12,
            lineHeight: 1.5,
            background: isDark
              ? "rgba(0,0,0,0.22)"
              : "rgba(15,23,42,0.04)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid rgba(15,23,42,0.10)",
            borderRadius: 14,
            padding: 12,
            color: isDark
              ? "rgba(255,255,255,0.86)"
              : "rgba(15,23,42,0.86)",
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {text}
        </pre>
      ) : null}
    </div>
  );
}
