// app/chat/cards/CasesTextCard.tsx
// M12 Step 5 — Suite Intelligence Layer (UI safety pass)
// CHANGE:
// - reuse shared artifact normalization helpers
// - add duplicate ID / malformed header / empty-case validation
// - block save when suite validation issues exist
// - keep editable local suite UI and persistence bridge intact
//
// M12 UI FIX:
// - add resolvedTheme support
// - remove dark-only styling assumptions
// - keep editable suite readable in light and dark mode
//
// M12.9 CHANGE:
// - add contextual Review Test Suite action surface
// - keep component presentational/local-state only
// - do not move workflow execution into the card
//
// M12.9 Phase 2 CHANGE:
// - add Generate Next Batch action surface
// - keep visibility/enablement parent-driven
// - keep card presentational only
//
// M12.9 Phase 2 CHANGE:
// - add Improve / Regenerate Suite action surface
// - keep it distinct from Next Batch
// - keep parent-driven visibility/enablement
// - do not introduce workflow logic into the card
//
// M12.9 Phase 2 FIX:
// - persist edited suite when user clicks Done on a case edit session
// - keep top Save as fallback, but make edit completion the primary persistence path
// - block Done-close when validation issues exist or save fails
//
// DEBUG TEMP:
// - add explicit logs for Done click and save guard path
// - confirm whether save exits early before calling parent persistence callback
//
// M12.10 CHANGE:
// - separate suite workflow actions from local editing controls
// - make edit/save state easier to scan in long suites
// - clarify copy-ready output vs editable workspace content
// - preserve existing validation and persistence behavior

"use client";

import React, { useMemo, useState } from "react";
import type { TestCase } from "@/lib/chat/artifact";
import {
  ensureTestCaseBodyConsistency,
  findDuplicateTestCases,
  normalizeTestCase,
  normalizeWhitespace,
} from "@/lib/chat/artifact";

type ParsedCase = {
  id: string;
  title: string;
  body: string;
};

type CaseValidation = {
  duplicateIds: string[];
  malformedHeaderIds: string[];
  emptyCaseIds: string[];
};

type Props = {
  text: string;
  resolvedTheme?: "light" | "dark";
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;

  // M12.9 CHANGE:
  // actions are injected from parent/hook layer
  onReviewTestSuiteAction?: () => void;
  canReviewTestSuite?: boolean;
  isReviewingTestSuite?: boolean;

  // M12.9 Phase 2 CHANGE:
  onGenerateNextBatchAction?: () => void;
  canGenerateNextBatch?: boolean;
  isGeneratingNextBatch?: boolean;

  // M12.9 Phase 2 CHANGE:
  onRegenerateSuiteAction?: () => void;
  canRegenerateSuite?: boolean;
  isRegeneratingSuite?: boolean;
};

