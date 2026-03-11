// lib/artifacts/artifact.types.ts
// Central artifact model for Release Signal workflow.
// M10 goal: keep Strategy -> Cases -> Review state consistent and typed.

export type RefinedRequirement = {
  objective?: string;
  context?: string;
  inScope?: string[];
  outOfScope?: string[];
  integrations?: string[];
  riskFocus?: string[];
  acceptanceCriteria?: string[];
};

export type TestCaseItem = {
  id: string;
  title: string;
  priority?: "High" | "Medium" | "Low";
  type?: string;
  preconditions?: string[];
  steps?: string[];
  expectedResult?: string;
};

export type ReviewBreakdown = {
  requirementsCoverage?: number;
  riskCoverage?: number;
  negativeCoverage?: number;
  edgeCoverage?: number;
  integrationCoverage?: number;
};

export type ReviewResult = {
  score?: number;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  recommendations?: string[];
  breakdown?: ReviewBreakdown;
};

export type SessionArtifact = {
  refinedRequirement?: RefinedRequirement;
  testSuite?: TestCaseItem[];
  reviewResult?: ReviewResult;
  suiteVersion?: number;
};