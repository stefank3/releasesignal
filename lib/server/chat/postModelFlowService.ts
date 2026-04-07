// lib/server/chat/postModelFlowService.ts
// M10 Pass 11
// Centralize post-model orchestration so route.ts does not coordinate
// review / coach / cases flow branches inline.
//
// SURGICAL CHANGE:
// - route.ts delegates post-OpenAI flow branching here
// - preserves existing coach / review / cases services
// - keeps billing decision inputs stable
//
// M11 CHANGE:
// - thread structured cases telemetry classification back to route.ts
// - thread structured review telemetry classification back to route.ts
// - do NOT emit telemetry here yet
// - route.ts remains the place that adds request/session/token context
//
// M12 Step 5 CHANGE:
// - preserve deterministic cases-flow outcome propagation
// - keep unchanged / duplicate-aware suite results explicit
// - avoid hidden branching at route boundary
// - keep suite diff-aware outcome intact for route/persist layers
//
// M12 Step 6 CHANGE:
// - propagate deterministic suite analysis and workflow guidance upward
// - keep cases-mode response/store flow aligned with casesFlow output
//
// M12 Step 7 CHANGE:
// - pass artifact context into review flow for design ↔ review consistency tracking
//
// BUG FIX (M12.8):
// - ingest standalone review artifacts before deterministic review runs
// - review mode must convert explicit pasted requirement/suite input into
//   persisted artifact state first, then review against artifacts only
//
// M12.9 Phase 2 CHANGE:
// - thread workflow action context into cases flow
// - allow next-batch execution to diverge from generic generate-tests flow
// - keep branching explicit and artifact-driven
//
// M12.13 CHANGE:
// - add explicit execution-intelligence post-model branch
// - parse execution-shaped input only when workflow action requests it
// - return structured execution result upward for persistence/response shaping
// - keep execution flow separate from coach/review/cases behavior

import type {
  ExecutionIntelligenceArtifact,
  SessionArtifact,
  TestSuiteArtifact,
} from "@/lib/chat/artifact";
import type { CoachResult, ReviewResult } from "@/lib/framework/reviewSchema";

import { runCoachFlow } from "@/lib/server/chat/coachFlowService";
import {
  runCasesFlow,
  type CasesFlowTelemetry,
} from "@/lib/server/chat/casesFlowService";
import { parseExecutionResponse } from "@/lib/server/chat/modelResponseParser";
import type { SuiteAnalysis } from "@/lib/server/chat/suiteAnalysisService";
import type { WorkflowGuidance } from "@/lib/server/chat/workflowAssistantService";
import {
  runReviewFlow,
  type ReviewFlowTelemetry,
} from "@/lib/server/chat/reviewFlowService";
import { applyStandaloneReviewArtifactPatch } from "@/lib/server/chat/artifactUpdateService";

type PostModelWorkflowAction =
  | "generate_tests_from_requirement"
  | "generate_next_batch_of_tests"
  | "review_test_suite"
  | "refine_requirement"
  | "regenerate_suite"
  | "ingest_execution_results"
  | null;

