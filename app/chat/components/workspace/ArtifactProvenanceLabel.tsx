"use client";

import React from "react";

type Props = {
  label: string;
  resolvedTheme?: "light" | "dark";
};

export function formatArtifactVersion(
  label: "Requirement" | "Test Suite",
  version: number | null | undefined
): string | null {
  if (typeof version !== "number") return null;
  return `${label} v${version}`;
}

export function joinProvenanceParts(
  parts: Array<string | null | undefined>
): string {
  return parts.filter(Boolean).join(" · ");
}

export function ArtifactProvenanceLabel({
  label,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      aria-label={`Artifact provenance: ${label}`}
      style={{
        display: "inline-flex",
        width: "fit-content",
        maxWidth: "100%",
        alignItems: "center",
        gap: 6,
        border: isDark
          ? "1px solid rgba(148,163,184,0.22)"
          : "1px solid rgba(15,23,42,0.12)",
        borderRadius: 999,
        background: isDark ? "rgba(148,163,184,0.10)" : "rgba(15,23,42,0.04)",
        color: isDark ? "rgba(255,255,255,0.86)" : "rgba(15,23,42,0.78)",
        fontSize: 11,
        fontWeight: 850,
        lineHeight: 1.3,
        padding: "5px 9px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      <span
        aria-hidden="true"
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          background: isDark ? "rgba(125,211,252,0.82)" : "rgba(37,99,235,0.72)",
          flex: "0 0 auto",
        }}
      />
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
    </div>
  );
}