function SmallButton(args: {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        void args.onClick();
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

function SectionLabel(args: {
  title: string;
  description?: string;
  resolvedTheme: "light" | "dark";
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
    const id =
      idMatch?.[1]?.toUpperCase() ?? `TC-${String(i + 1).padStart(3, "0")}`;

    const title = firstLine
      .replace(/^(TC-\d{1,4})\b\s*[:\-–—]?\s*/i, "")
      .trim();

    const normalizedCase = normalizeTestCase({
      id,
      title: title || "Untitled test case",
      body: blockLines.join("\n").trim(),
    });

    cases.push({
      id: normalizedCase.id,
      title: normalizedCase.title,
      body: normalizedCase.body,
    });
  }

  return cases;
}

function rebuildSuiteText(cases: ParsedCase[], fallbackText: string): string {
  if (!cases.length) return fallbackText;
  return cases.map((c) => c.body.trim()).join("\n\n");
}

function toPersistedCases(cases: ParsedCase[]): TestCase[] {
  return cases.map((c) =>
    normalizeTestCase({
      id: c.id,
      title: c.title || "Untitled test case",
      body: c.body,
    })
  );
}

function validateEditedCases(cases: ParsedCase[]): CaseValidation {
  const idCounts = new Map<string, number>();

  for (const tc of cases) {
    const id = String(tc.id ?? "").trim().toUpperCase();
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const malformedHeaderIds: string[] = [];
  const emptyCaseIds: string[] = [];

  for (const tc of cases) {
    const normalized = normalizeTestCase({
      id: tc.id,
      title: tc.title,
      body: tc.body,
    });

    const lines = normalized.body.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    const expectedHeader = `${normalized.id}: ${normalized.title}`;
    const detailLines = lines
      .slice(1)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);

    if (firstLine !== expectedHeader) {
      malformedHeaderIds.push(normalized.id);
    }

    if (!normalized.title.trim() || detailLines.length === 0) {
      emptyCaseIds.push(normalized.id);
    }
  }

  return {
    duplicateIds,
    malformedHeaderIds,
    emptyCaseIds,
  };
}

function CasesTextCardContent({
  parsedCases,
  text,
  hasStructuredCases,
  resolvedTheme = "dark",
  onUpdateTestSuiteAction,
  onReviewTestSuiteAction,
  canReviewTestSuite = false,
  isReviewingTestSuite = false,
  onGenerateNextBatchAction,
  canGenerateNextBatch = false,
  isGeneratingNextBatch = false,
  onRegenerateSuiteAction,
  canRegenerateSuite = false,
  isRegeneratingSuite = false,
}: {
  parsedCases: ParsedCase[];
  text: string;
  hasStructuredCases: boolean;
  resolvedTheme?: "light" | "dark";
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;

  // M12.9 CHANGE:
  // actions remain external; card only renders triggers
  onReviewTestSuiteAction?: () => void;
  canReviewTestSuite?: boolean;
  isReviewingTestSuite?: boolean;

  // M12.9 Phase 2 CHANGE:
  onGenerateNextBatchAction?: () => void;
  canGenerateNextBatch?: boolean;
  isGeneratingNextBatch?: boolean;

  // M12.9 Phase 2 CHANGE:
  onRegenerateSuiteAction?: () => void;
  canRegenerateSuite?: boolean;
  isRegeneratingSuite?: boolean;
}) {
  const isDark = resolvedTheme === "dark";

  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editedCases, setEditedCases] = useState<ParsedCase[]>(parsedCases);
  const [editingId, setEditingId] = useState<string | null>(null);

  const persistedCases = useMemo(() => {
    return toPersistedCases(editedCases);
  }, [editedCases]);

  const duplicateGroups = useMemo(() => {
    return findDuplicateTestCases(persistedCases);
  }, [persistedCases]);

  const validation = useMemo(() => {
    return validateEditedCases(editedCases);
  }, [editedCases]);

  const invalidCaseIds = useMemo(() => {
    return new Set([
      ...validation.duplicateIds,
      ...validation.malformedHeaderIds,
      ...validation.emptyCaseIds,
      ...duplicateGroups.flatMap((group) => group.ids),
    ]);
  }, [validation, duplicateGroups]);

  const hasValidationIssues =
    duplicateGroups.length > 0 ||
    validation.duplicateIds.length > 0 ||
    validation.malformedHeaderIds.length > 0 ||
    validation.emptyCaseIds.length > 0;

  const renderedText = useMemo(() => {
    return rebuildSuiteText(
      persistedCases.map((c) => ({
        id: c.id,
        title: c.title,
        body: c.body,
      })),
      text
    );
  }, [persistedCases, text]);

  const isDirty = useMemo(() => {
    if (!hasStructuredCases) return false;
    return renderedText.trim() !== text.trim();
  }, [hasStructuredCases, renderedText, text]);

  const showReviewAction =
    typeof onReviewTestSuiteAction === "function" && hasStructuredCases;

  const showGenerateNextBatchAction =
    typeof onGenerateNextBatchAction === "function" && hasStructuredCases;

  const showRegenerateSuiteAction =
    typeof onRegenerateSuiteAction === "function" && hasStructuredCases;

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

  const saveSuite = async (): Promise<boolean> => {
    console.log("saveSuite called", {
      hasUpdateAction: !!onUpdateTestSuiteAction,
      hasStructuredCases,
      isDirty,
      hasValidationIssues,
      persistedCasesCount: persistedCases.length,
      editingId,
    });

    if (!onUpdateTestSuiteAction || !hasStructuredCases || !isDirty) {
      console.log("saveSuite early return", {
        reason: !onUpdateTestSuiteAction
          ? "missing_update_action"
          : !hasStructuredCases
            ? "no_structured_cases"
            : "not_dirty",
      });
      return true;
    }

    if (hasValidationIssues) {
      console.log("saveSuite blocked by validation", {
        duplicateGroups: duplicateGroups.map((group) => group.ids),
        duplicateIds: validation.duplicateIds,
        malformedHeaderIds: validation.malformedHeaderIds,
        emptyCaseIds: validation.emptyCaseIds,
      });
      setToast("Resolve suite issues before saving");
      return false;
    }

    try {
      setIsSaving(true);
      console.log("saveSuite invoking onUpdateTestSuiteAction", {
        persistedCasesCount: persistedCases.length,
        caseIds: persistedCases.map((tc) => tc.id),
      });
      await onUpdateTestSuiteAction(persistedCases);
      console.log("saveSuite onUpdateTestSuiteAction resolved");
      setToast("Saved ✓");
      return true;
    } catch (error) {
      console.log("saveSuite failed", { error });
      setToast("Save failed");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditToggle = async (id: string) => {
    const isCurrentlyEditing = editingId === id;

    console.log("Done/Edit clicked", {
      id,
      isCurrentlyEditing,
      isDirty,
      hasValidationIssues,
      editingId,
    });

    if (!isCurrentlyEditing) {
      setEditingId(id);
      return;
    }

    // M12.9 Phase 2 FIX:
    // Clicking Done should persist the edited suite immediately so users do not
    // need to scroll back to the top Save action on long suites.
    const didSave = await saveSuite();
    console.log("handleEditToggle save result", {
      id,
      didSave,
    });

    if (didSave) {
      setEditingId(null);
    }
  };

  const updateCaseField = (
    id: string,
    field: "title" | "body",
    value: string
  ) => {
    console.log("updateCaseField", {
      id,
      field,
      valueLength: value.length,
    });

    setEditedCases((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;

        if (field === "title") {
          const nextTitle = normalizeWhitespace(value) || "Untitled test case";

          return {
            ...c,
            title: nextTitle,
            body: ensureTestCaseBodyConsistency({
              id: c.id,
              title: nextTitle,
              body: c.body,
            }),
          };
        }

        const nextBody = ensureTestCaseBodyConsistency({
          id: c.id,
          title: c.title || "Untitled test case",
          body: value,
        });

        return {
          ...c,
          body: nextBody,
        };
      })
    );
  };

  const editingSummary = editingId
    ? `Editing ${editingId}${isDirty ? " • unsaved changes" : ""}`
    : isDirty
      ? "Unsaved suite changes"
      : "Suite is in sync";

  return (
    <div
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(15,23,42,0.12)",
        borderRadius: 18,
        padding: 20,
        background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff",
        color: isDark ? "#fff" : "#0f172a",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
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

          {hasStructuredCases ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                padding: "4px 8px",
                borderRadius: 999,
                border: isDark
                  ? "1px solid rgba(255,255,255,0.14)"
                  : "1px solid rgba(15,23,42,0.12)",
                background: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(15,23,42,0.04)",
                color: isDark
                  ? "rgba(255,255,255,0.82)"
                  : "rgba(15,23,42,0.82)",
              }}
            >
              {editingSummary}
            </div>
          ) : null}
        </div>

        <div>
          <SectionLabel
            title="Workflow actions"
            description="Run artifact-driven suite actions from the current persisted workspace."
            resolvedTheme={resolvedTheme}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {showRegenerateSuiteAction ? (
              <SmallButton
                onClick={() => {
                  onRegenerateSuiteAction?.();
                }}
                disabled={!canRegenerateSuite || isRegeneratingSuite || isSaving}
                resolvedTheme={resolvedTheme}
              >
                {isRegeneratingSuite ? "Regenerating..." : "Improve / Regenerate"}
              </SmallButton>
            ) : null}

            {showGenerateNextBatchAction ? (
              <SmallButton
                onClick={() => {
                  onGenerateNextBatchAction?.();
                }}
                disabled={!canGenerateNextBatch || isGeneratingNextBatch || isSaving}
                resolvedTheme={resolvedTheme}
              >
                {isGeneratingNextBatch ? "Generating..." : "Generate Next Batch"}
              </SmallButton>
            ) : null}

            {showReviewAction ? (
              <SmallButton
                onClick={() => {
                  onReviewTestSuiteAction?.();
                }}
                disabled={!canReviewTestSuite || isReviewingTestSuite || isSaving}
                resolvedTheme={resolvedTheme}
              >
                {isReviewingTestSuite ? "Reviewing..." : "Review Test Suite"}
              </SmallButton>
            ) : null}
          </div>
        </div>

        <div>
          <SectionLabel
            title="Local editing"
            description="Copy or save edits made in this suite card."
            resolvedTheme={resolvedTheme}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SmallButton
              onClick={copyText}
              disabled={isSaving}
              resolvedTheme={resolvedTheme}
            >
              Copy
            </SmallButton>

            {hasStructuredCases ? (
              <SmallButton
                onClick={async () => {
                  await saveSuite();
                }}
                disabled={
                  !isDirty ||
                  isSaving ||
                  !onUpdateTestSuiteAction ||
                  hasValidationIssues
                }
                resolvedTheme={resolvedTheme}
              >
                {isSaving ? "Saving..." : "Save"}
              </SmallButton>
            ) : null}
          </div>
        </div>
      </div>

      {toast ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>{toast}</div>
      ) : null}

      {hasStructuredCases ? (
        <div style={{ marginTop: 14 }}>
          {hasValidationIssues ? (
            <div
              style={{
                marginBottom: 14,
                border: isDark
                  ? "1px solid rgba(255,200,0,0.28)"
                  : "1px solid rgba(202,138,4,0.28)",
                borderRadius: 12,
                padding: 12,
                background: isDark
                  ? "rgba(255,200,0,0.08)"
                  : "rgba(234,179,8,0.10)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
                Suite issues must be resolved before save
              </div>

              {duplicateGroups.length ? (
                <div style={{ fontSize: 12, opacity: 0.88, marginBottom: 4 }}>
                  Duplicate cases:{" "}
                  {duplicateGroups.map((group) => group.ids.join(", ")).join(" • ")}
                </div>
              ) : null}

              {validation.duplicateIds.length ? (
                <div style={{ fontSize: 12, opacity: 0.88, marginBottom: 4 }}>
                  Duplicate IDs: {validation.duplicateIds.join(", ")}
                </div>
              ) : null}

              {validation.emptyCaseIds.length ? (
                <div style={{ fontSize: 12, opacity: 0.88, marginBottom: 4 }}>
                  Empty cases: {validation.emptyCaseIds.join(", ")}
                </div>
              ) : null}

              {validation.malformedHeaderIds.length ? (
                <div style={{ fontSize: 12, opacity: 0.88 }}>
                  Header/body mismatch: {validation.malformedHeaderIds.join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}

          <SectionLabel
            title="Editable cases"
            description="Update case titles and bodies here. Done saves the edited suite."
            resolvedTheme={resolvedTheme}
          />

          {editedCases.map((tc) => {
            const isEditing = editingId === tc.id;
            const isInvalid = invalidCaseIds.has(tc.id);

            return (
              <div
                key={tc.id}
                style={{
                  marginBottom: 12,
                  border: isInvalid
                    ? isDark
                      ? "1px solid rgba(255,200,0,0.28)"
                      : "1px solid rgba(202,138,4,0.28)"
                    : isDark
                      ? "1px solid rgba(255,255,255,0.10)"
                      : "1px solid rgba(15,23,42,0.10)",
                  borderRadius: 14,
                  padding: 12,
                  background: isInvalid
                    ? isDark
                      ? "rgba(255,200,0,0.06)"
                      : "rgba(234,179,8,0.08)"
                    : isDark
                      ? "rgba(0,0,0,0.16)"
                      : "rgba(15,23,42,0.03)",
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
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.65,
                          fontWeight: 900,
                        }}
                      >
                        {tc.id}
                      </div>

                      {isInvalid ? (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: "2px 6px",
                            borderRadius: 999,
                            border: isDark
                              ? "1px solid rgba(255,200,0,0.32)"
                              : "1px solid rgba(202,138,4,0.28)",
                            background: isDark
                              ? "rgba(255,200,0,0.12)"
                              : "rgba(234,179,8,0.12)",
                            color: isDark
                              ? "rgba(255,240,180,0.95)"
                              : "#854d0e",
                          }}
                        >
                          CHECK
                        </div>
                      ) : null}

                      {isEditing ? (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: "2px 6px",
                            borderRadius: 999,
                            border: isDark
                              ? "1px solid rgba(120,180,255,0.24)"
                              : "1px solid rgba(37,99,235,0.22)",
                            background: isDark
                              ? "rgba(120,180,255,0.10)"
                              : "rgba(37,99,235,0.08)",
                            color: isDark ? "#ffffff" : "#0f172a",
                          }}
                        >
                          EDITING
                        </div>
                      ) : null}
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
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.14)"
                            : "1px solid rgba(15,23,42,0.14)",
                          background: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "#ffffff",
                          color: isDark ? "#fff" : "#0f172a",
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
                    onClick={() => handleEditToggle(tc.id)}
                    disabled={isSaving}
                    resolvedTheme={resolvedTheme}
                  >
                    {isEditing ? (isSaving ? "Saving..." : "Done") : "Edit"}
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
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid rgba(15,23,42,0.12)",
                      background: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#ffffff",
                      color: isDark
                        ? "rgba(255,255,255,0.94)"
                        : "rgba(15,23,42,0.94)",
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
                      background: isDark
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(15,23,42,0.03)",
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 12,
                      padding: 12,
                      color: isDark
                        ? "rgba(255,255,255,0.92)"
                        : "rgba(15,23,42,0.92)",
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
              borderTop: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(15,23,42,0.08)",
              paddingTop: 12,
            }}
          >
            <SectionLabel
              title="Copy-ready suite output"
              description="This is the current rendered suite text after local edits."
              resolvedTheme={resolvedTheme}
            />

            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.5,
                background: isDark
                  ? "rgba(0,0,0,0.22)"
                  : "rgba(15,23,42,0.04)",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.10)",
                borderRadius: 14,
                padding: 12,
                color: isDark
                  ? "rgba(255,255,255,0.86)"
                  : "rgba(15,23,42,0.86)",
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              {renderedText}
            </pre>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <SectionLabel
            title="Rendered output"
            description="This response is not in editable structured suite format."
            resolvedTheme={resolvedTheme}
          />

          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.55,
              background: isDark ? "rgba(0,0,0,0.22)" : "rgba(15,23,42,0.04)",
              border: isDark
                ? "1px solid rgba(255,255,255,0.10)"
                : "1px solid rgba(15,23,42,0.10)",
              borderRadius: 16,
              padding: 14,
              color: isDark
                ? "rgba(255,255,255,0.92)"
                : "rgba(15,23,42,0.92)",
              margin: 0,
            }}
          >
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function CasesTextCard({
  text,
  resolvedTheme = "dark",
  onUpdateTestSuiteAction,
  onReviewTestSuiteAction,
  canReviewTestSuite = false,
  isReviewingTestSuite = false,
  onGenerateNextBatchAction,
  canGenerateNextBatch = false,
  isGeneratingNextBatch = false,
  onRegenerateSuiteAction,
  canRegenerateSuite = false,
  isRegeneratingSuite = false,
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
      resolvedTheme={resolvedTheme}
      onUpdateTestSuiteAction={onUpdateTestSuiteAction}
      onReviewTestSuiteAction={onReviewTestSuiteAction}
      canReviewTestSuite={canReviewTestSuite}
      isReviewingTestSuite={isReviewingTestSuite}
      onGenerateNextBatchAction={onGenerateNextBatchAction}
      canGenerateNextBatch={canGenerateNextBatch}
      isGeneratingNextBatch={isGeneratingNextBatch}
      onRegenerateSuiteAction={onRegenerateSuiteAction}
      canRegenerateSuite={canRegenerateSuite}
      isRegeneratingSuite={isRegeneratingSuite}
    />
  );
}