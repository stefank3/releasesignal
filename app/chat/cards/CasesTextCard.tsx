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
// M12.10 CHANGE:
// - separate suite workflow actions from local editing controls
// - make edit/save state easier to scan in long suites
// - clarify copy-ready output vs editable workspace content
//
// M12.16 CHANGE:
// - add local search/filter/sort controls for persisted suite scanability
// - add invalid-only visibility mode for faster operator review
// - replace weak compact preview with a structured suite overview card
// - keep all controls UI-local; no workflow or persistence logic moved into the card
//
// M18.3 FIX:
// - preserve full TestCase structure through edit/save
// - avoid reducing edited cases to id/title/body before persistence
// - protect type, priority, preconditions, steps, expectedResults, tags, and notes
//
// M18.1 EXTRACTION:
// - move reusable presentational controls into cases/CasesCardControls
// - move pure case overview helpers into cases/caseOverview
// - keep parsing, save behavior, and workflow action behavior unchanged

"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { TestCase } from "@/lib/chat/artifact";
import {
  ensureTestCaseBodyConsistency,
  findDuplicateTestCases,
  normalizeTestCase,
  normalizeWhitespace,
} from "@/lib/chat/artifact";

import {
  SectionLabel,
  SelectControl,
  SmallButton,
  TextInput,
  ToneBadge,
} from "./cases/CasesCardControls";
import { CollapsibleRawSuiteText } from "./cases/CollapsibleRawSuiteText";
import { buildCaseOverview, truncateText } from "./cases/caseOverview";
import { ArtifactProvenanceLabel } from "../components/workspace/ArtifactProvenanceLabel";

// M18.3:
// Keep ParsedCase aligned with TestCase so edit/save does not drop structured fields.
type ParsedCase = TestCase;

type CaseValidation = {
  duplicateIds: string[];
  malformedHeaderIds: string[];
  emptyCaseIds: string[];
};

type SortMode = "id_asc" | "id_desc" | "title_asc" | "title_desc";
type FilterMode = "all" | "invalid" | "editing";
type ViewMode = "expanded" | "overview";

type Props = {
  text: string;
  resolvedTheme?: "light" | "dark";
  defaultViewMode?: ViewMode;
  provenanceLabel?: string;
  provenanceDescription?: string;
  extraWorkflowActions?: ReactNode;
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;

  onReviewTestSuiteAction?: () => void;
  canReviewTestSuite?: boolean;
  isReviewingTestSuite?: boolean;

  onGenerateNextBatchAction?: () => void;
  canGenerateNextBatch?: boolean;
  isGeneratingNextBatch?: boolean;

  onRegenerateSuiteAction?: () => void;
  canRegenerateSuite?: boolean;
  isRegeneratingSuite?: boolean;
};

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

    // M18.3:
    // Preserve the full normalized TestCase, not only id/title/body.
    // This protects structured fields during edit/save persistence.
    cases.push(normalizedCase);
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
      ...c,
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
      ...tc,
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

