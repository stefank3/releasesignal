// lib/server/chat/reviewGapPromptContext.ts
//
// Purpose:
// Build bounded prompt context from the current persisted review artifact.
//
// HARD RULES:
// - no scoring changes
// - no parser changes
// - no artifact contract changes
// - only current-suite review gaps may be used as generation context

import {
  getReviewSuiteVersion,
  type PersistedReviewResult,
  type SessionArtifact,
} from "@/lib/chat/artifact";

const MAX_RISK_GAPS = 10;
const MAX_IMPROVEMENTS = 6;

function cleanList(values: string[] | undefined, limit: number): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function getCurrentSuiteVersion(artifact: SessionArtifact | null): number | null {
  const version = artifact?.testSuite?.version;

  return typeof version === "number" && Number.isFinite(version) && version > 0
    ? Math.round(version)
    : null;
}

function getCurrentReview(
  artifact: SessionArtifact | null
): PersistedReviewResult | null {
  const review = artifact?.reviewResult;

  if (!review || typeof review !== "object") return null;
  if (typeof review.score !== "number") return null;
  if (!Array.isArray(review.riskGaps)) return null;
  if (!Array.isArray(review.improvements)) return null;

  return review;
}

export function buildCurrentReviewGapPromptContext(
  artifact: SessionArtifact | null
): string | null {
  const review = getCurrentReview(artifact);
  if (!review) return null;

  const suiteVersion = getCurrentSuiteVersion(artifact);
  const reviewSuiteVersion = getReviewSuiteVersion(review);

  // Avoid using unversioned or stale reviews as if they were current gap truth.
  if (!suiteVersion || !reviewSuiteVersion || suiteVersion !== reviewSuiteVersion) {
    return null;
  }

  const riskGaps = cleanList(review.riskGaps, MAX_RISK_GAPS);
  const improvements = cleanList(review.improvements, MAX_IMPROVEMENTS);

  if (!riskGaps.length && !improvements.length) return null;

  const lines: string[] = [
    "CURRENT REVIEW GAP CONTEXT:",
    `Review is based on the current persisted suite v${suiteVersion}.`,
  ];

  if (riskGaps.length) {
    lines.push("");
    lines.push("Current risk gaps to target first:");
    for (const gap of riskGaps) {
      lines.push(`- ${gap}`);
    }
  }

  if (improvements.length) {
    lines.push("");
    lines.push("Current review improvements:");
    for (const improvement of improvements) {
      lines.push(`- ${improvement}`);
    }
  }

  lines.push("");
  lines.push("Gap-targeting rules:");
  lines.push(
    "- Target listed uncovered and partially covered requirement units before generic expansion."
  );
  lines.push(
    "- Use explicit wording from the named gap or requirement unit where it makes the test more reviewable."
  );
  lines.push(
    "- Add traceability in parser-compatible Tags and Notes fields when helpful."
  );
  lines.push(
    "- Example: Notes: Covers: Acceptance criterion 3 part 3 - appropriate validation messages are shown."
  );

  return lines.join("\n");
}
