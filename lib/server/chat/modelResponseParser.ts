// lib/server/chat/modelResponseParser.ts
// M10 extraction:
// Centralize model response parsing and one-pass repair logic for
// coach and review modes so route.ts stays focused on orchestration.

import { extractJsonObject } from "@/lib/chat/json";
import { repairJsonOnce } from "@/lib/chat/repair";
import {
  isCoachResult,
  isReviewResult,
  type CoachResult,
  type ReviewResult,
} from "@/lib/framework/reviewSchema";

export async function parseReviewResponse(rawReply: string): Promise<{
  reviewObj: ReviewResult | null;
  reviewStoredJson: string | null;
  repaired: boolean;
}> {
  const tryParse = (txt: string): ReviewResult | null => {
    try {
      const parsed = JSON.parse(extractJsonObject(txt)) as unknown;
      return isReviewResult(parsed) ? (parsed as ReviewResult) : null;
    } catch {
      return null;
    }
  };

  let reviewObj = tryParse(rawReply);
  let repaired = false;

  if (!reviewObj) {
    const repairedRaw = await repairJsonOnce({ mode: "review", raw: rawReply });
    reviewObj = tryParse(repairedRaw);
    repaired = !!reviewObj;
  }

  return {
    reviewObj,
    reviewStoredJson: reviewObj ? JSON.stringify(reviewObj) : null,
    repaired,
  };
}

export async function parseCoachResponse(rawReply: string): Promise<CoachResult | null> {
  const tryParse = (txt: string): CoachResult | null => {
    try {
      const parsed = JSON.parse(extractJsonObject(txt)) as unknown;
      return isCoachResult(parsed) ? (parsed as CoachResult) : null;
    } catch {
      return null;
    }
  };

  let coachObj = tryParse(rawReply);
  if (coachObj) return coachObj;

  const repairedRaw = await repairJsonOnce({ mode: "coach", raw: rawReply });
  coachObj = tryParse(repairedRaw);

  return coachObj;
}