export type PublicReviewCandidate = {
  id: string;
  quote: string;
  authorName: string;
  authorRole?: string;
  company?: string;
  approvedForPublication: boolean;
};

// Include only real feedback intentionally curated for publication. Approval
// must cover the exact quote and every included attribution field; keep
// consent evidence outside this public module. No approved feedback exists yet.
export const publicReviewCandidates: readonly PublicReviewCandidate[] = [];

export function getApprovedPublicReviews(
  candidates: readonly PublicReviewCandidate[] = publicReviewCandidates,
): PublicReviewCandidate[] {
  // Fail closed: truthy values are not explicit publication approval.
  return candidates.filter((review) => review.approvedForPublication === true);
}
