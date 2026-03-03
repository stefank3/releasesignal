// app/chat/components/ChatUi.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted small UI primitives from page.tsx (no behavior change).

"use client";

import React from "react";
import type { Mode } from "../chat.types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Small pill label used in header sections (dark background friendly). */
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        fontSize: 11,
        fontWeight: 800,
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/**
 * ✅ Milestone 6.1:
 * Mode identity must be visually strong and consistent everywhere (sidebar + header).
 */
export function ModeBadge({ mode, locked, compact }: { mode: Mode; locked?: boolean; compact?: boolean }) {
  const meta =
    mode === "coach"
      ? { label: "COACH", bg: "rgba(56,189,248,0.16)", border: "rgba(56,189,248,0.35)" }
      : mode === "review"
        ? { label: "REVIEW", bg: "rgba(34,197,94,0.16)", border: "rgba(34,197,94,0.35)" }
        : { label: "CASES", bg: "rgba(168,85,247,0.16)", border: "rgba(168,85,247,0.35)" };

  return (
    <span
      title={locked ? "Mode is locked for this session" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "4px 8px" : "6px 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: "#fff",
        fontSize: compact ? 11 : 12,
        fontWeight: 950,
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      {locked ? <span aria-hidden="true">🔒</span> : null}
      {meta.label}
    </span>
  );
}

/** Header button style for Coach/Review/Cases/Clear and demo actions. */
export function HeaderButton({
  active,
  children,
  onClickAction,
  disabled,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClickAction: () => void; // CHANGE: rename to satisfy Next/TS plugin warning 71007
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClickAction}
      disabled={disabled}
      style={{
        padding: "7px 10px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
        color: "#fff",
        fontWeight: 850,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/** Layout helpers (toolbar + grouping) */
export function Toolbar({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 12px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
        {children}
      </div>
      {right ? <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>{right}</div> : null}
    </div>
  );
}

export function Group({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {children}
    </div>
  );
}