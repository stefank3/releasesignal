// lib/server/chat/reviewExplanationService.ts
// M13 narrow product wiring:
// - optional, non-authoritative review explanation service
// - derives explanation only from deterministic review output
// - fails open: explanation failure must never fail review flow
// - never mutates score, verdict, artifact truth, or release health

import { runReviewExplanation } from "@/lib/ai";
import {
  artifactToContextText,
  type SessionArtifact,
} from "@/lib/chat/artifact";

export type ReviewExplanationSource = {
  score: number;
  verdict: string;
  riskGaps: string[];
  improvements: string[];
};

function buildReviewSummaryText(args: ReviewExplanationSource): string {
  const summaryParts: string[] = [
    `Score: ${args.score}`,
    `Verdict: ${args.verdict}`,
  ];

  if (args.riskGaps.length > 0) {
    summaryParts.push(
      `Risk gaps identified: ${args.riskGaps.length}.`
    );
  }

  if (args.improvements.length > 0) {
    summaryParts.push(
      `Improvement directions identified: ${args.improvements.length}.`
    );
  }

  return summaryParts.join(" ");
}

/**
 * Generate an optional explanation for an already-authoritative deterministic review.
 *
 * Hard boundary:
 * - this service must never change review truth
 * - this service must never block the deterministic review path
 * - explanation output is reply-only supplemental text
 */
export async function buildOptionalReviewExplanation(args: {
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  review: ReviewExplanationSource;
}): Promise<string | null> {
  const verdict = String(args.review.verdict ?? "").trim();
  const riskGaps = Array.isArray(args.review.riskGaps)
    ? args.review.riskGaps.filter(Boolean)
    : [];
  const improvements = Array.isArray(args.review.improvements)
    ? args.review.improvements.filter(Boolean)
    : [];

  if (!Number.isFinite(args.review.score) || !verdict) {
    return null;
  }

  try {
    const artifactContextText = args.sessionArtifact
      ? artifactToContextText(args.sessionArtifact)
      : null;

    const result = await runReviewExplanation({
      sessionId: args.sessionId,
      reviewScore: args.review.score,
      verdict,
      riskGaps,
      improvements,
      reviewSummaryText: buildReviewSummaryText({
        score: args.review.score,
        verdict,
        riskGaps,
        improvements,
      }),
      artifactContextText,
    });

    if (!result.ok) {
      return null;
    }

    const explanationText = String(
      result.output.explanationText ?? ""
    ).trim();

    return explanationText || null;
  } catch {
    // M13 fail-open rule:
    // explanation is supplemental only and must never fail the review flow.
    return null;
  }
}