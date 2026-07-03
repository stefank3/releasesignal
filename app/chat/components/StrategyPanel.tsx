// app/chat/components/StrategyPanel.tsx
// Inline guided Strategy fields for the authenticated workspace start surface.
// UI-only: preserves existing local field values, paste behavior, and refine flow.

"use client";

import React, { useMemo, useState } from "react";
import type { UseChatSessionReturn } from "../hooks/useChatSession";

type ResolvedTheme = "light" | "dark";

function SectionTitle({
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
        fontSize: 12,
        fontWeight: 950,
        opacity: 0.9,
        marginBottom: 8,
        letterSpacing: 0.2,
        color: isDark ? "#fff" : "#0f172a",
      }}
    >
      {children}
    </div>
  );
}

function SmallButton({
  children,
  onClick,
  disabled,
  title,
  resolvedTheme = "dark",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "7px 10px",
        borderRadius: 12,
        border: isDark
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(15,23,42,0.14)",
        background: disabled
          ? isDark
            ? "rgba(255,255,255,0.05)"
            : "rgba(15,23,42,0.03)"
          : isDark
            ? "rgba(255,255,255,0.10)"
            : "#ffffff",
        color: disabled
          ? isDark
            ? "rgba(255,255,255,0.55)"
            : "rgba(15,23,42,0.45)"
          : isDark
            ? "#fff"
            : "#0f172a",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.05)",
      }}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  resolvedTheme = "dark",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div style={{ display: "grid", gap: 5 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 950,
          opacity: 0.8,
          color: isDark ? "#fff" : "#0f172a",
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "9px 10px",
          borderRadius: 12,
          border: isDark
            ? "1px solid rgba(255,255,255,0.14)"
            : "1px solid rgba(15,23,42,0.14)",
          background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
          color: isDark ? "#fff" : "#0f172a",
          outline: "none",
          fontSize: 12,
          lineHeight: 1.4,
          boxShadow: isDark ? "none" : "0 4px 10px rgba(15,23,42,0.04)",
        }}
      />
    </div>
  );
}

function Surface({
  children,
  dashed,
  resolvedTheme = "dark",
}: {
  children: React.ReactNode;
  dashed?: boolean;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        border: dashed
          ? isDark
            ? "1px dashed rgba(255,255,255,0.16)"
            : "1px dashed rgba(15,23,42,0.16)"
          : isDark
            ? "1px solid rgba(255,255,255,0.10)"
            : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        padding: 12,
        background: dashed
          ? isDark
            ? "rgba(0,0,0,0.16)"
            : "rgba(15,23,42,0.03)"
          : isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.72)",
      }}
    >
      {children}
    </div>
  );
}

function focusChatInputBestEffort() {
  const el = document.querySelector(
    "input:not([disabled]), textarea:not([disabled])"
  ) as HTMLInputElement | HTMLTextAreaElement | null;

  if (!el) return;

  el.focus();
  try {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    // Best-effort focus only.
  }
}

