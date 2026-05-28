"use client";

import type { ChatItem, SessionArtifact } from "../../chat.types";
import {
  formatArtifactVersion,
  joinProvenanceParts,
} from "./ArtifactProvenanceLabel";

export type LatestArtifactDocumentIndexes = {
  latestRequirementIndex: number;
  latestPersistedSuiteIndex: number;
  latestReviewIndex: number;
};

export type ArtifactDocumentItem =
  | { kind: "requirement"; index: number; item: Extract<ChatItem, { kind: "text" }> }
  | {
      kind: "suite";
      index: number;
      item: Extract<ChatItem, { kind: "casesText" }>;
    }
  | { kind: "review"; index: number; item: Extract<ChatItem, { kind: "review" }> };

export function looksLikePersistedTestSuiteText(value: string): boolean {
  const text = String(value ?? "").trim();
  return /^Test Suite v\d+\s*\nTotal test cases:\s*\d+/i.test(text);
}

export function looksLikeRequirementText(value: string): boolean {
  return String(value ?? "")
    .trimStart()
    .startsWith("Refined Technical Requirement");
}

export function getLatestArtifactDocumentIndexes(
  items: ChatItem[]
): LatestArtifactDocumentIndexes {
  let latestRequirementIndex = -1;
  let latestPersistedSuiteIndex = -1;
  let latestReviewIndex = -1;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (
      item.kind === "text" &&
      item.role !== "user" &&
      looksLikeRequirementText(item.text)
    ) {
      latestRequirementIndex = index;
    }

    if (
      item.kind === "casesText" &&
      looksLikePersistedTestSuiteText(item.text)
    ) {
      latestPersistedSuiteIndex = index;
    }

    if (item.kind === "review") {
      latestReviewIndex = index;
    }
  }

  return {
    latestRequirementIndex,
    latestPersistedSuiteIndex,
    latestReviewIndex,
  };
}

export function getLatestArtifactDocumentItems(
  items: ChatItem[]
): ArtifactDocumentItem[] {
  const indexes = getLatestArtifactDocumentIndexes(items);
  const documents: ArtifactDocumentItem[] = [];

  const requirement = items[indexes.latestRequirementIndex];
  if (requirement?.kind === "text") {
    documents.push({
      kind: "requirement",
      index: indexes.latestRequirementIndex,
      item: requirement,
    });
  }

  const suite = items[indexes.latestPersistedSuiteIndex];
  if (suite?.kind === "casesText") {
    documents.push({
      kind: "suite",
      index: indexes.latestPersistedSuiteIndex,
      item: suite,
    });
  }

  const review = items[indexes.latestReviewIndex];
  if (review?.kind === "review") {
    documents.push({
      kind: "review",
      index: indexes.latestReviewIndex,
      item: review,
    });
  }

  return documents.sort((a, b) => a.index - b.index);
}

export function getLatestArtifactDocumentIndexesToHide(
  items: ChatItem[]
): number[] {
  return getLatestArtifactDocumentItems(items).map((document) => document.index);
}

function getRequirementVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (artifact?.refinedRequirement as { version?: number } | undefined)?.version;
}

function getSuiteBasedOnRequirementVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (
    artifact?.testSuite as { basedOnRequirementVersion?: number } | undefined
  )?.basedOnRequirementVersion;
}

function getReviewBasedOnRequirementVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (
    artifact?.reviewResult as { basedOnRequirementVersion?: number } | undefined
  )?.basedOnRequirementVersion;
}

function getReviewBasedOnSuiteVersion(
  artifact: SessionArtifact | null | undefined
): number | undefined {
  return (
    artifact?.reviewResult as { basedOnSuiteVersion?: number } | undefined
  )?.basedOnSuiteVersion;
}

export function buildRequirementProvenanceLabel(
  artifact: SessionArtifact | null | undefined
): string {
  return (
    joinProvenanceParts([
      "Technical Requirement",
      formatArtifactVersion("Requirement", getRequirementVersion(artifact)),
    ]) || "Technical Requirement"
  );
}

export function buildSuiteProvenanceLabel(
  artifact: SessionArtifact | null | undefined
): string {
  return (
    joinProvenanceParts([
      formatArtifactVersion("Test Suite", artifact?.testSuite?.version),
      getSuiteBasedOnRequirementVersion(artifact)
        ? `Based on Requirement v${getSuiteBasedOnRequirementVersion(artifact)}`
        : null,
    ]) || "Test Suite"
  );
}

export function buildReviewProvenanceLabel(
  artifact: SessionArtifact | null | undefined
): string {
  const suiteVersion = getReviewBasedOnSuiteVersion(artifact);
  const requirementVersion = getReviewBasedOnRequirementVersion(artifact);
  const basedOn =
    suiteVersion && requirementVersion
      ? `Based on Test Suite v${suiteVersion} and Requirement v${requirementVersion}`
      : suiteVersion
        ? `Based on Test Suite v${suiteVersion}`
        : requirementVersion
          ? `Based on Requirement v${requirementVersion}`
          : null;

  return (
    joinProvenanceParts([
      "Review Result",
      basedOn,
    ]) || "Review Result"
  );
}
