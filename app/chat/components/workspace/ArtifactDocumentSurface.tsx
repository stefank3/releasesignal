"use client";

import React from "react";
import type { TestCase } from "@/lib/chat/artifact";
import type {
  ChatItem,
  ExecutionIntelligenceArtifact,
  ReviewResult,
  SessionArtifact,
} from "../../chat.types";
import RequirementCard from "../../cards/RequirementCard";
import CasesTextCard from "../../cards/CasesTextCard";
import ReviewCard from "../../cards/ReviewCard";
import { UploadTestResultsButton } from "../execution/UploadTestResultsButton";
import { TestSuiteExportMenu } from "../TestSuiteExportMenu";
import {
  buildRequirementProvenanceLabel,
  buildReviewProvenanceLabel,
  buildSuiteProvenanceLabel,
  getLatestArtifactDocumentItems,
} from "./artifactDocumentItems";

type Props = {
  items: ChatItem[];
  sessionArtifact?: SessionArtifact | null;
  sessionId?: string | null;
  resolvedTheme?: "light" | "dark";
  commandCenter?: boolean;
  testDesignVisual?: boolean;
  initiallyOpenSuite?: boolean;
  onUpdateTestSuiteAction?: (cases: TestCase[]) => void;
  onGenerateTestsAction?: () => void;
  canGenerateTests?: boolean;
  isGeneratingTests?: boolean;
  onRefineRequirementAction?: () => void;
  canRefineRequirement?: boolean;
  isRefiningRequirement?: boolean;
  onReviewTestSuiteAction?: () => void;
  canReviewTestSuite?: boolean;
  isReviewingTestSuite?: boolean;
  onGenerateNextBatchAction?: () => void;
  canGenerateNextBatch?: boolean;
  isGeneratingNextBatch?: boolean;
  onRegenerateSuiteAction?: () => void;
  canRegenerateSuite?: boolean;
  isRegeneratingSuite?: boolean;
  onExecutionUploadSuccess?: (args: {
    executionIntelligence: ExecutionIntelligenceArtifact;
    artifact?: SessionArtifact | null;
    artifactUpdatedAt?: string | null;
  }) => void;
};

function SurfaceLabel({
  resolvedTheme,
}: {
  resolvedTheme: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        color: isDark ? "#ffffff" : "#0f172a",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 950 }}>
        Workspace artifacts
      </div>
      <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.45 }}>
        Saved requirement, generated suite, review result, and execution evidence
        for this workspace.
      </div>
    </div>
  );
}

function getDocumentTitle(kind: "requirement" | "suite" | "review", count?: number) {
  if (kind === "requirement") return "Technical Requirement";
  if (kind === "suite") return `Generated Test Cases${count ? ` (${count})` : ""}`;
  return "Review Result";
}

function getDocumentAction(kind: "requirement" | "suite" | "review", count?: number) {
  if (kind === "requirement") return "Open full view";
  if (kind === "suite") return `Open test suite${count ? ` (${count})` : ""}`;
  return "Open full review";
}

function getDocumentPreview(text: string): string {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  return lines.join(" ");
}

function toDisplayLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Unknown";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getExecutionAttentionRank(status: string): number {
  if (status === "failed") return 1;
  if (status === "blocked") return 2;
  if (status === "timed_out") return 3;
  if (status === "skipped") return 4;
  return 5;
}

function getExecutionAttentionTone(status: string, isDark: boolean): {
  border: string;
  background: string;
  color: string;
} {
  if (status === "skipped") {
    return {
      border: isDark ? "1px solid #E0AE5A" : "1px solid #96690F",
      background: isDark ? "rgba(224,174,90,0.14)" : "rgba(150,105,15,0.09)",
      color: isDark ? "#EDEAE3" : "#262521",
    };
  }

  return {
    border: isDark ? "1px solid #E8776A" : "1px solid #B0392E",
    background: isDark ? "rgba(232,119,106,0.14)" : "rgba(176,57,46,0.09)",
    color: isDark ? "#EDEAE3" : "#262521",
  };
}

function getExecutionStatusLabel(
  execution: ExecutionIntelligenceArtifact | null | undefined
): string {
  if (!execution) return "Not started";
  return `${toDisplayLabel(execution.suiteStatus)} - ${execution.summary.total}`;
}

