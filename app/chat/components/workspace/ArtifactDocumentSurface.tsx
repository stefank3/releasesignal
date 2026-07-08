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
import {
  buildRequirementProvenanceLabel,
  buildReviewProvenanceLabel,
  buildSuiteProvenanceLabel,
  getLatestArtifactDocumentItems,
} from "./artifactDocumentItems";

type Props = {
  items: ChatItem[];
  sessionArtifact?: SessionArtifact | null;
  resolvedTheme?: "light" | "dark";
  commandCenter?: boolean;
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
        Generated Artifact Documents
      </div>
      <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.45 }}>
        Latest generated requirement, test suite, and review documents for this
        workspace. These cards display persisted artifact context without
        changing product truth.
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
}: {
  kind: "requirement" | "suite" | "review" | "execution";
  title: string;
  statusLabel?: string;
  actionLabel: string;
  preview: string;
  children: React.ReactNode;
  resolvedTheme: "light" | "dark";
  commandCenter?: boolean;
}) {
  const isDark = resolvedTheme === "dark";
  const [isOpen, setIsOpen] = React.useState(false);
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
        borderRadius: commandCenter ? 12 : 16,
        background: commandCenter
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
          padding: commandCenter ? 12 : 14,
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
                  border: isDark
                    ? "1px solid rgba(96,165,250,0.22)"
                    : "1px solid rgba(37,99,235,0.18)",
                  background: isDark
                    ? "rgba(96,165,250,0.08)"
                    : "rgba(37,99,235,0.06)",
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
              border: isDark
                ? "1px solid rgba(255,255,255,0.14)"
                : "1px solid rgba(15,23,42,0.12)",
              borderRadius: 999,
              padding: "5px 9px",
              background: commandCenter
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
            display: commandCenter ? "-webkit-box" : undefined,
            WebkitLineClamp: commandCenter ? 2 : undefined,
            WebkitBoxOrient: commandCenter ? "vertical" : undefined,
            overflow: commandCenter ? "hidden" : undefined,
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 950 }}>{title}</div>
            <div style={{ fontSize: 11, opacity: 0.68 }}>
              {statusLabel ?? "Persisted artifact detail"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
              background: isDark ? "#2B2A26" : "#FCFBF6",
              color: isDark ? "#EDEAE3" : "#262521",
              borderRadius: 10,
              padding: "7px 10px",
              fontSize: 12,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </details>
  );
}

function ExecutionResultsDetail({
  execution,
  resolvedTheme,
}: {
  execution: ExecutionIntelligenceArtifact | null | undefined;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  if (!execution) {
    return (
      <div style={{ fontSize: 12, opacity: 0.72 }}>
        Execution results have not been uploaded for this workspace yet.
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
    .slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 12 }}>
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
            {attentionItems.map((item) => (
              <div
                key={`${item.caseId}-${item.status}`}
                style={{
                  display: "grid",
                  gap: 3,
                  borderTop: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
                  paddingTop: 6,
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ fontSize: 12 }}>
                  {item.externalCaseName || item.caseId}
                </strong>
                <span style={{ opacity: 0.76 }}>
                  {toDisplayLabel(item.status)}
                  {item.errorMessage ? ` - ${item.errorMessage}` : ""}
                </span>
              </div>
            ))}
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
  resolvedTheme = "dark",
  commandCenter = false,
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
}: Props) {
  const documents = getLatestArtifactDocumentItems(items);
  const execution = sessionArtifact?.executionIntelligence ?? null;

  if (!documents.length && !execution) return null;

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
      <SurfaceLabel resolvedTheme={resolvedTheme} />

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
                    : getDocumentTitle(document.kind, suiteCount)
                }
                statusLabel={
                  commandCenter
                    ? `Suite v${sessionArtifact?.testSuite?.version ?? "n"}`
                    : undefined
                }
                actionLabel={getDocumentAction(document.kind, suiteCount)}
                preview={getDocumentPreview(document.item.text)}
                resolvedTheme={resolvedTheme}
                commandCenter={commandCenter}
              >
                <CasesTextCard
                  text={document.item.text}
                  resolvedTheme={resolvedTheme}
                  provenanceLabel={buildSuiteProvenanceLabel(sessionArtifact)}
                  provenanceDescription="Generated test suite artifact used for review and execution evidence."
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

        {commandCenter ? (
          <ArtifactSummaryShell
            key="artifact-document-execution-results"
            kind="execution"
            title="Execution Results"
            statusLabel={getExecutionStatusLabel(execution)}
            actionLabel="Open execution results"
            preview={getExecutionPreview(execution)}
            resolvedTheme={resolvedTheme}
            commandCenter={commandCenter}
          >
            <ExecutionResultsDetail
              execution={execution}
              resolvedTheme={resolvedTheme}
            />
          </ArtifactSummaryShell>
        ) : null}
      </div>
    </section>
  );
}
