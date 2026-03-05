// app/chat/GuidedSuggestions.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: moved SuggestedReplies + guided template logic out of page.tsx (no behavior change).

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

function buildGuidedReply(template: string, groups: SuggestionGroup[], selected: Record<string, string[]>): string {
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

export default function GuidedSuggestions({
  suggestions,
  onUseSelectionsAction,
}: {
  suggestions: CoachSuggestions;
  onUseSelectionsAction: (autofillText: string) => void;
}) {
  const groups = Array.isArray(suggestions.groups) ? suggestions.groups.slice(0, 3) : [];
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
      return { ...prev, [g.label]: has ? curr.filter((x) => x !== option) : [...curr, option] };
    });
  };

  const hasAnySelection = groups.some((g) => (selected[g.label] ?? []).length > 0);
  const currentHasSelection = currentGroup && (selected[currentGroup.label] ?? []).length > 0;

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
        border: "1px solid rgba(255,255,255,0.12)", // CHANGE: dark-friendly border
        borderRadius: 16,
        padding: 12,
        background: "rgba(255,255,255,0.06)", // CHANGE: dark-friendly surface
        color: "#fff", // CHANGE: dark-friendly text
        boxShadow: "none", // CHANGE: consistent with chat panel
        maxWidth: "78%",
      }}
    >
      {/* Header / progress */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 950 }}>Guided strategy setup</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.70)" }}>
            {/* CHANGE: remove misleading +1; you only have stepsCount steps */}
            Step {step + 1} of {stepsCount}: answer a few quick questions, then add scope & success criteria in the input
            box.
          </div>
        </div>

        <button
          onClick={handleUseSelections}
          disabled={!hasAnySelection}
          style={{
            padding: "7px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: hasAnySelection ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
            color: hasAnySelection ? "#fff" : "rgba(255,255,255,0.55)",
            fontWeight: 950,
            cursor: hasAnySelection ? "pointer" : "not-allowed",
            whiteSpace: "nowrap",
          }}
          title="Autofill the input with your selections (does not auto-send)"
        >
          Use selections
        </button>
      </div>

      {/* Question + options */}
      <div
        style={{
          marginTop: 4,
          maxHeight: 220,
          overflowY: "auto",
          display: "grid",
          gap: 10,
        }}
      >
        {currentGroup && (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.86)" }}>
              {LABEL_TO_QUESTION[currentGroup.label] ?? currentGroup.label}{" "}
              <span style={{ fontWeight: 800, color: "rgba(255,255,255,0.60)" }}>
                ({currentGroup.type === "single" ? "pick 1" : "pick any"})
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(currentGroup.options ?? []).slice(0, 16).map((opt) => {
                const picked = (selected[currentGroup.label] ?? []).includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggle(currentGroup, opt)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 999,
                      border: picked ? "1px solid rgba(255,255,255,0.55)" : "1px solid rgba(255,255,255,0.18)",
                      background: picked ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
                      color: "#fff",
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

        {/* Step hint for the final “manual” step */}
        {atLastStep && (
          <div
            style={{
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px dashed rgba(255,255,255,0.20)",
              background: "rgba(0,0,0,0.18)",
              fontSize: 11,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            In the input box below, please describe:
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              <li>Scope / constraints (what is in, what is out)</li>
              <li>Success criteria / acceptance criteria</li>
            </ul>
            I’ll weave these together with your selections into a focused test strategy.
          </div>
        )}
      </div>

      {/* Step controls */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {step < stepsCount - 1 && (
            <button
              onClick={() => setStep((s) => Math.min(stepsCount - 1, s + 1))}
              disabled={!currentHasSelection}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: currentHasSelection ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                color: currentHasSelection ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 12,
                fontWeight: 900,
                cursor: currentHasSelection ? "pointer" : "not-allowed",
              }}
            >
              Next →
            </button>
          )}

          {step === stepsCount - 1 && (
            <button
              onClick={handleUseSelections}
              disabled={!hasAnySelection}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: hasAnySelection ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                color: hasAnySelection ? "#fff" : "rgba(255,255,255,0.55)",
                fontSize: 12,
                fontWeight: 900,
                cursor: hasAnySelection ? "pointer" : "not-allowed",
              }}
            >
              Finish & paste
            </button>
          )}
        </div>
      </div>
    </div>
  );
}