// app/chat/GuidedSuggestions.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: moved SuggestedReplies + guided template logic out of page.tsx (no behavior change).
//
// M12.11 CHANGE:
// - improve first-run readability for guided strategy setup
// - add theme-aware support for light/dark usage
// - clarify that selections only prepare input text and do not send
// - keep this component presentational and selection-driven only

"use client";

import React, { useEffect, useState } from "react";
import type { CoachSuggestions, SuggestionGroup } from "./chat.types";

function normalizeKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function replaceAllSafe(haystack: string, needle: string, value: string) {
  if (!needle) return haystack;
  return haystack.split(needle).join(value);
}

function buildGuidedReply(
  template: string,
  groups: SuggestionGroup[],
  selected: Record<string, string[]>
): string {
  let out = template || "";

  let replacedSomething = false;

  for (const g of groups) {
    const picks = selected[g.label] ?? [];
    const joined = g.type === "multi" ? picks.join(", ") : picks[0] ?? "";

    const key = normalizeKey(g.label);

    const before = out;
    out = replaceAllSafe(out, `{{${g.label}}}`, joined);
    out = replaceAllSafe(out, `{${g.label}}`, joined);
    out = replaceAllSafe(out, `{{${g.label.toLowerCase()}}}`, joined);
    out = replaceAllSafe(out, `{${g.label.toLowerCase()}}`, joined);
    out = replaceAllSafe(out, `{{${key}}}`, joined);
    out = replaceAllSafe(out, `{${key}}`, joined);

    if (out !== before) replacedSomething = true;
  }

  // If template had no placeholders, append a clean selections block (still useful for the user).
  if (!replacedSomething) {
    const lines: string[] = [];
    lines.push(out.trimEnd());
    lines.push("");
    lines.push("Selections:");
    for (const g of groups) {
      const picks = selected[g.label] ?? [];
      if (!picks.length) continue;
      lines.push(`- ${g.label}: ${picks.join(", ")}`);
    }
    return lines.join("\n").trim();
  }

  return out.trim();
}

// Map labels -> “question” prompts for stepper UX
const LABEL_TO_QUESTION: Record<string, string> = {
  Objective: "What is your primary objective for this work?",
  "Primary Risk": "Which risk areas do you want deeper coverage on?",
  Integrations: "Which systems / integrations are in scope?",
};

function ProgressPill(args: {
  step: number;
  stepsCount: number;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.25,
        textTransform: "uppercase",
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
        color: isDark ? "#ffffff" : "#0f172a",
        opacity: 0.84,
      }}
    >
      Step {args.step + 1} of {args.stepsCount}
    </div>
  );
}