export default function StrategyPanel({
  chat,
  resolvedTheme = "dark",
  defaultStructuredFormOpen = false,
}: {
  chat: UseChatSessionReturn;
  resolvedTheme?: ResolvedTheme;
  defaultStructuredFormOpen?: boolean;
}) {
  const [objective, setObjective] = useState("");
  const [primaryRisk, setPrimaryRisk] = useState("");
  const [integrations, setIntegrations] = useState("");
  const [constraints, setConstraints] = useState("");
  const [scope, setScope] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [showStructuredForm, setShowStructuredForm] = useState(
    defaultStructuredFormOpen
  );

  const generatedStructuredText = useMemo(() => {
    return [
      `Objective: ${objective.trim()}`,
      `Primary Risk: ${primaryRisk.trim()}`,
      `Integrations: ${integrations.trim()}`,
      `Constraints: ${constraints.trim()}`,
      `Scope: ${scope.trim()}`,
      `Success Criteria: ${successCriteria.trim()}`,
    ].join("\n");
  }, [objective, primaryRisk, integrations, constraints, scope, successCriteria]);

  const isCoachSession = chat.mode === "coach" && chat.activeSessionMode === "coach";
  const isDark = resolvedTheme === "dark";

  const hasAnyInput = Boolean(
    objective.trim() ||
      primaryRisk.trim() ||
      integrations.trim() ||
      constraints.trim() ||
      scope.trim() ||
      successCriteria.trim()
  );

  if (!isCoachSession) return null;

  return (
    <details
      open={showStructuredForm}
      onToggle={(event) => {
        setShowStructuredForm(event.currentTarget.open);
      }}
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 14,
        background: isDark ? "rgba(255,255,255,0.035)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#fff" : "#0f172a",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "12px 14px",
          listStyle: "none",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 950,
              color: isDark ? "#fff" : "#0f172a",
            }}
          >
            Need structure? Use guided fields.
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: isDark
                ? "rgba(255,255,255,0.70)"
                : "rgba(15,23,42,0.64)",
            }}
          >
            Optional — add context before refining your requirement.
          </div>
        </div>
      </summary>

      <div style={{ display: "grid", gap: 12, padding: "0 12px 12px" }}>
        <Surface resolvedTheme={resolvedTheme}>
          <SectionTitle resolvedTheme={resolvedTheme}>
            Guided context
          </SectionTitle>

          <div
            style={{
              fontSize: 12,
              opacity: 0.78,
              lineHeight: 1.45,
              marginBottom: 10,
              color: isDark ? "#fff" : "#0f172a",
            }}
          >
            Capture the same optional Strategy fields here. Paste the structured
            result into the main input when it helps; you can also refine a rough
            requirement without filling these out.
          </div>

          <div style={{ display: "grid", gap: 9 }}>
            <Field
              label="Objective"
              value={objective}
              onChange={setObjective}
              placeholder="What is the main business or QA objective?"
              rows={2}
              resolvedTheme={resolvedTheme}
            />

            <Field
              label="Primary Risk"
              value={primaryRisk}
              onChange={setPrimaryRisk}
              placeholder="What failure or uncertainty matters most?"
              rows={2}
              resolvedTheme={resolvedTheme}
            />

            <Field
              label="Integrations"
              value={integrations}
              onChange={setIntegrations}
              placeholder="Auth0, email service, API gateway, payment provider..."
              rows={2}
              resolvedTheme={resolvedTheme}
            />

            <Field
              label="Constraints"
              value={constraints}
              onChange={setConstraints}
              placeholder="Environment limits, timeline, non-goals, technical restrictions..."
              rows={2}
              resolvedTheme={resolvedTheme}
            />

            <Field
              label="Scope"
              value={scope}
              onChange={setScope}
              placeholder="In: login, MFA challenge / Out: admin portal, audit exports"
              rows={2}
              resolvedTheme={resolvedTheme}
            />

            <Field
              label="Success Criteria"
              value={successCriteria}
              onChange={setSuccessCriteria}
              placeholder="What must be true for this to be considered successful?"
              rows={2}
              resolvedTheme={resolvedTheme}
            />
          </div>

          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}
          >
            <SmallButton
              onClick={() => {
                chat.setInput(generatedStructuredText);
                requestAnimationFrame(() => focusChatInputBestEffort());
              }}
              disabled={!hasAnyInput}
              title="Paste structured requirement content into the main workflow input"
              resolvedTheme={resolvedTheme}
            >
              Paste into input
            </SmallButton>

            <SmallButton
              onClick={() => {
                setObjective("");
                setPrimaryRisk("");
                setIntegrations("");
                setConstraints("");
                setScope("");
                setSuccessCriteria("");
              }}
              disabled={!hasAnyInput}
              title="Clear all refinement fields"
              resolvedTheme={resolvedTheme}
            >
              Clear form
            </SmallButton>
          </div>
        </Surface>

        <Surface dashed resolvedTheme={resolvedTheme}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 950,
              opacity: 0.82,
              marginBottom: 6,
              color: isDark ? "#fff" : "#0f172a",
            }}
          >
            Preview
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.78,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              minHeight: 84,
              color: isDark ? "#fff" : "#0f172a",
            }}
          >
            {generatedStructuredText}
          </div>
        </Surface>
      </div>
    </details>
  );
}
