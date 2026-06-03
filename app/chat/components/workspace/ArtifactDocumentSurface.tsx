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
              <RequirementCard
                key={`artifact-document-${document.kind}-${document.index}`}
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
            );
          }

          if (document.kind === "suite") {
            return (
              <CasesTextCard
                key={`artifact-document-${document.kind}-${document.index}`}
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
            );
          }

          return (
            <div
              key={`artifact-document-${document.kind}-${document.index}`}
              data-tour-anchor="review-actions"
            >
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
          );
        })}
      </div>
    </section>
  );
}
