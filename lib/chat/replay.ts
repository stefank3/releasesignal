// lib/chat/replay.ts

import { buildFallbackCoachSuggestions } from "./suggestions";

export type CoachSuggestions = {
  groups: { label: string; type: "single" | "multi"; options: string[] }[];
  template: string;
};

/**
 * Your route.ts currently tries to detect "clarifications" on replay by string scanning
 * and then attaching fallback suggestions.
 *
 * Keep the behavior deterministic and in one place.
 */
export function buildReplaySuggestions(args: { wantCases: boolean; executionMode: "coach" | "review"; storedAssistantContent: string }): CoachSuggestions | null {
  const { wantCases, executionMode, storedAssistantContent } = args;

  if (wantCases) return null;
  if (executionMode !== "coach") return null;

  const hasClarificationMarker = storedAssistantContent.includes("If you want more detailed tests, answer:");
  return hasClarificationMarker ? buildFallbackCoachSuggestions() : null;
}