function buildExecutionReplyText(
  execution: ExecutionIntelligenceArtifact
): string {
  const summary = execution.summary;

  return [
    `Execution results recorded from ${execution.source}.`,
    `Suite status: ${execution.suiteStatus}.`,
    `Observed cases: ${summary.total}.`,
    `Passed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}, Blocked: ${summary.blocked}, Timed out: ${summary.timedOut}, Unknown: ${summary.unknown}.`,
    typeof execution.suiteVersion === "number"
      ? `Linked suite version: v${execution.suiteVersion}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function runPostModelFlow(args: {
  rawReply: string;
  executionMode: "coach" | "review";
  wantCases: boolean;
  sessionId: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  message: string;
  guidedAnswer: boolean;
  weakInput: boolean;
  explicitRegenerationRequest: boolean;
  workflowAction?: PostModelWorkflowAction;
}): Promise<{
  coachParsed: CoachResult | null;
  replyTextForUser: string | null;
  reviewObj: ReviewResult | null;
  reviewRepaired: boolean;
  executionObj: ExecutionIntelligenceArtifact | null;
  executionRepaired: boolean;
  assistantContentToStore: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
  testSuiteAddedCount: number;
  casesFlowTelemetry: CasesFlowTelemetry | null;
  reviewFlowTelemetry: ReviewFlowTelemetry | null;
  suiteAnalysis: SuiteAnalysis | null;
  workflowGuidance: WorkflowGuidance | null;
}> {
  let coachParsed: CoachResult | null = null;
  let replyTextForUser: string | null = null;

  let reviewObj: ReviewResult | null = null;
  let reviewRepaired = false;

  let executionObj: ExecutionIntelligenceArtifact | null = null;
  let executionRepaired = false;

  let assistantContentToStore: string | null = null;

  let sessionArtifact = args.sessionArtifact;
  let artifactUpdatedAtIso = args.artifactUpdatedAtIso;

  let nextTestSuiteArtifact: TestSuiteArtifact | null = null;
  let testSuiteAddedCount = 0;

  let casesFlowTelemetry: CasesFlowTelemetry | null = null;
  let reviewFlowTelemetry: ReviewFlowTelemetry | null = null;

  let suiteAnalysis: SuiteAnalysis | null = null;
  let workflowGuidance: WorkflowGuidance | null = null;

  const wantsExecutionIntelligence =
    args.workflowAction === "ingest_execution_results";

  if (args.executionMode === "review") {
    const standaloneReviewPatch = await applyStandaloneReviewArtifactPatch({
      sessionId: args.sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      message: args.message,
      reviewMode: true,
    });

    sessionArtifact = standaloneReviewPatch.sessionArtifact;
    artifactUpdatedAtIso = standaloneReviewPatch.artifactUpdatedAtIso;

    const reviewFlow = await runReviewFlow({
      rawReply: args.rawReply,
      sessionArtifact,
    });

    reviewObj = reviewFlow.reviewObj;
    reviewRepaired = reviewFlow.reviewRepaired;
    assistantContentToStore = reviewFlow.assistantContentToStore;
    reviewFlowTelemetry = reviewFlow.reviewTelemetry;
  }

  if (
    args.executionMode === "coach" &&
    !args.wantCases &&
    wantsExecutionIntelligence
  ) {
    const executionParse = await parseExecutionResponse(args.rawReply);

    executionObj = executionParse.executionObj;
    executionRepaired = executionParse.repaired;

    if (executionObj) {
      replyTextForUser = buildExecutionReplyText(executionObj);
      assistantContentToStore = replyTextForUser;
    } else {
      replyTextForUser =
        "Execution input could not be normalized into a valid execution artifact.";
      assistantContentToStore = replyTextForUser;
    }
  }

  if (
    args.executionMode === "coach" &&
    !args.wantCases &&
    !wantsExecutionIntelligence
  ) {
    const coachFlow = await runCoachFlow({
      rawReply: args.rawReply,
      sessionId: args.sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      message: args.message,
      guidedAnswer: args.guidedAnswer,
      weakInput: args.weakInput,
      explicitRegenerationRequest: args.explicitRegenerationRequest,
    });

    coachParsed = coachFlow.coachParsed;
    replyTextForUser = coachFlow.replyTextForUser;
    sessionArtifact = coachFlow.sessionArtifact;
    artifactUpdatedAtIso = coachFlow.artifactUpdatedAtIso;
  }

  if (args.wantCases) {
    const casesWorkflowAction =
      args.workflowAction === "generate_tests_from_requirement" ||
      args.workflowAction === "generate_next_batch_of_tests" ||
      args.workflowAction === "regenerate_suite"
        ? args.workflowAction
        : null;

    const casesFlow = await runCasesFlow({
      rawReply: args.rawReply,
      sessionArtifact,
      explicitRegenerationRequest: args.explicitRegenerationRequest,
      workflowAction: casesWorkflowAction,
    });

    replyTextForUser = casesFlow.replyTextForUser;
    nextTestSuiteArtifact = casesFlow.nextTestSuiteArtifact;
    testSuiteAddedCount = casesFlow.testSuiteAddedCount;
    casesFlowTelemetry = casesFlow.telemetry;
    suiteAnalysis = casesFlow.analysis;
    workflowGuidance = casesFlow.guidance;
    coachParsed = null;
    assistantContentToStore = casesFlow.replyTextForUser;
  }

  return {
    coachParsed,
    replyTextForUser,
    reviewObj,
    reviewRepaired,
    executionObj,
    executionRepaired,
    assistantContentToStore:
      assistantContentToStore ?? replyTextForUser ?? "No reply returned",
    sessionArtifact,
    artifactUpdatedAtIso,
    nextTestSuiteArtifact,
    testSuiteAddedCount,
    casesFlowTelemetry,
    reviewFlowTelemetry,
    suiteAnalysis,
    workflowGuidance,
  };
}