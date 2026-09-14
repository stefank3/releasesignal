export type PublicReviewCandidate = {
  id: string;
  quote: string;
  authorName: string;
  authorRole?: string;
  company?: string;
  approvedForPublication: boolean;
};

// Commit real feedback only when publication approval is already on record.
// Pending or unapproved feedback must never enter this public repository.
// Approval must cover the exact quote and every included attribution field;
// keep consent evidence outside this public repository. A false approval state
// is a fail-closed safeguard, not a staging area. No approved feedback exists yet.
export const publicReviewCandidates: readonly PublicReviewCandidate[] = [];

export function getApprovedPublicReviews(
  candidates: readonly PublicReviewCandidate[] = publicReviewCandidates,
): PublicReviewCandidate[] {
  // Fail closed: truthy values are not explicit publication approval.
  return candidates.filter((review) => review.approvedForPublication === true);
}
