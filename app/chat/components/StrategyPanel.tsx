// app/chat/components/StrategyPanel.tsx
// M7 (Locked): StrategyPanel — structured requirement input + pinned refined requirement.
//
// CHANGE (M7.5 UX Polish):
// - tighter spacing and clearer visual hierarchy
// - form block + preview block + pinned requirement block
// - same structured artifact pipeline, no backend contract changes
//
// CHANGE (M8.5 Strategy Panel Alignment):
// - removes heavy outer framing so the panel fits cleanly inside ChatPanel
// - aligns visible naming with Strategy / Refined Requirement terminology
// - improves helper text for beta workflow clarity
// - keeps all existing behavior and artifact usage intact
//
// CHANGE (M8.10 Strategy Screen Cleanup):
// - removes duplicated Refined Requirement block from the right panel
// - keeps the center-column requirement as the single source of truth
// - keeps the panel focused on refinement inputs + preview only
//
// CHANGE (M10 UI Pass):
// - add theme-aware rendering for light / dark mode
// - remove dark-only text / field styling assumptions
//
// CHANGE (M10 Remaining Work - Assistant Tone Alignment):
// - shift helper copy from chatbot-style interaction to workflow-assistant guidance
// - keep the panel focused on requirement refinement as part of the QA workflow
//
// M12.11 CHANGE:
// - improve first-run clarity for the Strategy panel
// - make the paste-and-run flow easier to understand
// - add lightweight onboarding/help copy only
// - keep all workflow behavior unchanged

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

function Pill({
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
        fontSize: 11,
        fontWeight: 900,
        padding: "4px 8px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(15,23,42,0.14)",
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)",
        color: isDark ? "#fff" : "#0f172a",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
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

function HelpBox({
  title,
  text,
  resolvedTheme = "dark",
}: {
  title: string;
  text: string;
  resolvedTheme?: ResolvedTheme;
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 12,
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
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          opacity: 0.82,
          color: isDark ? "#fff" : "#0f172a",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 11,
          lineHeight: 1.45,
          opacity: 0.72,
          color: isDark ? "#fff" : "#0f172a",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function focusChatInputBestEffort() {
  const el = document.querySelector("input:not([disabled]), textarea:not([disabled])") as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;

  if (!el) return;

  el.focus();
  try {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    // ignore
  }
}

export default function StrategyPanel({
  chat,
  resolvedTheme = "dark",
}: {
  chat: UseChatSessionReturn;
  resolvedTheme?: ResolvedTheme;
}) {
  const [objective, setObjective] = useState("");
  const [primaryRisk, setPrimaryRisk] = useState("");
  const [integrations, setIntegrations] = useState("");
  const [constraints, setConstraints] = useState("");
  const [scope, setScope] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");

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
  const hasPinned = !!chat.sessionArtifact?.refinedRequirement;
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
    <div
      style={{
        color: isDark ? "#fff" : "#0f172a",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontWeight: 950, color: isDark ? "#fff" : "#0f172a" }}>
            Strategy
          </div>
          <div
            style={{
              fontSize: 11,
              opacity: 0.7,
              lineHeight: 1.4,
              color: isDark ? "#fff" : "#0f172a",
            }}
          >
            Refine the requirement as the scope evolves. This updates the pinned
            Refined Requirement used for test generation.
          </div>
        </div>
        <Pill resolvedTheme={resolvedTheme}>
          {hasPinned ? "Pinned ✓" : "Not pinned"}
        </Pill>
      </div>

      <HelpBox
        title="How to use this panel"
        text="Fill in the structure below, paste it into the main input, then run Strategy. This panel helps prepare requirement content, but it does not save or run the workflow by itself."
        resolvedTheme={resolvedTheme}
      />

      <Surface resolvedTheme={resolvedTheme}>
        <SectionTitle resolvedTheme={resolvedTheme}>
          Refine requirement
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
          Capture the main objective, risks, scope, and success criteria here.
          Then paste the structured result into the main workflow input.
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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
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

      <HelpBox
        title="What happens after paste"
        text="After pasting into the main input, run the Strategy step there. The resulting refined requirement will appear in the conversation area and can then be reused by Test Design."
        resolvedTheme={resolvedTheme}
      />

      {hasPinned ? (
        <div
          style={{
            fontSize: 11,
            opacity: 0.68,
            lineHeight: 1.4,
            color: isDark ? "#fff" : "#0f172a",
          }}
        >
          The latest Refined Requirement is shown in the main conversation area
          and will be reused by Test Design.
        </div>
      ) : (
        <div
          style={{
            fontSize: 11,
            opacity: 0.68,
            lineHeight: 1.4,
            color: isDark ? "#fff" : "#0f172a",
          }}
        >
          Nothing is pinned yet. Complete the refinement fields, paste the result
          into the main workflow input, and run Strategy to create the Refined
          Requirement.
        </div>
      )}
    </div>
  );
}