function getExecutionPreview(
  execution: ExecutionIntelligenceArtifact | null | undefined
): string {
  if (!execution) return "No execution results uploaded yet.";
  const summary = execution.summary;
  const suite =
    typeof execution.suiteVersion === "number"
      ? `Suite v${execution.suiteVersion}`
      : "Unknown suite";

  return `${summary.passed} passed - ${summary.failed} failed - ${summary.skipped} skipped - linked to ${suite}`;
}

function ArtifactSummaryShell({
  kind,
  title,
  statusLabel,
  actionLabel,
  preview,
  children,
  resolvedTheme,
  commandCenter = false,
  testDesignVisual = false,
  initiallyOpen = false,
}: {
  kind: "requirement" | "suite" | "review" | "execution";
  title: string;
  statusLabel?: string;
  actionLabel: string;
  preview: string;
  children: React.ReactNode;
  resolvedTheme: "light" | "dark";
  commandCenter?: boolean;
  testDesignVisual?: boolean;
  initiallyOpen?: boolean;
}) {
  const isDark = resolvedTheme === "dark";
  const [isOpen, setIsOpen] = React.useState(initiallyOpen);
  const accentColor = isDark ? "#D97757" : "#C15F3C";

  return (
    <details
      data-artifact-row={kind}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      style={{
        border: isDark
          ? "1px solid #3A382F"
          : "1px solid #D9D3C2",
        borderRadius: commandCenter || testDesignVisual ? 12 : 16,
        background: testDesignVisual
          ? isDark
            ? "#2B2A26"
            : "#FCFBF6"
          : commandCenter
          ? isDark
            ? "#302F2A"
            : "#FFFFFF"
          : isDark
            ? "rgba(255,255,255,0.032)"
            : "rgba(15,23,42,0.025)",
        color: isDark ? "#EDEAE3" : "#262521",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: commandCenter || testDesignVisual ? 12 : 14,
          display: "grid",
          gap: 8,
          minHeight: commandCenter ? 96 : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 950 }}>{title}</span>
            {statusLabel ? (
              <span
                style={{
                  border: testDesignVisual
                    ? isDark
                      ? "1px solid #3B5745"
                      : "1px solid #BFD5BD"
                    : isDark
                      ? "1px solid rgba(96,165,250,0.22)"
                      : "1px solid rgba(37,99,235,0.18)",
                  background: testDesignVisual
                    ? isDark
                      ? "#26332B"
                      : "#E2ECE0"
                    : isDark
                      ? "rgba(96,165,250,0.08)"
                      : "rgba(37,99,235,0.06)",
                  color: testDesignVisual
                    ? isDark
                      ? "#7CC08A"
                      : "#2F7A44"
                    : undefined,
                  borderRadius: 999,
                  padding: "4px 8px",
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {statusLabel}
              </span>
            ) : null}
          </span>
          <span
            style={{
              border: testDesignVisual
                ? isDark
                  ? "1px solid #4A4739"
                  : "1px solid #C4BCA7"
                : isDark
                  ? "1px solid rgba(255,255,255,0.14)"
                  : "1px solid rgba(15,23,42,0.12)",
              borderRadius: 999,
              padding: "5px 9px",
              background: testDesignVisual
                ? isDark
                  ? "#35332C"
                  : "#F1EDE2"
                : commandCenter
                ? isDark
                  ? "rgba(217,119,87,0.12)"
                  : "rgba(193,95,60,0.08)"
                : undefined,
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {isOpen ? "Close" : actionLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            opacity: 0.72,
            display: commandCenter || testDesignVisual ? "-webkit-box" : undefined,
            WebkitLineClamp: commandCenter || testDesignVisual ? 2 : undefined,
            WebkitBoxOrient:
              commandCenter || testDesignVisual ? "vertical" : undefined,
            overflow: commandCenter || testDesignVisual ? "hidden" : undefined,
          }}
        >
          {preview || "Saved artifact content is available in the full view."}
        </div>
      </summary>
      <div
        style={{
          borderTop: isDark
            ? `3px solid ${accentColor}`
            : `3px solid ${accentColor}`,
          padding: 12,
        }}
      >
        {children}
      </div>
    </details>
  );
}

function ExecutionResultsDetail({
  execution,
  sessionId,
  hasSuite,
  resolvedTheme,
  uploadButtonLabel,
  onExecutionUploadSuccess,
}: {
  execution: ExecutionIntelligenceArtifact | null | undefined;
  sessionId?: string | null;
  hasSuite: boolean;
  resolvedTheme: "light" | "dark";
  uploadButtonLabel?: string;
  onExecutionUploadSuccess?: (args: {
    executionIntelligence: ExecutionIntelligenceArtifact;
    artifact?: SessionArtifact | null;
    artifactUpdatedAt?: string | null;
  }) => void;
}) {
  const isDark = resolvedTheme === "dark";
  const uploadAction = onExecutionUploadSuccess ? (
    <UploadTestResultsButton
      sessionId={sessionId ?? null}
      disabled={!hasSuite}
      resolvedTheme={resolvedTheme}
      buttonLabel={
        uploadButtonLabel ??
        (execution ? "Upload new results" : "Upload Execution Results")
      }
      onUploadSuccess={onExecutionUploadSuccess}
    />
  ) : null;

  if (!execution) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.72 }}>
          Execution results have not been uploaded for this workspace yet.
        </div>
        {uploadAction}
      </div>
    );
  }

  const total = Math.max(0, Number(execution.summary.total ?? 0));
  const buckets = [
    { label: "Passed", value: execution.summary.passed, color: "#22c55e" },
    { label: "Failed", value: execution.summary.failed, color: "#ef4444" },
    { label: "Skipped", value: execution.summary.skipped, color: "#f59e0b" },
    { label: "Blocked", value: execution.summary.blocked, color: "#dc2626" },
    { label: "Timed out", value: execution.summary.timedOut, color: "#b91c1c" },
    { label: "Unknown", value: execution.summary.unknown, color: "#94a3b8" },
  ];
  const attentionItems = execution.caseResults
    .filter((result) =>
      ["failed", "skipped", "blocked", "timed_out"].includes(result.status)
    )
    .sort(
      (a, b) =>
        getExecutionAttentionRank(a.status) - getExecutionAttentionRank(b.status)
    )
    .slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {uploadAction}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 12,
        }}
      >
        <span style={{ opacity: 0.72 }}>Total uploaded</span>
        <strong>{total}</strong>
      </div>

      <div
        role="img"
        aria-label={`Execution results: ${buckets
          .map((bucket) => `${bucket.label} ${bucket.value}`)
          .join(", ")}`}
        style={{
          display: "flex",
          height: 10,
          overflow: "hidden",
          borderRadius: 999,
          background: isDark ? "rgba(15,23,42,0.92)" : "rgba(226,232,240,0.95)",
        }}
      >
        {buckets
          .filter((bucket) => bucket.value > 0 && total > 0)
          .map((bucket) => (
            <div
              key={bucket.label}
              aria-hidden="true"
              style={{
                width: `${(bucket.value / total) * 100}%`,
                background: bucket.color,
              }}
            />
          ))}
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        }}
      >
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            style={{
              border: isDark
                ? "1px solid rgba(255,255,255,0.10)"
                : "1px solid rgba(15,23,42,0.10)",
              borderRadius: 10,
              padding: "8px 9px",
              background: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(15,23,42,0.025)",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.68 }}>
              {bucket.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 13, fontWeight: 950 }}>
              {bucket.value}
            </div>
          </div>
        ))}
      </div>

      {attentionItems.length ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
            borderRadius: 12,
            padding: 10,
            background: isDark ? "#2B2A26" : "#FCFBF6",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 950 }}>
            Needs attention first
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {attentionItems.map((item) => {
              const tone = getExecutionAttentionTone(item.status, isDark);

              return (
                <div
                  key={`${item.caseId}-${item.status}`}
                  style={{
                    display: "grid",
                    gap: 5,
                    borderTop: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
                    paddingTop: 7,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        border: tone.border,
                        background: tone.background,
                        color: tone.color,
                        borderRadius: 999,
                        padding: "3px 7px",
                        fontSize: 10,
                        fontWeight: 950,
                      }}
                    >
                      {toDisplayLabel(item.status)}
                    </span>
                    <strong style={{ fontSize: 12 }}>
                      {item.externalCaseName || item.caseId}
                    </strong>
                  </div>
                  {item.errorMessage ? (
                    <span style={{ opacity: 0.76 }}>{item.errorMessage}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
        Persisted execution artifact - does not change the Review Score.
      </div>
    </div>
  );
}

export function ArtifactDocumentSurface({
  items,
  sessionArtifact = null,
  sessionId = null,
  resolvedTheme = "dark",
  commandCenter = false,
  testDesignVisual = false,
  initiallyOpenSuite = testDesignVisual,
  onUpdateTestSuiteAction,
  onGenerateTestsAction,
  canGenerateTests = false,
  isGeneratingTests = false,
  onRefineRequirementAction,
  canRefineRequirement = false,
  isRefiningRequirement = false,
  onReviewTestSuiteAction,
  canReviewTestSuite = false,
  isReviewingTestSuite = false,
  onGenerateNextBatchAction,
  canGenerateNextBatch = false,
  isGeneratingNextBatch = false,
  onRegenerateSuiteAction,
  canRegenerateSuite = false,
  isRegeneratingSuite = false,
  onExecutionUploadSuccess,
}: Props) {
  const documents = getLatestArtifactDocumentItems(items);
  const execution = sessionArtifact?.executionIntelligence ?? null;
  const persistedReview = sessionArtifact?.reviewResult ?? null;
  const hasSuite = !!sessionArtifact?.testSuite;
  const hasReviewDocument = documents.some((document) => document.kind === "review");

  if (!documents.length && !execution && !persistedReview) return null;

  return (
    <section
      aria-label="Generated artifact documents"
      data-tour-anchor="artifact-documents"
      style={{
        display: "grid",
        gap: 12,
        marginBottom: 12,
      }}
    >
      {commandCenter || testDesignVisual ? null : (
        <SurfaceLabel resolvedTheme={resolvedTheme} />
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {documents.map((document) => {
          if (document.kind === "requirement") {
            return (
              <ArtifactSummaryShell
                key={`artifact-document-${document.kind}-${document.index}`}
                kind="requirement"
                title={getDocumentTitle(document.kind)}
                statusLabel={
                  commandCenter
                    ? `v${
                        (
                          sessionArtifact?.refinedRequirement as
                            | { version?: number }
                            | undefined
                        )?.version ?? 1
                      }`
                    : undefined
                }
                actionLabel={getDocumentAction(document.kind)}
                preview={getDocumentPreview(document.item.text)}
                resolvedTheme={resolvedTheme}
                commandCenter={commandCenter}
                testDesignVisual={testDesignVisual}
              >
                <RequirementCard
                  text={document.item.text}
                  resolvedTheme={resolvedTheme}
                  provenanceLabel={buildRequirementProvenanceLabel(sessionArtifact)}
                  provenanceDescription="Generated requirement artifact used for downstream test design."
                  onGenerateTestsAction={onGenerateTestsAction}
                  canGenerateTests={canGenerateTests}
                  isGeneratingTests={isGeneratingTests}
                  onRefineRequirementAction={onRefineRequirementAction}
                  canRefineRequirement={canRefineRequirement}
                  isRefiningRequirement={isRefiningRequirement}
                />
              </ArtifactSummaryShell>
            );
          }

          if (document.kind === "suite") {
            const suiteCount = sessionArtifact?.testSuite?.cases?.length ?? 0;
            return (
              <ArtifactSummaryShell
                key={`artifact-document-${document.kind}-${document.index}`}
                kind="suite"
                title={
                  commandCenter
                    ? "Generated Test Cases"
                    : testDesignVisual
                      ? `Test Suite v${sessionArtifact?.testSuite?.version ?? "—"} — generated test cases${suiteCount ? ` (${suiteCount})` : ""}`
                    : getDocumentTitle(document.kind, suiteCount)
                }
                statusLabel={
                  commandCenter || testDesignVisual
                    ? `Suite v${sessionArtifact?.testSuite?.version ?? "n"}`
                    : undefined
                }
                actionLabel={getDocumentAction(document.kind, suiteCount)}
                preview={getDocumentPreview(document.item.text)}
                resolvedTheme={resolvedTheme}
                commandCenter={commandCenter}
                testDesignVisual={testDesignVisual}
                initiallyOpen={initiallyOpenSuite}
              >
                <CasesTextCard
                  text={document.item.text}
                  resolvedTheme={resolvedTheme}
                  defaultViewMode={commandCenter ? "overview" : undefined}
                  visualVariant={testDesignVisual ? "strategy" : "default"}
                  showWorkflowActions={!testDesignVisual}
                  provenanceLabel={buildSuiteProvenanceLabel(sessionArtifact)}
                  provenanceDescription="Generated test suite artifact used for review and execution evidence."
                  extraWorkflowActions={
                    commandCenter ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          minWidth: 220,
                        }}
                      >
                        <TestSuiteExportMenu
                          sessionId={sessionId}
                          disabled={!hasSuite}
                          formats={["execution-csv"]}
                        />
                      </div>
                    ) : null
                  }
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
              </ArtifactSummaryShell>
            );
          }

          return (
            <ArtifactSummaryShell
              key={`artifact-document-${document.kind}-${document.index}`}
              kind="review"
              title={getDocumentTitle(document.kind)}
              statusLabel={
                commandCenter && document.item.review
                  ? `${document.item.review.score}/100`
                  : undefined
              }
              actionLabel={getDocumentAction(document.kind)}
              preview={getDocumentPreview(
                document.item.review
                  ? `Review Score: ${document.item.review.score}/100 ${document.item.review.verdict ?? ""}`
                  : ""
              )}
              resolvedTheme={resolvedTheme}
              commandCenter={commandCenter}
              testDesignVisual={testDesignVisual}
            >
              <div data-tour-anchor="review-actions">
                <ReviewCard
                  review={document.item.review as ReviewResult}
                  resolvedTheme={resolvedTheme}
                  provenanceLabel={buildReviewProvenanceLabel(sessionArtifact)}
                  provenanceDescription="Persisted review result for the current test design."
                  onImproveTestPlanAction={onRegenerateSuiteAction}
                  canImproveTestPlan={canRegenerateSuite}
                  isImprovingTestPlan={isRegeneratingSuite}
                  onGenerateFromGapsAction={onGenerateNextBatchAction}
                  canGenerateFromGaps={canGenerateNextBatch}
                  isGeneratingFromGaps={isGeneratingNextBatch}
                />
              </div>
            </ArtifactSummaryShell>
          );
        })}

        {persistedReview && !hasReviewDocument ? (
          <ArtifactSummaryShell
            key="artifact-document-persisted-review"
            kind="review"
            title="Review Result"
            statusLabel={commandCenter ? `${persistedReview.score}/100` : undefined}
            actionLabel="Open full review"
            preview={getDocumentPreview(
              `Review Score: ${persistedReview.score}/100 ${persistedReview.verdict ?? ""}`
            )}
            resolvedTheme={resolvedTheme}
            commandCenter={commandCenter}
            testDesignVisual={testDesignVisual}
          >
            <div data-tour-anchor="review-actions">
              <ReviewCard
                review={persistedReview as ReviewResult}
                resolvedTheme={resolvedTheme}
                provenanceLabel={buildReviewProvenanceLabel(sessionArtifact)}
                provenanceDescription="Persisted review result for the current test design."
                onImproveTestPlanAction={onRegenerateSuiteAction}
                canImproveTestPlan={canRegenerateSuite}
                isImprovingTestPlan={isRegeneratingSuite}
                onGenerateFromGapsAction={onGenerateNextBatchAction}
                canGenerateFromGaps={canGenerateNextBatch}
                isGeneratingFromGaps={isGeneratingNextBatch}
              />
            </div>
          </ArtifactSummaryShell>
        ) : null}

        {commandCenter || testDesignVisual ? (
          <ArtifactSummaryShell
            key="artifact-document-execution-results"
            kind="execution"
            title={testDesignVisual ? "Execution Evidence" : "Execution Results"}
            statusLabel={getExecutionStatusLabel(execution)}
            actionLabel={execution ? "Open execution results" : "Upload Test Results"}
            preview={getExecutionPreview(execution)}
            resolvedTheme={resolvedTheme}
            commandCenter={commandCenter}
            testDesignVisual={testDesignVisual}
          >
            <ExecutionResultsDetail
              execution={execution}
              sessionId={sessionId}
              hasSuite={hasSuite}
              resolvedTheme={resolvedTheme}
              uploadButtonLabel={testDesignVisual ? "Upload Test Results" : undefined}
              onExecutionUploadSuccess={onExecutionUploadSuccess}
            />
          </ArtifactSummaryShell>
        ) : null}
      </div>
    </section>
  );
}
