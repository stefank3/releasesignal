// lib/chat/types.ts

export type ExecutionMode = "coach" | "review";

export type ClientMode = "coach" | "review" | "cases";

export type RateMeta = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

export type ChatBody = {
  message?: string;
  mode?: ClientMode;
  sessionId?: string;
  title?: string;
  sessionClientId?: string;
};

export type CoachSuggestions = {
  groups: { label: string; type: "single" | "multi"; options: string[] }[];
  template: string;
};

export type RefinedRequirement = {
  objective?: string;
  context?: string;
  inScope?: string[];
  outOfScope?: string[];
  integrations?: string[];
  riskFocus?: string[];
  acceptanceCriteria?: string[];
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;
};