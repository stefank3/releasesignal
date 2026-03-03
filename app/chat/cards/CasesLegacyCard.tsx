// app/chat/cards/CasesLegacyCard.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted CasesLegacyCard + legacy markdown/json helpers from page.tsx (no behavior change).

"use client";

import React, { useEffect, useState } from "react";
import type { CasesResult } from "../chat.types";

/** Minimal markdown safety for list items (Jira/Confluence paste). */
function mdSafe(s: string) {
  return String(s ?? "").replace(/\r/g, "").trim();
}

function casesLegacyToMarkdown(c: CasesResult) {
  const lines: string[] = [];

  lines.push(`# ${mdSafe(c.suiteTitle)}`);
  lines.push("");

  if (c.assumptions?.length) {
    lines.push("## Assumptions");
    for (const a of c.assumptions.slice(0, 10)) lines.push(`- ${mdSafe(a)}`);
    lines.push("");
  }

  lines.push("## Test Cases");
  lines.push("");

  for (const tc of (c.testCases ?? []).slice(0, 50)) {
    lines.push(`### ${mdSafe(tc.id)} — ${mdSafe(tc.title)}`);
    lines.push(`- Priority: ${tc.priority}`);
    lines.push(`- Type: ${tc.type}`);

    if (tc.tags?.length) lines.push(`- Tags: ${tc.tags.map(mdSafe).join(", ")}`);

    lines.push("");
    lines.push("**Preconditions**");
    if (!tc.preconditions?.length) lines.push("- None");
    else for (const p of tc.preconditions) lines.push(`- ${mdSafe(p)}`);

    lines.push("");
    lines.push("**Steps**");
    if (!tc.steps?.length) lines.push("1. (missing steps)");
    else tc.steps.forEach((s, i) => lines.push(`${i + 1}. ${mdSafe(s)}`));

    lines.push("");
    lines.push("**Expected Results**");
    if (!tc.expectedResults?.length) lines.push("- (missing expected results)");
    else for (const e of tc.expectedResults) lines.push(`- ${mdSafe(e)}`);

    if (tc.testData && Object.keys(tc.testData).length) {
      lines.push("");
      lines.push("**Test Data**");
      lines.push("```json");
      lines.push(JSON.stringify(tc.testData, null, 2));
      lines.push("```");
    }

    lines.push("");
  }

  if (c.optionalClarifications?.length) {
    lines.push("## Optional clarifications");
    for (const q of c.optionalClarifications.slice(0, 3)) lines.push(`- ${mdSafe(q)}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function casesLegacyToJson(c: CasesResult) {
  return JSON.stringify(c, null, 2);
}

/** Small button used inside cards (Copy MD / Copy JSON). */
function SmallButton({
  children,
  onClick,
  variant = "light",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: isDark ? "1px solid #111" : "1px solid #ddd",
        background: isDark ? "#111" : "#fff",
        color: isDark ? "#fff" : "#111",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function CasesLegacyCard({ cases }: { cases: CasesResult }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied ✓`);
    } catch {
      setToast("Copy failed (clipboard blocked)");
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 18,
        padding: 20,
        background: "#fff",
        boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
        color: "#111",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 950 }}>{cases.suiteTitle}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{cases.testCases?.length ?? 0} test case(s)</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <SmallButton onClick={() => copyText(casesLegacyToMarkdown(cases), "Markdown")}>Copy MD</SmallButton>
          <SmallButton onClick={() => copyText(casesLegacyToJson(cases), "JSON")} variant="dark">
            Copy JSON
          </SmallButton>
        </div>
      </div>

      {toast && (
        <div
          style={{
            marginTop: 12,
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #e6e6e6",
            background: "#fff",
            color: "#111",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {toast}
        </div>
      )}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {(cases.testCases ?? []).slice(0, 30).map((tc) => (
          <div
            key={tc.id}
            style={{
              border: "1px solid #f0f0f0",
              borderRadius: 16,
              padding: 14,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 950, fontSize: 13 }}>
                {tc.id} — {tc.title}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {tc.priority} · {tc.type}
              </div>
            </div>

            {tc.tags?.length ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>Tags: {tc.tags.join(", ")}</div>
            ) : null}

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#333" }}>Preconditions</div>
                {tc.preconditions?.length ? (
                  <ul style={{ margin: "8px 0 0 0", paddingLeft: 18 }}>
                    {tc.preconditions.slice(0, 8).map((p, i) => (
                      <li key={i} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.45 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>None.</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#333" }}>Steps</div>
                {tc.steps?.length ? (
                  <ol style={{ margin: "8px 0 0 18px" }}>
                    {tc.steps.slice(0, 12).map((s, i) => (
                      <li key={i} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.45 }}>
                        {s}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>(missing steps)</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 950, color: "#333" }}>Expected Results</div>
                {tc.expectedResults?.length ? (
                  <ul style={{ margin: "8px 0 0 0", paddingLeft: 18 }}>
                    {tc.expectedResults.slice(0, 10).map((e, i) => (
                      <li key={i} style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.45 }}>
                        {e}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>(missing expected results)</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}