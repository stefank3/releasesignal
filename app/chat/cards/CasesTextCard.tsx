// app/chat/cards/CasesTextCard.tsx
// M7 Phase 2 (Structural Refactor)
// CHANGE: extracted CasesTextCard from page.tsx (no behavior change).
//
// CHANGE (M12 Step 4 - Editable Test Suite UX, first pass):
// - parse generated plain-text suite into visible case blocks
// - allow local editing per test case
// - allow copy of edited suite output
// - preserve raw fallback rendering when parsing is weak
// - keep persistence/backend unchanged for now

"use client";

import React, { useEffect, useMemo, useState } from "react";

type ParsedCase = {
  id: string;
  title: string;
  body: string;
};

function SmallButton(args: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={args.onClick}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        color: "#fff",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {args.children}
    </button>
  );
}

function parseCases(text: string): ParsedCase[] {
  const normalized = String(text ?? "").replace(/\r/g, "");
  const lines = normalized.split("\n");

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*TC-\d{1,4}\b/i.test(lines[i])) {
      starts.push(i);
    }
  }

  if (!starts.length) return [];

  const cases: ParsedCase[] = [];

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : lines.length;

    const blockLines = lines.slice(start, end);
    const firstLine = blockLines[0].trim();

    const idMatch = firstLine.match(/^(TC-\d{1,4})\b/i);
    const id = idMatch?.[1] ?? `TC-${String(i + 1).padStart(3, "0")}`;

    const title = firstLine.replace(/^(TC-\d{1,4})\b\s*[:\-–—]?\s*/i, "").trim();

    cases.push({
      id,
      title: title || "Untitled test case",
      body: blockLines.join("\n").trim(),
    });
  }

  return cases;
}

function rebuildSuiteText(cases: ParsedCase[], fallbackText: string): string {
  if (!cases.length) return fallbackText;
  return cases.map((c) => c.body.trim()).join("\n\n");
}

export default function CasesTextCard({ text }: { text: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const [editedCases, setEditedCases] = useState<ParsedCase[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const parsedCases = useMemo(() => parseCases(text), [text]);
  const hasStructuredCases = parsedCases.length > 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setEditedCases(parsedCases);
    setEditingId(null);
  }, [parsedCases]);

  const renderedText = useMemo(() => {
    return rebuildSuiteText(editedCases, text);
  }, [editedCases, text]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(renderedText);
      setToast("Copied ✓");
      return;
    } catch {
      // continue to fallback below
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = renderedText;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.setAttribute("readonly", "true");

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);

      setToast(ok ? "Copied ✓" : "Copy failed (clipboard blocked)");
    } catch {
      setToast("Copy failed (clipboard blocked)");
    }
  };

  const updateCaseField = (id: string, field: "title" | "body", value: string) => {
    setEditedCases((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;

        if (field === "title") {
          const nextTitle = value.trim();
          const nextBodyLines = c.body.split("\n");
          nextBodyLines[0] = `${c.id}: ${nextTitle || "Untitled test case"}`;

          return {
            ...c,
            title: nextTitle,
            body: nextBodyLines.join("\n"),
          };
        }

        return {
          ...c,
          body: value,
        };
      })
    );
  };

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 18,
        padding: 20,
        background: "rgba(255,255,255,0.05)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.22)",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 950 }}>Generated Test Cases</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
            {hasStructuredCases
              ? "Editable workspace view for generated test cases"
              : "Copy-paste into Jira/Xray"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SmallButton onClick={copyText}>Copy</SmallButton>
        </div>
      </div>

      {toast ? (
        <div
          style={{
            marginTop: 12,
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {toast}
        </div>
      ) : null}

      {hasStructuredCases ? (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.72)",
              lineHeight: 1.5,
            }}
          >
            Local editing is enabled for this generated suite. You can adjust wording
            and then copy the updated output.
          </div>

          {editedCases.map((testCase) => {
            const isEditing = editingId === testCase.id;

            return (
              <div
                key={testCase.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 16,
                  padding: 14,
                  background: "rgba(0,0,0,0.18)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", fontWeight: 900 }}>
                      {testCase.id}
                    </div>

                    {isEditing ? (
                      <input
                        value={testCase.title}
                        onChange={(e) =>
                          updateCaseField(testCase.id, "title", e.target.value)
                        }
                        style={{
                          width: "100%",
                          minWidth: 260,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.06)",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 900,
                          outline: "none",
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 950, color: "#fff" }}>
                        {testCase.title}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {isEditing ? (
                      <SmallButton onClick={() => setEditingId(null)}>Done</SmallButton>
                    ) : (
                      <SmallButton onClick={() => setEditingId(testCase.id)}>Edit</SmallButton>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    value={testCase.body}
                    onChange={(e) =>
                      updateCaseField(testCase.id, "body", e.target.value)
                    }
                    style={{
                      width: "100%",
                      minHeight: 220,
                      resize: "vertical",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.94)",
                      padding: 12,
                      fontSize: 13,
                      lineHeight: 1.55,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      lineHeight: 1.55,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: 12,
                      color: "rgba(255,255,255,0.92)",
                    }}
                  >
                    {testCase.body}
                  </pre>
                )}
              </div>
            );
          })}

          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900 }}>
              Copy-ready suite output
            </div>

            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.5,
                background: "rgba(0,0,0,0.22)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 12,
                color: "rgba(255,255,255,0.86)",
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              {renderedText}
            </pre>
          </div>
        </div>
      ) : (
        <pre
          style={{
            marginTop: 14,
            whiteSpace: "pre-wrap",
            fontSize: 13,
            lineHeight: 1.55,
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 16,
            padding: 14,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {text}
        </pre>
      )}
    </div>
  );
}