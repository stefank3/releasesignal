// app/chat/components/ChatUI.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted small UI primitives from page.tsx (no behavior change).
//
// NOTE: File name standardized to ChatUI.tsx (capital UI) to avoid case-sensitivity issues on Vercel/Linux.
//
// CHANGE (M8.3 Workflow Terminology Alignment):
// - visible mode labels updated from COACH / REVIEW / CASES
// - new UI labels are STRATEGY / TEST REVIEW / TEST DESIGN
// - internal Mode values remain unchanged
//
// CHANGE (M10 UI Pass):
// - add theme-aware shared UI primitives
// - remove dark-only styling assumptions from toolbar buttons/chips/groups
// - keep behavior unchanged while supporting light / dark themes

"use client";

import React from "react";
import type { Mode } from "../chat.types";

type ResolvedTheme = "light" | "dark";

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Small pill label used in header sections. */
export function Chip({
  children,
  resolvedTheme = "dark",
}: {
  children: React.ReactNode;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(15,23,42,0.14)",
        fontSize: 11,
        fontWeight: 800,
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
        color: isDark ? "#fff" : "#0f172a",
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
 *
 * M8.3:
 * Visible UI terminology now follows the workflow language:
 * coach  -> STRATEGY
 * review -> TEST REVIEW
 * cases  -> TEST DESIGN
 */
export function ModeBadge({
  mode,
  locked,
  compact,
  resolvedTheme = "dark",
}: {
  mode: Mode;
  locked?: boolean;
  compact?: boolean;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  const meta =
    mode === "coach"
      ? {
          label: "STRATEGY",
          bg: isDark ? "rgba(56,189,248,0.16)" : "rgba(14,116,144,0.10)",
          border: isDark ? "rgba(56,189,248,0.35)" : "rgba(14,116,144,0.26)",
          color: isDark ? "#ffffff" : "#075985",
        }
      : mode === "review"
        ? {
            label: "TEST REVIEW",
            bg: isDark ? "rgba(34,197,94,0.16)" : "rgba(21,128,61,0.10)",
            border: isDark ? "rgba(34,197,94,0.35)" : "rgba(21,128,61,0.26)",
            color: isDark ? "#ffffff" : "#14532d",
          }
        : {
            label: "TEST DESIGN",
            bg: isDark ? "rgba(168,85,247,0.16)" : "rgba(126,34,206,0.10)",
            border: isDark ? "rgba(168,85,247,0.35)" : "rgba(126,34,206,0.26)",
            color: isDark ? "#ffffff" : "#581c87",
          };

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
        color: meta.color,
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
/** Header button style for toolbar actions and workflow-related controls. */
export function HeaderButton({
  active,
  children,
  onClickAction,
  disabled,
  resolvedTheme = "dark",
}: {
  active?: boolean;
  children: React.ReactNode;
  onClickAction: () => void;
  disabled?: boolean;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={onClickAction}
      disabled={disabled}
      style={{
        padding: "7px 10px",
        borderRadius: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(15,23,42,0.14)",
        background: active
          ? isDark
            ? "rgba(255,255,255,0.16)"
            : "rgba(15,23,42,0.08)"
          : isDark
            ? "rgba(255,255,255,0.06)"
            : "#ffffff",
        color: isDark ? "#fff" : "#0f172a",
        fontWeight: 850,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        outline: "none",
        whiteSpace: "nowrap",
        boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
      }}
    >
      {children}
    </button>
  );
}

/** Layout helpers (toolbar + grouping) */
export function Toolbar({
  children,
  right,
  resolvedTheme = "dark",
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 12px",
        borderRadius: 16,
        border: isDark
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.03)",
        boxShadow: isDark ? "none" : "0 6px 14px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          minWidth: 0,
          flex: 1,
        }}
      >
        {children}
      </div>
      {right ? (
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {right}
        </div>
      ) : null}
    </div>
  );
}

export function Group({
  children,
  resolvedTheme = "dark",
}: {
  children: React.ReactNode;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 14,
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark ? "rgba(0,0,0,0.18)" : "rgba(15,23,42,0.03)",
      }}
    >
      {children}
    </div>
  );
}