function ActionButton(args: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";
  const disabled = !!args.disabled;

  return (
    <button
      type="button"
      onClick={args.onClick}
      disabled={disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: isDark
          ? "1px solid rgba(255,255,255,0.18)"
          : "1px solid rgba(15,23,42,0.14)",
        background: disabled
          ? isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(15,23,42,0.04)"
          : isDark
            ? "rgba(255,255,255,0.14)"
            : "rgba(15,23,42,0.08)",
        color: disabled
          ? isDark
            ? "rgba(255,255,255,0.55)"
            : "rgba(15,23,42,0.45)"
          : isDark
            ? "#ffffff"
            : "#0f172a",
        fontSize: 12,
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {args.children}
    </button>
  );
}

export default function GuidedSuggestions({
  suggestions,
  onUseSelectionsAction,
  resolvedTheme = "dark",
}: {
  suggestions: CoachSuggestions;
  onUseSelectionsAction: (autofillText: string) => void;
  resolvedTheme?: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  const groups = Array.isArray(suggestions.groups)
    ? suggestions.groups.slice(0, 3)
    : [];
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState(0);

  const stepsCount = groups.length;
  const currentGroup = groups[step] ?? null;

  // Defensive init: keep selection shape stable when suggestions change.
  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups) init[g.label] = [];
    setSelected(init);
    setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions.template, JSON.stringify(groups)]);

  const toggle = (g: SuggestionGroup, option: string) => {
    setSelected((prev) => {
      const curr = prev[g.label] ?? [];
      if (g.type === "single") {
        return { ...prev, [g.label]: curr[0] === option ? [] : [option] };
      }
      const has = curr.includes(option);
      return {
        ...prev,
        [g.label]: has ? curr.filter((x) => x !== option) : [...curr, option],
      };
    });
  };

  const hasAnySelection = groups.some((g) => (selected[g.label] ?? []).length > 0);
  const currentHasSelection =
    !!currentGroup && (selected[currentGroup.label] ?? []).length > 0;

  const atLastStep = step >= stepsCount - 1;

  const handleUseSelections = () => {
    const text = buildGuidedReply(suggestions.template, groups, selected);
    onUseSelectionsAction(text);
  };

  if (!stepsCount) return null;

  return (
    <div
      style={{
        marginTop: 10,
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 16,
        padding: 12,
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.03)",
        color: isDark ? "#ffffff" : "#0f172a",
        boxShadow: "none",
        maxWidth: "78%",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 5 }}>
          <ProgressPill
            step={step}
            stepsCount={stepsCount}
            resolvedTheme={resolvedTheme}
          />

          <div style={{ fontSize: 12, fontWeight: 950 }}>
            Guided strategy setup
          </div>

          <div
            style={{
              fontSize: 11,
              color: isDark ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.68)",
              lineHeight: 1.45,
            }}
          >
            Answer a few quick questions to prepare a clearer strategy prompt.
            Your selections only fill the input box and do not send automatically.
          </div>
        </div>

        <ActionButton
          onClick={handleUseSelections}
          disabled={!hasAnySelection}
          resolvedTheme={resolvedTheme}
        >
          Use selections
        </ActionButton>
      </div>

      <div
        style={{
          marginTop: 2,
          padding: "8px 10px",
          borderRadius: 10,
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
        <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.82 }}>
          What happens next
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.72 }}>
          Pick options for each step, then paste them into the input. You can add
          extra scope, constraints, and acceptance criteria before sending.
        </div>
      </div>

      <div
        style={{
          marginTop: 2,
          maxHeight: 220,
          overflowY: "auto",
          display: "grid",
          gap: 10,
        }}
      >
        {currentGroup && (
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: isDark ? "rgba(255,255,255,0.88)" : "rgba(15,23,42,0.86)",
              }}
            >
              {LABEL_TO_QUESTION[currentGroup.label] ?? currentGroup.label}{" "}
              <span
                style={{
                  fontWeight: 800,
                  color: isDark
                    ? "rgba(255,255,255,0.60)"
                    : "rgba(15,23,42,0.58)",
                }}
              >
                ({currentGroup.type === "single" ? "pick 1" : "pick any"})
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(currentGroup.options ?? []).slice(0, 16).map((opt) => {
                const picked = (selected[currentGroup.label] ?? []).includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(currentGroup, opt)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      border: picked
                        ? isDark
                          ? "1px solid rgba(255,255,255,0.55)"
                          : "1px solid rgba(15,23,42,0.32)"
                        : isDark
                          ? "1px solid rgba(255,255,255,0.18)"
                          : "1px solid rgba(15,23,42,0.14)",
                      background: picked
                        ? isDark
                          ? "rgba(255,255,255,0.16)"
                          : "rgba(15,23,42,0.10)"
                        : isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(15,23,42,0.04)",
                      color: isDark ? "#ffffff" : "#0f172a",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {atLastStep ? (
          <div
            style={{
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 10,
              border: isDark
                ? "1px dashed rgba(255,255,255,0.20)"
                : "1px dashed rgba(15,23,42,0.16)",
              background: isDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.72)",
              fontSize: 11,
              color: isDark ? "rgba(255,255,255,0.80)" : "rgba(15,23,42,0.74)",
            }}
          >
            In the input box below, add:
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              <li>Scope / constraints (what is in, what is out)</li>
              <li>Success criteria / acceptance criteria</li>
            </ul>
            The workspace will combine that with your selections into a more
            focused strategy prompt.
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 ? (
            <ActionButton
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              resolvedTheme={resolvedTheme}
            >
              ← Back
            </ActionButton>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {step < stepsCount - 1 ? (
            <ActionButton
              onClick={() => setStep((s) => Math.min(stepsCount - 1, s + 1))}
              disabled={!currentHasSelection}
              resolvedTheme={resolvedTheme}
            >
              Next →
            </ActionButton>
          ) : null}

          {step === stepsCount - 1 ? (
            <ActionButton
              onClick={handleUseSelections}
              disabled={!hasAnySelection}
              resolvedTheme={resolvedTheme}
            >
              Finish & paste
            </ActionButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}