function getCaseNumber(id: string): number {
  const match = String(id ?? "").match(/^TC-(\d{1,4})$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function CasesTextCardContent({
  parsedCases,
  text,
  hasStructuredCases,
  resolvedTheme = "dark",
  defaultViewMode = "expanded",
  provenanceLabel,
  provenanceDescription,
  extraWorkflowActions,
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
  defaultViewMode?: ViewMode;
  provenanceLabel?: string;
  provenanceDescription?: string;
  extraWorkflowActions?: ReactNode;
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;
  onReviewTestSuiteAction?: () => void;
  canReviewTestSuite?: boolean;
  isReviewingTestSuite?: boolean;
  onGenerateNextBatchAction?: () => void;
  canGenerateNextBatch?: boolean;
  isGeneratingNextBatch?: boolean;
  onRegenerateSuiteAction?: () => void;
  canRegenerateSuite?: boolean;
  isRegeneratingSuite?: boolean;
}) {
  const isDark = resolvedTheme === "dark";

  const [toast, setToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editedCases, setEditedCases] = useState<ParsedCase[]>(parsedCases);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("id_asc");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);

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
    return rebuildSuiteText(persistedCases, text);
  }, [persistedCases, text]);

  const isDirty = hasStructuredCases && hasLocalEdits;

  const showReviewAction =
    typeof onReviewTestSuiteAction === "function" && hasStructuredCases;

  const showGenerateNextBatchAction =
    typeof onGenerateNextBatchAction === "function" && hasStructuredCases;

  const showRegenerateSuiteAction =
    typeof onRegenerateSuiteAction === "function" && hasStructuredCases;

  const visibleCases = useMemo(() => {
    const normalizedQuery = normalizeWhitespace(searchQuery).toLowerCase();

    const matchesQuery = (tc: ParsedCase) => {
      if (!normalizedQuery) return true;

      const haystack = [tc.id, tc.title, tc.body].join("\n").toLowerCase();
      return haystack.includes(normalizedQuery);
    };

    const matchesFilter = (tc: ParsedCase) => {
      if (filterMode === "all") return true;
      if (filterMode === "invalid") return invalidCaseIds.has(tc.id);
      if (filterMode === "editing") return editingId === tc.id;
      return true;
    };

    const next = editedCases.filter((tc) => matchesQuery(tc) && matchesFilter(tc));

    next.sort((a, b) => {
      switch (sortMode) {
        case "id_desc":
          return getCaseNumber(b.id) - getCaseNumber(a.id);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "id_asc":
        default:
          return getCaseNumber(a.id) - getCaseNumber(b.id);
      }
    });

    return next;
  }, [editedCases, searchQuery, filterMode, sortMode, invalidCaseIds, editingId]);

  const hiddenCount = Math.max(editedCases.length - visibleCases.length, 0);

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
    if (!onUpdateTestSuiteAction || !hasStructuredCases || !isDirty) {
      return true;
    }

    if (hasValidationIssues) {
      setToast("Resolve suite issues before saving");
      return false;
    }

    try {
      setIsSaving(true);
      await onUpdateTestSuiteAction(persistedCases);
      setToast("Saved ✓");
      setHasLocalEdits(false);
      return true;
    } catch {
      setToast("Save failed");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditToggle = async (id: string) => {
    const isCurrentlyEditing = editingId === id;

    if (!isCurrentlyEditing) {
      setEditingId(id);
      return;
    }

    const didSave = await saveSuite();

    if (didSave) {
      setEditingId(null);
    }
  };

  const updateCaseField = (
    id: string,
    field: "title" | "body",
    value: string
  ) => {
    setHasLocalEdits(true);
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
      : null;

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

          {hasStructuredCases && editingSummary ? (
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

        {provenanceLabel || provenanceDescription ? (
          <div style={{ display: "grid", gap: 6 }}>
            {provenanceLabel ? (
              <ArtifactProvenanceLabel
                label={provenanceLabel}
                resolvedTheme={resolvedTheme}
              />
            ) : null}

            {provenanceDescription ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.76 }}>
                {provenanceDescription}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <SectionLabel
            title="Workflow actions"
            description="Run artifact-driven suite actions from the current persisted workspace."
            resolvedTheme={resolvedTheme}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {showRegenerateSuiteAction ? (
              <SmallButton
                onClickAction={() => {
                  onRegenerateSuiteAction?.();
                }}
                disabled={!canRegenerateSuite || isRegeneratingSuite || isSaving}
                resolvedTheme={resolvedTheme}
              >
                {isRegeneratingSuite ? "Improving..." : "Improve Test Plan"}
              </SmallButton>
            ) : null}

            {showGenerateNextBatchAction ? (
              <SmallButton
                onClickAction={() => {
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
                onClickAction={() => {
                  onReviewTestSuiteAction?.();
                }}
                disabled={!canReviewTestSuite || isReviewingTestSuite || isSaving}
                resolvedTheme={resolvedTheme}
              >
                {isReviewingTestSuite ? "Reviewing..." : "Review Test Suite"}
              </SmallButton>
            ) : null}

            {extraWorkflowActions}
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
              onClickAction={copyText}
              disabled={isSaving}
              resolvedTheme={resolvedTheme}
            >
              Copy
            </SmallButton>

            {hasStructuredCases ? (
              <SmallButton
                onClickAction={async () => {
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

        {hasStructuredCases ? (
          <div>
            <SectionLabel
              title="Suite controls"
              description="Search, sort, and narrow the visible suite without changing persisted artifact data."
              resolvedTheme={resolvedTheme}
            />

            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "minmax(220px, 1fr) repeat(3, minmax(150px, auto))",
                alignItems: "center",
              }}
            >
              <TextInput
                value={searchQuery}
                onChangeAction={setSearchQuery}
                placeholder="Search by ID, title, or case body"
                resolvedTheme={resolvedTheme}
                disabled={isSaving}
              />

              <SelectControl
                value={filterMode}
                onChangeAction={(value) => setFilterMode(value as FilterMode)}
                resolvedTheme={resolvedTheme}
                disabled={isSaving}
                options={[
                  { value: "all", label: "Show: All" },
                  { value: "invalid", label: "Show: Invalid only" },
                  { value: "editing", label: "Show: Editing only" },
                ]}
              />

              <SelectControl
                value={sortMode}
                onChangeAction={(value) => setSortMode(value as SortMode)}
                resolvedTheme={resolvedTheme}
                disabled={isSaving}
                options={[
                  { value: "id_asc", label: "Sort: ID ↑" },
                  { value: "id_desc", label: "Sort: ID ↓" },
                  { value: "title_asc", label: "Sort: Title A-Z" },
                  { value: "title_desc", label: "Sort: Title Z-A" },
                ]}
              />

              <SelectControl
                value={viewMode}
                onChangeAction={(value) => setViewMode(value as ViewMode)}
                resolvedTheme={resolvedTheme}
                disabled={isSaving}
                options={[
                  { value: "expanded", label: "View: Expanded" },
                  { value: "overview", label: "View: Overview" },
                ]}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 8,
                fontSize: 12,
                color: isDark
                  ? "rgba(255,255,255,0.72)"
                  : "rgba(15,23,42,0.72)",
              }}
            >
              <div>
                Visible: <strong>{visibleCases.length}</strong> / {editedCases.length}
              </div>
              <div>
                Invalid: <strong>{invalidCaseIds.size}</strong>
              </div>
              <div>
                Hidden: <strong>{hiddenCount}</strong>
              </div>
            </div>
          </div>
        ) : null}
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

          {visibleCases.length === 0 ? (
            <div
              style={{
                marginBottom: 12,
                border: isDark
                  ? "1px solid rgba(255,255,255,0.10)"
                  : "1px solid rgba(15,23,42,0.10)",
                borderRadius: 14,
                padding: 14,
                background: isDark
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(15,23,42,0.03)",
                fontSize: 13,
                color: isDark
                  ? "rgba(255,255,255,0.78)"
                  : "rgba(15,23,42,0.78)",
              }}
            >
              No cases match the current controls.
            </div>
          ) : null}

          {visibleCases.map((tc) => {
            const isEditing = editingId === tc.id;
            const isInvalid = invalidCaseIds.has(tc.id);
            const overview = buildCaseOverview(tc.body);

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
                        marginBottom: 6,
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

                      {overview.type ? (
                        <ToneBadge
                          label={`Type: ${overview.type}`}
                          resolvedTheme={resolvedTheme}
                        />
                      ) : null}

                      {overview.priority ? (
                        <ToneBadge
                          label={`Priority: ${overview.priority}`}
                          resolvedTheme={resolvedTheme}
                        />
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
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>{tc.title}</div>
                    )}
                  </div>

                  <SmallButton
                    onClickAction={() => handleEditToggle(tc.id)}
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
                ) : viewMode === "overview" ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      }}
                    >
                      <div
                        style={{
                          borderRadius: 12,
                          padding: 10,
                          background: isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(15,23,42,0.03)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(15,23,42,0.08)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            opacity: 0.66,
                            marginBottom: 4,
                          }}
                        >
                          PRECONDITIONS
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          {truncateText(overview.preconditions)}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 12,
                          padding: 10,
                          background: isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(15,23,42,0.03)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(15,23,42,0.08)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            opacity: 0.66,
                            marginBottom: 4,
                          }}
                        >
                          FIRST STEP
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          {truncateText(overview.firstStep)}
                        </div>
                      </div>

                      <div
                        style={{
                          borderRadius: 12,
                          padding: 10,
                          background: isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(15,23,42,0.03)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "1px solid rgba(15,23,42,0.08)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            opacity: 0.66,
                            marginBottom: 4,
                          }}
                        >
                          EXPECTED RESULT
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          {truncateText(overview.expected)}
                        </div>
                      </div>
                    </div>
                  </div>
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

          <CollapsibleRawSuiteText
            text={renderedText}
            resolvedTheme={resolvedTheme}
          />
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
  defaultViewMode = "expanded",
  provenanceLabel,
  provenanceDescription,
  extraWorkflowActions,
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
      defaultViewMode={defaultViewMode}
      provenanceLabel={provenanceLabel}
      provenanceDescription={provenanceDescription}
      extraWorkflowActions={extraWorkflowActions}
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
