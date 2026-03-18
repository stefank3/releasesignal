// lib/server/chat/workflowAssistantService.ts
// M12 Step 6 — Workflow Recommendation Engine
//
// Purpose:
// Convert deterministic suite analysis into structured workflow guidance.
//
// Rules:
// - deterministic only
// - no UI logic
// - no model calls
// - guidance must be explainable from artifact state

import type { SuiteAnalysis } from "@/lib/server/chat/suiteAnalysisService";

export type WorkflowGuidance = {
  recommendedAction:
    | "generate_more_cases"
    | "review_suite"
    | "refine_requirement"
    | "ready_for_execution";
  message: string;
  rationale: string;
};

export function buildWorkflowGuidance(
  analysis: SuiteAnalysis | null
): WorkflowGuidance {
  if (!analysis) {
    return {
      recommendedAction: "generate_more_cases",
      message: "Start by generating an initial test suite.",
      rationale: "No suite analysis is available yet.",
    };
  }

  if (analysis.warnings.some((w) => /empty test suite/i.test(w))) {
    return {
      recommendedAction: "generate_more_cases",
      message: "Generate the first set of test cases.",
      rationale: "The current suite is empty.",
    };
  }

  if (analysis.coverageLevel === "low") {
    return {
      recommendedAction: "generate_more_cases",
      message: "Generate more test cases to improve coverage.",
      rationale:
        "The current suite size is still too small for confident coverage.",
    };
  }

  if (analysis.duplicateRisk !== "low") {
    return {
      recommendedAction: "review_suite",
      message: "Review the suite and resolve duplicate or overlapping cases.",
      rationale:
        "Duplicate risk is elevated, which reduces suite clarity and signal quality.",
    };
  }

  if (analysis.missingAreas.length > 0) {
    return {
      recommendedAction: "generate_more_cases",
      message: "Generate additional cases for missing scenario types.",
      rationale: analysis.missingAreas.join(" | "),
    };
  }

  if (analysis.coverageLevel === "high" && analysis.warnings.length === 0) {
    return {
      recommendedAction: "ready_for_execution",
      message: "The suite looks ready for execution and review.",
      rationale:
        "Coverage is strong, duplicate risk is low, and no major warnings were detected.",
    };
  }

  return {
    recommendedAction: "review_suite",
    message: "Review the suite before moving forward.",
    rationale:
      "The suite is usable, but a manual QA review is the safest next step.",
  };
}