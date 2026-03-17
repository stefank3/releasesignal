// app/chat/cards/CasesTextCard.tsx
// M12 Step 4 — Editable Test Suite UX
// CHANGE:
// - keep editable local suite UI
// - add explicit persistence callback bridge
// - persist edited cases through session orchestration
// - use keyed inner component so local edit state resets cleanly when new suite text arrives

"use client";

import React, { useMemo, useState } from "react";
import type { TestCase } from "@/lib/chat/artifact";

type ParsedCase = {
  id: string;
  title: string;
  body: string;
};

type Props = {
  text: string;
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;
};

function SmallButton(args: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={args.onClick}
      disabled={args.disabled}
      style={{
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.18)",
        background: args.disabled
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.06)",
        color: args.disabled ? "rgba(255,255,255,0.45)" : "#fff",
        fontWeight: 900,
        cursor: args.disabled ? "not-allowed" : "pointer",
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

    const title = firstLine
      .replace(/^(TC-\d{1,4})\b\s*[:\-–—]?\s*/i, "")
      .trim();

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

function toPersistedCases(cases: ParsedCase[]): TestCase[] {
  return cases.map((c) => ({
    id: c.id,
    title: c.title || "Untitled test case",
    body: c.body,
  }));
}

function CasesTextCardContent({
  parsedCases,
  text,
  hasStructuredCases,
  onUpdateTestSuiteAction,
}: {
  parsedCases: ParsedCase[];
  text: string;
  hasStructuredCases: boolean;
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editedCases, setEditedCases] = useState<ParsedCase[]>(parsedCases);
  const [editingId, setEditingId] = useState<string | null>(null);

  const renderedText = useMemo(() => {
    return rebuildSuiteText(editedCases, text);
  }, [editedCases, text]);

  const isDirty = useMemo(() => {
    if (!hasStructuredCases) return false;
    return renderedText.trim() !== text.trim();
  }, [hasStructuredCases, renderedText, text]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(renderedText);
      setToast("Copied ✓");
      return;
    } catch {
      // continue to fallback
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = renderedText;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";

      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      setToast("Copied ✓");
    } catch {
      setToast("Copy failed");
    }
  };

  const saveSuite = async () => {
    if (!onUpdateTestSuiteAction || !hasStructuredCases || !isDirty) return;

    try {
      setIsSaving(true);
      await onUpdateTestSuiteAction(toPersistedCases(editedCases));
      setToast("Saved ✓");
      setEditingId(null);
    } catch {
      setToast("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCaseField = (
    id: string,
    field: "title" | "body",
    value: string
  ) => {
    setEditedCases((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;

        if (field === "title") {
          const nextTitle = value.trim();
          const nextBodyLines = c.body.split("\n");

          nextBodyLines[0] = `${c.id}: ${
            nextTitle || "Untitled test case"
          }`;

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
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>Generated Test Cases</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {hasStructuredCases ? "Editable workspace" : "Copy-paste output"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SmallButton onClick={copyText}>Copy</SmallButton>

          {hasStructuredCases ? (
            <SmallButton
              onClick={() => {
                void saveSuite();
              }}
              disabled={!isDirty || isSaving || !onUpdateTestSuiteAction}
            >
              {isSaving ? "Saving..." : "Save"}
            </SmallButton>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{toast}</div>
      ) : null}

      {hasStructuredCases ? (
        <div style={{ marginTop: 14 }}>
          {editedCases.map((tc) => {
            const isEditing = editingId === tc.id;

            return (
              <div
                key={tc.id}
                style={{
                  marginBottom: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,0.16)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.65,
                        fontWeight: 900,
                        marginBottom: 4,
                      }}
                    >
                      {tc.id}
                    </div>

                    {isEditing ? (
                      <input
                        value={tc.title}
                        onChange={(e) =>
                          updateCaseField(tc.id, "title", e.target.value)
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
                      <div style={{ fontWeight: 900 }}>{tc.title}</div>
                    )}
                  </div>

                  <SmallButton
                    onClick={() => setEditingId(isEditing ? null : tc.id)}
                  >
                    {isEditing ? "Done" : "Edit"}
                  </SmallButton>
                </div>

                {isEditing ? (
                  <textarea
                    value={tc.body}
                    onChange={(e) =>
                      updateCaseField(tc.id, "body", e.target.value)
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
                    {tc.body}
                  </pre>
                )}
              </div>
            );
          })}

          <div
            style={{
              marginTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>
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

export default function CasesTextCard({
  text,
  onUpdateTestSuiteAction,
}: Props) {
  const parsedCases = useMemo(() => parseCases(text), [text]);
  const hasStructuredCases = parsedCases.length > 0;

  const casesKey = useMemo(() => {
    return `${text.length}:${parsedCases.map((c) => c.id).join("|")}`;
  }, [text, parsedCases]);

  return (
    <CasesTextCardContent
      key={casesKey}
      parsedCases={parsedCases}
      text={text}
      hasStructuredCases={hasStructuredCases}
      onUpdateTestSuiteAction={onUpdateTestSuiteAction}
    />
  );
}