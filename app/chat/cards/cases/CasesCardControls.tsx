// app/chat/cards/cases/CasesCardControls.tsx
// M18.1 extraction:
// Shared presentational controls for CasesTextCard.
// Keep this file UI-only: no suite parsing, persistence, or workflow logic.

"use client";

import React from "react";

type ThemeMode = "light" | "dark";

export function SmallButton(args: {
  children: React.ReactNode;
  onClickAction: () => void | Promise<void>;
  disabled?: boolean;
  resolvedTheme: ThemeMode;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        void args.onClickAction();
      }}
      disabled={args.disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: isDark
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(15,23,42,0.14)",
        background: args.disabled
          ? isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(15,23,42,0.03)"
          : isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(15,23,42,0.05)",
        color: args.disabled
          ? isDark
            ? "rgba(255,255,255,0.45)"
            : "rgba(15,23,42,0.45)"
          : isDark
            ? "#fff"
            : "#0f172a",
        fontWeight: 900,
        cursor: args.disabled ? "not-allowed" : "pointer",
      }}
    >
      {args.children}
    </button>
  );
}

export function SelectControl(args: {
  value: string;
  onChangeAction: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  resolvedTheme: ThemeMode;
  disabled?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        position: "relative",
        minWidth: 150,
      }}
    >
      <select
        value={args.value}
        disabled={args.disabled}
        onChange={(e) => args.onChangeAction(e.target.value)}
        style={{
          width: "100%",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          padding: "8px 34px 8px 10px",
          borderRadius: 10,
          border: isDark
            ? "1px solid rgba(255,255,255,0.14)"
            : "1px solid rgba(15,23,42,0.14)",
          background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
          color: isDark ? "#ffffff" : "#0f172a",
          fontSize: 12,
          fontWeight: 700,
          outline: "none",
          cursor: args.disabled ? "not-allowed" : "pointer",
        }}
      >
        {args.options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            style={{
              color: "#0f172a",
              background: "#ffffff",
            }}
          >
            {option.label}
          </option>
        ))}
      </select>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          fontSize: 10,
          color: isDark ? "rgba(255,255,255,0.78)" : "rgba(15,23,42,0.72)",
        }}
      >
        ▼
      </div>
    </div>
  );
}

export function TextInput(args: {
  value: string;
  onChangeAction: (value: string) => void;
  placeholder?: string;
  resolvedTheme: ThemeMode;
  disabled?: boolean;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <input
      value={args.value}
      disabled={args.disabled}
      onChange={(e) => args.onChangeAction(e.target.value)}
      placeholder={args.placeholder}
      style={{
        width: "100%",
        minWidth: 180,
        padding: "8px 10px",
        borderRadius: 10,
        border: isDark
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(15,23,42,0.14)",
        background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
        color: isDark ? "#fff" : "#0f172a",
        fontSize: 12,
        fontWeight: 700,
        outline: "none",
      }}
    />
  );
}

export function SectionLabel(args: {
  title: string;
  description?: string;
  resolvedTheme: ThemeMode;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gap: 2,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.2,
          color: isDark ? "#ffffff" : "#0f172a",
          opacity: 0.92,
        }}
      >
        {args.title}
      </div>

      {args.description ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: isDark
              ? "rgba(255,255,255,0.68)"
              : "rgba(15,23,42,0.62)",
          }}
        >
          {args.description}
        </div>
      ) : null}
    </div>
  );
}

export function ToneBadge(args: {
  label: string;
  resolvedTheme: ThemeMode;
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        padding: "3px 7px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.14)"
          : "1px solid rgba(15,23,42,0.12)",
        background: isDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(15,23,42,0.04)",
        color: isDark ? "rgba(255,255,255,0.86)" : "rgba(15,23,42,0.82)",
      }}
    >
      {args.label}
    </div>
  );
}