"use client";

import React from "react";
import type { TestCase } from "@/lib/chat/artifact";
import type { ChatItem, ReviewResult, SessionArtifact } from "../../chat.types";
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

function ArtifactSummaryShell({
  title,
  actionLabel,
  preview,
  children,
  resolvedTheme,
}: {
  title: string;
  actionLabel: string;
  preview: string;
  children: React.ReactNode;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = resolvedTheme === "dark";

  return (
    <details
      style={{
        border: isDark
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(15,23,42,0.10)",
        borderRadius: 16,
        background: isDark ? "rgba(255,255,255,0.032)" : "rgba(15,23,42,0.025)",
        color: isDark ? "#ffffff" : "#0f172a",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: 14,
          display: "grid",
          gap: 8,
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
          <span style={{ fontSize: 13, fontWeight: 950 }}>{title}</span>
          <span
            style={{
              border: isDark
                ? "1px solid rgba(255,255,255,0.14)"
                : "1px solid rgba(15,23,42,0.12)",
              borderRadius: 999,
              padding: "5px 9px",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {actionLabel}
          </span>
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>
          {preview || "Saved artifact content is available in the full view."}
        </div>
      </summary>
      <div
        style={{
          borderTop: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(15,23,42,0.08)",
          padding: 12,
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function ArtifactDocumentSurface({
  items,
  sessionArtifact = null,
  resolvedTheme = "dark",
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

  if (!documents.length) return null;

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
                title={getDocumentTitle(document.kind)}
                actionLabel={getDocumentAction(document.kind)}
                preview={getDocumentPreview(document.item.text)}
                resolvedTheme={resolvedTheme}
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
                title={getDocumentTitle(document.kind, suiteCount)}
                actionLabel={getDocumentAction(document.kind, suiteCount)}
                preview={getDocumentPreview(document.item.text)}
                resolvedTheme={resolvedTheme}
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
              title={getDocumentTitle(document.kind)}
              actionLabel={getDocumentAction(document.kind)}
              preview={getDocumentPreview(
                document.item.review
                  ? `Review Score: ${document.item.review.score}/100 ${document.item.review.verdict ?? ""}`
                  : ""
              )}
              resolvedTheme={resolvedTheme}
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
      </div>
    </section>
  );
}
