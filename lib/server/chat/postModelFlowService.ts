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

import type { SessionArtifact, TestSuiteArtifact } from "@/lib/chat/artifact";
import type { CoachResult, ReviewResult } from "@/lib/framework/reviewSchema";

import { runCoachFlow } from "@/lib/server/chat/coachFlowService";
import {
  runCasesFlow,
  type CasesFlowTelemetry,
} from "@/lib/server/chat/casesFlowService";
import {
  runReviewFlow,
  type ReviewFlowTelemetry,
} from "@/lib/server/chat/reviewFlowService";

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
}): Promise<{
  coachParsed: CoachResult | null;
  replyTextForUser: string | null;
  reviewObj: ReviewResult | null;
  reviewRepaired: boolean;
  assistantContentToStore: string;
  sessionArtifact: SessionArtifact | null;
  artifactUpdatedAtIso: string | null;
  nextTestSuiteArtifact: TestSuiteArtifact | null;
  testSuiteAddedCount: number;

  // M11:
  // Structured cases telemetry classification returned to the route,
  // where full operational context is available for persistence.
  casesFlowTelemetry: CasesFlowTelemetry | null;

  // M11:
  // Structured review telemetry classification returned to the route,
  // where full operational context is available for persistence.
  reviewFlowTelemetry: ReviewFlowTelemetry | null;
}> {
  let coachParsed: CoachResult | null = null;
  let replyTextForUser: string | null = null;

  let reviewObj: ReviewResult | null = null;
  let reviewRepaired = false;
  let assistantContentToStore: string | null = null;

  let sessionArtifact = args.sessionArtifact;
  let artifactUpdatedAtIso = args.artifactUpdatedAtIso;

  let nextTestSuiteArtifact: TestSuiteArtifact | null = null;
  let testSuiteAddedCount = 0;

  // M11:
  // Default to null unless the cases flow produces a structured telemetry result.
  let casesFlowTelemetry: CasesFlowTelemetry | null = null;

  // M11:
  // Default to null unless the review flow produces a structured telemetry result.
  let reviewFlowTelemetry: ReviewFlowTelemetry | null = null;

  if (args.executionMode === "review") {
    const reviewFlow = await runReviewFlow({
      rawReply: args.rawReply,
    });

    reviewObj = reviewFlow.reviewObj;
    reviewRepaired = reviewFlow.reviewRepaired;
    assistantContentToStore = reviewFlow.assistantContentToStore;

    // M11:
    // Forward structured review telemetry classification to the route.
    reviewFlowTelemetry = reviewFlow.reviewTelemetry;
  }

  if (args.executionMode === "coach" && !args.wantCases) {
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
    const casesFlow = await runCasesFlow({
      rawReply: args.rawReply,
      sessionArtifact,
      explicitRegenerationRequest: args.explicitRegenerationRequest,
    });

    replyTextForUser = casesFlow.replyTextForUser;
    nextTestSuiteArtifact = casesFlow.nextTestSuiteArtifact;
    testSuiteAddedCount = casesFlow.testSuiteAddedCount;

    // M12 Step 5:
    // Preserve the exact structured outcome from the cases flow so the route
    // can decide whether this was a real suite evolution or an unchanged result.
    casesFlowTelemetry = casesFlow.telemetry;

    // Cases mode should not return coach-parsed output.
    coachParsed = null;

    // Cases mode storage must remain aligned with the deterministic suite-flow
    // output, including unchanged / duplicate-aware messaging.
    assistantContentToStore = casesFlow.replyTextForUser;
  }

  return {
    coachParsed,
    replyTextForUser,
    reviewObj,
    reviewRepaired,
    assistantContentToStore:
      assistantContentToStore ?? replyTextForUser ?? "No reply returned",
    sessionArtifact,
    artifactUpdatedAtIso,
    nextTestSuiteArtifact,
    testSuiteAddedCount,
    casesFlowTelemetry,
    reviewFlowTelemetry,
  };
}