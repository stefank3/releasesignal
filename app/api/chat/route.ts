// app/api/chat/route.ts
import { randomUUID } from "crypto";

import { log } from "@/lib/logger";

import { type CoachResult, type ReviewResult } from "@/lib/framework/reviewSchema";

import { recordChatMetric, type ChatMetricMode } from "@/lib/metrics/chatMetrics";

import { type RateMeta } from "@/lib/chat/chatTypes";

import { emitTelemetryEvent } from "@/lib/server/telemetry/telemetryService";
import type { CasesFlowTelemetry } from "@/lib/server/chat/casesFlowService";

import { parseExecutionResponse } from "@/lib/server/chat/modelResponseParser";

import {
  type ExecutionIntelligenceArtifact,
  type SessionArtifact,
  type TestSuiteArtifact,
  getTestSuite,
  isGuidedClarificationAnswer,
} from "@/lib/chat/artifact";



import { loadOrCreateSession } from "@/lib/chat/sessionStore";
import {
  persistUserMessageIdempotent,
  persistAssistantWithBillingTx,
  InsufficientCreditsError,
} from "@/lib/chat/persist";

import { hasMeaningfulRefinedRequirement } from "@/lib/server/chat/coachFormatting";

import { buildPromptPayload } from "@/lib/server/chat/promptBuilder";
import { tryReplayExistingAssistant } from "@/lib/server/chat/replayService";

import {
  buildAuthExpiredResponse,
  buildChatSuccessResponse,
  buildInsufficientCreditsBillingResponse,
  buildServerErrorResponse,
} from "@/lib/server/chat/responseBuilder";

import {
  ensureBillingPreconditions,
  enforceRateLimit,
  parseAndValidateChatRequest,
  requireAuthenticatedUser,
  requireReviewAccess,
} from "@/lib/server/chat/requestGuards";

import { executeChatCompletion } from "@/lib/server/chat/openaiService";
import { getOpenAITraceFromError } from "@/lib/openai";

import {
  applyGuidedArtifactPatch,
  persistExecutionArtifact,
  persistGeneratedSuiteArtifact,
  persistReviewArtifact,
  persistReleaseHealthArtifact,
  type RequirementRefinedTelemetry,
} from "@/lib/server/chat/artifactUpdateService";

import { buildReleaseHealthArtifact } from "@/lib/server/chat/releaseHealthService";

import { runPostModelFlow } from "@/lib/server/chat/postModelFlowService";

import {
  buildReviewFlowResponse,
  type ReviewFlowTelemetry,
} from "@/lib/server/chat/reviewFlowService";

import {
  buildNextBatchBaseline,
  validateNextBatchPrerequisites,
} from "@/lib/server/chat/testSuiteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CHANGE (M8.7):
 * Explicit user escape hatch for "start fresh" behavior.
 */
function isExplicitRegenerationRequest(message: string): boolean {
  return /\b(regenerate|restart|start over|from scratch|fresh start|ignore previous|ignore the previous|discard previous|replace the suite|new suite)\b/i.test(
    message
  );
}

/*
---------------------------------------------------------
M12.9 / M12.13 WORKFLOW ACTIONS
---------------------------------------------------------
Artifact-driven workspace actions are explicit request contracts.
*/
type WorkflowAction =
  | "generate_tests_from_requirement"
  | "generate_next_batch_of_tests"
  | "review_test_suite"
  | "refine_requirement"
  | "regenerate_suite"
  | "ingest_execution_results";

function getWorkflowAction(body: unknown): WorkflowAction | null {
  if (!body || typeof body !== "object") return null;

  const candidate = (body as { action?: unknown }).action;

  if (
    candidate === "generate_tests_from_requirement" ||
    candidate === "generate_next_batch_of_tests" ||
    candidate === "review_test_suite" ||
    candidate === "refine_requirement" ||
    candidate === "regenerate_suite" ||
    candidate === "ingest_execution_results"
  ) {
    return candidate;
  }

  return null;
}

function hasPersistedTestSuiteArtifact(
  artifact: SessionArtifact | null
): boolean {
  return !!(
    artifact?.testSuite &&
    Array.isArray(artifact.testSuite.cases) &&
    artifact.testSuite.cases.length > 0
  );
}

function getRefinedRequirementText(
  artifact: SessionArtifact | null
): string | null {
  const refined = artifact?.refinedRequirement;
  if (!refined) return null;

  const lines: string[] = [];

  const pushSection = (title: string, value: unknown) => {
    if (!value) return;

    if (Array.isArray(value)) {
      const items = value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean);

      if (!items.length) return;

      lines.push(`${title}:`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
      lines.push("");
      return;
    }

    const text = String(value).trim();
    if (!text) return;

    lines.push(`${title}:`);
    lines.push(text);
    lines.push("");
  };

  pushSection("Objective", refined.objective);
  pushSection("Functional Scope", refined.functionalScope);
  pushSection("Business Rules", refined.businessRules);
  pushSection("Acceptance Criteria", refined.acceptanceCriteria);
  pushSection("Non-Functional Constraints", refined.nonFunctionalConstraints);
  pushSection("Test Strategy Hooks", refined.testStrategyHooks);
  pushSection("Minimal Repro Scenarios", refined.minimalReproScenarios);

  const knownKeys = new Set([
    "objective",
    "functionalScope",
    "businessRules",
    "acceptanceCriteria",
    "nonFunctionalConstraints",
    "testStrategyHooks",
    "minimalReproScenarios",
  ]);

  const entries = Object.entries(refined as Record<string, unknown>).filter(
    ([key, value]) => !knownKeys.has(key) && value != null
  );

  for (const [key, value] of entries) {
    const label = key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase());

    pushSection(label, value);
  }

  const text = lines.join("\n").trim();
  return text || null;
}

function buildWorkflowActionMessage(args: {
  workflowAction: WorkflowAction;
  sessionArtifact: SessionArtifact | null;
}): string {
  if (args.workflowAction === "review_test_suite") {
    return "Review the persisted test suite artifact for this session.";
  }

  if (args.workflowAction === "generate_tests_from_requirement") {
    return "Generate a test suite from the persisted refined requirement artifact for this session.";
  }

  if (args.workflowAction === "refine_requirement") {
    const requirementText =
      getRefinedRequirementText(args.sessionArtifact) ??
      "No persisted refined requirement artifact available.";

    return [
      "Refine the persisted refined requirement artifact for this session.",
      "",
      "Use ONLY the persisted refined requirement artifact as the source of truth.",
      "Improve clarity, structure, completeness, edge coverage, and testability.",
      "Do NOT change the product intent.",
      "Do NOT invent new scope unless it is clearly implied by the existing artifact.",
      "Return a refined technical requirement in the locked requirement format.",
      "",
      "PERSISTED REFINED REQUIREMENT:",
      requirementText,
    ].join("\n");
  }

  if (args.workflowAction === "regenerate_suite") {
    const prerequisite = validateNextBatchPrerequisites({
      requirementText: getRefinedRequirementText(args.sessionArtifact),
      existingSuite: args.sessionArtifact?.testSuite ?? null,
    });

    if (!prerequisite.ok) {
      return "Improve and regenerate the persisted test suite from the persisted artifacts for this session.";
    }

    const baseline = buildNextBatchBaseline({
      requirementText: prerequisite.requirementText,
      existingSuite: prerequisite.existingSuite,
    });

    const existingSuiteSummary =
      baseline.suiteSummary.trim() || "No existing test case headers available.";

    return [
      "Improve and regenerate the persisted test suite from the persisted artifacts for this session.",
      "",
      "Use ONLY the persisted refined requirement artifact and the persisted existing test suite artifact.",
      "This is a REPLACEMENT action, not an append action.",
      "Rewrite the suite as a cleaner, stronger replacement version.",
      "Preserve valid coverage intent, but remove overlap, duplicates, near-duplicates, and repetitive coverage.",
      "Consolidate similar tests into the strongest single test where appropriate.",
      "Prefer a tighter, cleaner suite over a larger suite.",
      "Improve weak tests by making steps clearer, expected results sharper, and coverage more purposeful.",
      "Keep meaningful positive, negative, and edge coverage, but do NOT multiply similar scenarios unnecessarily.",
      "Do NOT append a next batch.",
      "Do NOT continue numbering from the old suite.",
      "Generate a full replacement suite starting clean from TC-001.",
      "Do NOT include malformed, partial, truncated, or placeholder test cases.",
      "Every test case must include: Type, Priority, Preconditions, Test Steps, and Expected Result.",
      "Return STRICT plain-text test cases in the locked TC format only.",
      "",
      "PERSISTED REFINED REQUIREMENT:",
      baseline.requirementText,
      "",
      `EXISTING SUITE COUNT: ${baseline.existingCount}`,
      "EXISTING TEST CASE HEADERS:",
      existingSuiteSummary,
    ].join("\n");
  }

  if (args.workflowAction === "ingest_execution_results") {
    const suiteVersion = args.sessionArtifact?.testSuite?.version ?? null;

    return [
      "Normalize the provided execution-shaped input into a structured execution artifact for this session.",
      "",
      "Use ONLY explicit execution-oriented data from the provided input.",
      "Do NOT infer hidden pass/fail outcomes.",
      "Do NOT classify failure categories.",
      "Do NOT score release health.",
      "Return STRICT JSON only.",
      "",
      "Required top-level fields:",
      '- "source"',
      '- "suiteVersion"',
      '- "runId" (optional)',
      '- "runLabel" (optional)',
      '- "observedAt"',
      '- "suiteStatus"',
      '- "caseResults"',
      "",
      "Each caseResults item must include:",
      '- "caseId"',
      '- "status"',
      '- "observedAt"',
      '- "source"',
      "",
      "Optional per-case fields:",
      '- "externalCaseRef"',
      '- "externalCaseName"',
      '- "durationMs"',
      '- "errorMessage"',
      '- "rawOutcome"',
      "",
      `PERSISTED SUITE VERSION: ${
        typeof suiteVersion === "number" ? `v${suiteVersion}` : "none"
      }`,
    ].join("\n");
  }

  const prerequisite = validateNextBatchPrerequisites({
    requirementText: getRefinedRequirementText(args.sessionArtifact),
    existingSuite: args.sessionArtifact?.testSuite ?? null,
  });

  if (!prerequisite.ok) {
    return "Generate additional tests from the persisted artifacts for this session.";
  }

  const baseline = buildNextBatchBaseline({
    requirementText: prerequisite.requirementText,
    existingSuite: prerequisite.existingSuite,
  });

  const existingSuiteSummary =
    baseline.suiteSummary.trim() || "No existing test case headers available.";

  return [
    "Generate the next batch of tests from the persisted artifacts for this session.",
    "",
    "Use ONLY the persisted refined requirement artifact and the persisted existing test suite artifact.",
    "Generate only NEW tests that expand coverage for uncovered requirement areas, missing edge cases, or missing negative paths.",
    "Do NOT regenerate the full suite.",
    "Do NOT duplicate or restate existing tests.",
    "Return STRICT plain-text test cases in the locked TC format only.",
    "",
    "PERSISTED REFINED REQUIREMENT:",
    baseline.requirementText,
    "",
    `EXISTING SUITE COUNT: ${baseline.existingCount}`,
    "EXISTING TEST CASE HEADERS:",
    existingSuiteSummary,
  ].join("\n");
}

export async function POST(req: Request) {
  const inbound = req.headers.get("x-request-id");
  const requestId = inbound && inbound.length < 200 ? inbound : randomUUID();
  const startTime = Date.now();

  let auth0SubForLog: string | undefined;
  let orgId: string | undefined;
  let sessionIdForLog: string | undefined;

  let modeForMetric: ChatMetricMode = "unknown";
  let rateMeta: RateMeta | null = null;

  let sessionArtifact: SessionArtifact | null = null;
  let artifactUpdatedAtIso: string | null = null;

  let openaiModel: string | undefined;
  let openaiLatencyMs: number | undefined;
  let openaiErrorCode: string | undefined;

  const retryCount = 0;

  try {
    /*
    ---------------------------------------------------------
    AUTHENTICATION
    ---------------------------------------------------------
    */
    const authResult = await requireAuthenticatedUser({
      requestId,
      startTime,
      modeForMetric,
      recordChatMetric,
    });

    if (!authResult.ok) {
      return authResult.response;
    }

    const user = authResult.user;
    const auth0Sub = authResult.auth0Sub;
    auth0SubForLog = auth0Sub;

    const identifier = `user:${auth0Sub}`;

    /*
    ---------------------------------------------------------
    REQUEST VALIDATION
    ---------------------------------------------------------
    */
    const parsedRequest = await parseAndValidateChatRequest({
      req,
      requestId,
      startTime,
      modeForMetric,
      recordChatMetric,
      isExplicitRegenerationRequest,
    });

    if (!parsedRequest.ok) {
      return parsedRequest.response;
    }

    const {
      body,
      message,
      clientMode,
      wantCases,
      executionMode,
      weakInput,
      explicitRegenerationRequest,
    } = parsedRequest;

    const workflowAction = getWorkflowAction(body);
    const shouldBypassReplay = !!workflowAction;

    modeForMetric = clientMode;

    const guidedAnswer =
      executionMode === "coach" &&
      !wantCases &&
      isGuidedClarificationAnswer(message);

    /*
    ---------------------------------------------------------
    RBAC
    ---------------------------------------------------------
    */
    const accessResult = await requireReviewAccess({
      executionMode,
      requestId,
      auth0Sub,
      clientMode,
      startTime,
      recordChatMetric,
    });

    if (!accessResult.ok) {
      return accessResult.response;
    }

    /*
    ---------------------------------------------------------
    BILLING PRECHECK
    ---------------------------------------------------------
    */
    const billingResult = await ensureBillingPreconditions({
      auth0Sub,
      user,
      requestId,
      clientMode,
      startTime,
      recordChatMetric,
    });

    if (!billingResult.ok) {
      return billingResult.response;
    }

    orgId = billingResult.orgId;
    const orgState = billingResult.orgState;

    /*
    ---------------------------------------------------------
    RATE LIMIT
    ---------------------------------------------------------
    */
    const rateLimitResult = await enforceRateLimit({
      identifier,
      requestId,
      auth0Sub,
      orgId,
      clientMode,
      startTime,
      recordChatMetric,
    });

    rateMeta = rateLimitResult.rateMeta;

    if (!rateLimitResult.ok) {
      return rateLimitResult.response;
    }

    /*
    ---------------------------------------------------------
    SESSION LOAD
    ---------------------------------------------------------
    */
    const sessionState = await loadOrCreateSession({
      auth0Sub,
      requestId,
      body,
      clientMode,
      rateMeta,
    });

    if (!sessionState.ok) {
      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 409,
        latencyMs: Date.now() - startTime,
      });

      return sessionState.response;
    }

    const sessionId = sessionState.sessionId;
    sessionIdForLog = sessionId;

    sessionArtifact = sessionState.sessionArtifact;
    artifactUpdatedAtIso = sessionState.artifactUpdatedAtIso;

    const sessionLifecycle = sessionState.sessionLifecycle;

    log("info", {
      event: "chat_start",
      requestId,
      auth0Sub,
      orgId,
      sessionId,
      mode: clientMode,
      meta: {
        messageChars: message.length,
        weakInput,
        clientMode,
        guidedAnswer,
        explicitRegenerationRequest,
        hasArtifact: !!sessionArtifact,
        hasTestSuite: !!getTestSuite(sessionArtifact),
        workflowAction,
        replayBypassed: shouldBypassReplay,
      },
    });

    await emitTelemetryEvent({
      eventType: sessionLifecycle,
      auth0Sub,
      organizationId: orgId,
      sessionId,
      workflowStage: "session",
      status: "success",
      metadataJson: {
        clientMode,
        hasArtifact: !!sessionArtifact,
        hasTestSuite: !!getTestSuite(sessionArtifact),
        workflowAction,
        replayBypassed: shouldBypassReplay,
      },
    });

    /*
    ---------------------------------------------------------
    REPLAY
    ---------------------------------------------------------
    Explicit workflow actions must bypass replay so persisted-action requests
    execute against current artifact state instead of returning cached assistant
    text from a previous turn.
    */
    if (!shouldBypassReplay) {
      const replay = await tryReplayExistingAssistant({
        auth0Sub,
        sessionId,
        requestId,
        clientMode,
        executionMode,
        rateMeta,
        sessionArtifact,
        artifactUpdatedAtIso,
      });

      sessionArtifact = replay.sessionArtifact;
      artifactUpdatedAtIso = replay.artifactUpdatedAtIso;

      if (replay.hit) {
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 200,
          latencyMs: Date.now() - startTime,
        });

        return replay.response;
      }
    }

    /*
    ---------------------------------------------------------
    M12.9 / M12.13 WORKFLOW ACTIONS
    ---------------------------------------------------------
    Artifact-driven workspace actions bypass freeform prompt handling.
    They resolve from persisted artifact state only.
    */
    if (workflowAction) {
      if (
        (workflowAction === "generate_tests_from_requirement" ||
          workflowAction === "refine_requirement") &&
        !hasMeaningfulRefinedRequirement(sessionArtifact)
      ) {
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 400,
          latencyMs: Date.now() - startTime,
        });

        return buildServerErrorResponse({
          requestId,
          errorMessage:
            workflowAction === "refine_requirement"
              ? "Refine Requirement action requires a persisted refined requirement artifact."
              : "Generate Tests action requires a persisted refined requirement artifact.",
          rateMeta,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

      if (workflowAction === "generate_next_batch_of_tests") {
        const nextBatchPrerequisite = validateNextBatchPrerequisites({
          requirementText: getRefinedRequirementText(sessionArtifact),
          existingSuite: sessionArtifact?.testSuite ?? null,
        });

        if (!nextBatchPrerequisite.ok) {
          await recordChatMetric({
            nowMs: Date.now(),
            mode: modeForMetric,
            status: 400,
            latencyMs: Date.now() - startTime,
          });

          return buildServerErrorResponse({
            requestId,
            errorMessage: nextBatchPrerequisite.message,
            rateMeta,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          });
        }
      }

      if (
        workflowAction === "review_test_suite" &&
        !hasPersistedTestSuiteArtifact(sessionArtifact)
      ) {
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 400,
          latencyMs: Date.now() - startTime,
        });

        return buildServerErrorResponse({
          requestId,
          errorMessage:
            "Review Test Suite action requires a persisted test suite artifact.",
          rateMeta,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

            if (workflowAction === "ingest_execution_results") {
        const executionParse = await parseExecutionResponse(message);

        const executionObj: ExecutionIntelligenceArtifact | null =
          executionParse.executionObj;
        const executionRepaired = executionParse.repaired;

        const replyTextForUser = executionObj
          ? [
              `Execution results recorded from ${executionObj.source}.`,
              `Suite status: ${executionObj.suiteStatus}.`,
              `Observed cases: ${executionObj.summary.total}.`,
              `Passed: ${executionObj.summary.passed}, Failed: ${executionObj.summary.failed}, Skipped: ${executionObj.summary.skipped}, Blocked: ${executionObj.summary.blocked}, Timed out: ${executionObj.summary.timedOut}, Unknown: ${executionObj.summary.unknown}.`,
              typeof executionObj.suiteVersion === "number"
                ? `Linked suite version: v${executionObj.suiteVersion}.`
                : null,
            ]
              .filter(Boolean)
              .join(" ")
          : "Execution input could not be normalized into a valid execution artifact.";

        let creditsRemaining: number | null = null;

        try {
          creditsRemaining = await persistAssistantWithBillingTx({
            sessionId,
            auth0Sub,
            requestId,
            creditsCharged: 1,
            assistantContentToStore: replyTextForUser,
            promptTokens: 0,
            completionTokens: 0,
          });
        } catch (e) {
          if (e instanceof InsufficientCreditsError) {
            await recordChatMetric({
              nowMs: Date.now(),
              mode: "coach",
              status: 402,
              latencyMs: Date.now() - startTime,
            });

            return buildInsufficientCreditsBillingResponse({
              requestId,
              clientMode: "coach",
              sessionId,
              creditsCharged: 1,
              creditsRemaining: orgState.wallet?.balance ?? 0,
              usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
              },
              rateMeta,
              artifact: sessionArtifact,
              artifactUpdatedAt: artifactUpdatedAtIso,
            });
          }

          throw e;
        }

        const executionPersistResult = await persistExecutionArtifact({
          sessionId,
          sessionArtifact,
          artifactUpdatedAtIso,
          executionIntelligence: executionObj,
        });

        sessionArtifact = executionPersistResult.sessionArtifact;
        artifactUpdatedAtIso = executionPersistResult.artifactUpdatedAtIso;

      const releaseHealthPersistResult = await persistReleaseHealthArtifact({
        sessionId,
        sessionArtifact: executionPersistResult.sessionArtifact,
        artifactUpdatedAtIso: executionPersistResult.artifactUpdatedAtIso,
        releaseHealth: buildReleaseHealthArtifact(
          executionPersistResult.sessionArtifact
        ),
      });

      sessionArtifact = releaseHealthPersistResult.sessionArtifact;
      artifactUpdatedAtIso = releaseHealthPersistResult.artifactUpdatedAtIso;

        await recordChatMetric({
          nowMs: Date.now(),
          mode: "coach",
          status: 200,
          latencyMs: Date.now() - startTime,
        });

        log("info", {
          event: "chat_completed",
          requestId,
          auth0Sub,
          orgId,
          sessionId,
          mode: clientMode,
          durationMs: Date.now() - startTime,
          retryCount,
          meta: {
            workflowAction,
            creditsCharged: 1,
            creditsRemaining,
            hasExecutionIntelligence: !!executionObj,
            executionRepaired,
            executionSource: executionObj?.source,
            executionSuiteStatus: executionObj?.suiteStatus,
            executionObservedCases: executionObj?.summary.total ?? 0,
          },
        });

        return buildChatSuccessResponse({
          requestId,
          clientMode: "coach",
          reply: replyTextForUser,
          coach: null,
          sessionId,
          creditsCharged: 1,
          creditsRemaining,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          rateMeta,
          executionIntelligence: executionObj,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

      const actionExecutionMode: "coach" | "review" =
      
        workflowAction === "review_test_suite" ? "review" : "coach";

      const actionWantCases =
        workflowAction === "generate_tests_from_requirement" ||
        workflowAction === "generate_next_batch_of_tests" ||
        workflowAction === "regenerate_suite";

      const actionMessage = buildWorkflowActionMessage({
        workflowAction,
        sessionArtifact,
      });

      const { messagesForModel } = buildPromptPayload({
        message: actionMessage,
        weakInput: false,
        guidedAnswer: false,
        wantCases: actionWantCases,
        executionMode: actionExecutionMode,
        explicitRegenerationRequest: false,
        sessionArtifact,
      });

      const completionResult = await executeChatCompletion({
        messagesForModel,
        executionMode: actionExecutionMode,
        wantCases: actionWantCases,
      });

      const rawReply = completionResult.rawReply;

      const promptTokens = completionResult.promptTokens;
      const completionTokens = completionResult.completionTokens;
      const totalTokens = completionResult.totalTokens;

      const usage = {
        promptTokens,
        completionTokens,
        totalTokens,
      };

      const creditsCharged = completionResult.creditsCharged;
      const costUsd = completionResult.costUsd;
      const costEur = completionResult.costEur;

      openaiModel = completionResult.model;
      openaiLatencyMs = completionResult.openaiLatencyMs;

      const postModel = await runPostModelFlow({
        rawReply,
        executionMode: actionExecutionMode,
        wantCases: actionWantCases,
        sessionId,
        sessionArtifact,
        artifactUpdatedAtIso,
        message: actionMessage,
        guidedAnswer: false,
        weakInput: false,
        explicitRegenerationRequest: false,
        workflowAction,
      });

      const coachParsed: CoachResult | null = postModel.coachParsed;
      const replyTextForUser: string | null = postModel.replyTextForUser;

      const reviewObj: ReviewResult | null = postModel.reviewObj;
      const reviewRepaired = postModel.reviewRepaired;

      const executionObj: ExecutionIntelligenceArtifact | null =
        postModel.executionObj;
      const executionRepaired = postModel.executionRepaired;

      const assistantContentToStore = postModel.assistantContentToStore;

      const nextTestSuiteArtifact: TestSuiteArtifact | null =
        postModel.nextTestSuiteArtifact;
      const testSuiteAddedCount = postModel.testSuiteAddedCount;

      sessionArtifact = postModel.sessionArtifact;
      artifactUpdatedAtIso = postModel.artifactUpdatedAtIso;

      const casesFlowTelemetry: CasesFlowTelemetry | null =
        postModel.casesFlowTelemetry;

      const suiteAnalysis = postModel.suiteAnalysis;
      const workflowGuidance = postModel.workflowGuidance;

      const shouldEmitCasesTelemetry =
        !!casesFlowTelemetry && !casesFlowTelemetry.metadata.unchanged;

      const reviewFlowTelemetry: ReviewFlowTelemetry | null =
        postModel.reviewFlowTelemetry;

      let creditsRemaining: number | null = null;

      try {
        creditsRemaining = await persistAssistantWithBillingTx({
          sessionId,
          auth0Sub,
          requestId,
          creditsCharged,
          assistantContentToStore,
          promptTokens,
          completionTokens,
        });
      } catch (e) {
        if (e instanceof InsufficientCreditsError) {
          await recordChatMetric({
            nowMs: Date.now(),
            mode: actionExecutionMode,
            status: 402,
            latencyMs: Date.now() - startTime,
          });

          return buildInsufficientCreditsBillingResponse({
            requestId,
            clientMode: actionExecutionMode,
            sessionId,
            creditsCharged,
            creditsRemaining: orgState.wallet?.balance ?? 0,
            usage,
            rateMeta,
            artifact: sessionArtifact,
            artifactUpdatedAt: artifactUpdatedAtIso,
          });
        }

        throw e;
      }

      const suitePersistResult = await persistGeneratedSuiteArtifact({
        sessionId,
        sessionArtifact,
        artifactUpdatedAtIso,
        nextTestSuiteArtifact,
      });

      sessionArtifact = suitePersistResult.sessionArtifact;
      artifactUpdatedAtIso = suitePersistResult.artifactUpdatedAtIso;

      const reviewPersistResult = await persistReviewArtifact({
        sessionId,
        sessionArtifact,
        artifactUpdatedAtIso,
        reviewResult: reviewObj,
      });

      sessionArtifact = reviewPersistResult.sessionArtifact;
      artifactUpdatedAtIso = reviewPersistResult.artifactUpdatedAtIso;

      const executionPersistResult = await persistExecutionArtifact({
        sessionId,
        sessionArtifact,
        artifactUpdatedAtIso,
        executionIntelligence: executionObj,
      });

      sessionArtifact = executionPersistResult.sessionArtifact;
      artifactUpdatedAtIso = executionPersistResult.artifactUpdatedAtIso;

   const releaseHealthPersistResult = await persistReleaseHealthArtifact({
        sessionId,
        sessionArtifact,
        artifactUpdatedAtIso,
        releaseHealth: buildReleaseHealthArtifact(sessionArtifact),
      });

      sessionArtifact = releaseHealthPersistResult.sessionArtifact;
      artifactUpdatedAtIso = releaseHealthPersistResult.artifactUpdatedAtIso;

      if (shouldEmitCasesTelemetry && casesFlowTelemetry) {
        await emitTelemetryEvent({
          eventType: casesFlowTelemetry.eventType,
          auth0Sub,
          organizationId: orgId,
          sessionId,
          workflowStage: "test_design",
          status: "success",
          durationMs: Date.now() - startTime,
          tokenInput: promptTokens,
          tokenOutput: completionTokens,
          tokenTotal: totalTokens,
          artifactType: casesFlowTelemetry.artifactType,
          artifactVersion: casesFlowTelemetry.artifactVersion,
          metadataJson: casesFlowTelemetry.metadata,
        });
      }

      if (actionExecutionMode === "review") {
        if (reviewFlowTelemetry) {
          await emitTelemetryEvent({
            eventType: reviewFlowTelemetry.eventType,
            auth0Sub,
            organizationId: orgId,
            sessionId,
            workflowStage: "test_review",
            status:
              reviewFlowTelemetry.eventType === "review_failed"
                ? "failed"
                : "success",
            durationMs: Date.now() - startTime,
            tokenInput: promptTokens,
            tokenOutput: completionTokens,
            tokenTotal: totalTokens,
            artifactType: reviewFlowTelemetry.artifactType,
            metadataJson: reviewFlowTelemetry.metadata,
          });
        }

        await recordChatMetric({
          nowMs: Date.now(),
          mode: actionExecutionMode,
          status: 200,
          latencyMs: Date.now() - startTime,
        });

        return buildReviewFlowResponse({
          requestId,
          clientMode: actionExecutionMode,
          rawReply,
          sessionId,
          creditsCharged,
          creditsRemaining,
          usage,
          rateMeta,
          reviewObj,
          reviewRepaired,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

      await recordChatMetric({
        nowMs: Date.now(),
        mode: actionExecutionMode,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      log("info", {
        event: "chat_completed",
        requestId,
        auth0Sub,
        orgId,
        sessionId,
        mode: clientMode,
        durationMs: Date.now() - startTime,
        model: openaiModel,
        openaiLatencyMs,
        retryCount,
        meta: {
          workflowAction,
          promptTokens,
          completionTokens,
          totalTokens,
          creditsCharged,
          creditsRemaining,
          costUsd,
          costEur,
          testSuiteAddedCount,
          hasArtifact: hasMeaningfulRefinedRequirement(sessionArtifact),
          hasTestSuite: !!getTestSuite(sessionArtifact),
          hasExecutionIntelligence: !!executionObj,
          executionRepaired,
          executionSource: executionObj?.source,
          executionSuiteStatus: executionObj?.suiteStatus,
          executionObservedCases: executionObj?.summary.total ?? 0,
          suiteTelemetrySuppressed:
            !!casesFlowTelemetry && !shouldEmitCasesTelemetry,
          suiteDuplicateGroups: casesFlowTelemetry?.metadata.duplicateGroups ?? 0,
          suiteUnchanged: casesFlowTelemetry?.metadata.unchanged ?? false,
          suiteCoverageLevel: suiteAnalysis?.coverageLevel,
          suiteDuplicateRisk: suiteAnalysis?.duplicateRisk,
          suiteMissingAreasCount: suiteAnalysis?.missingAreas.length ?? 0,
          workflowRecommendedAction: workflowGuidance?.recommendedAction,
          workflowGuidanceMessage: workflowGuidance?.message,
        },
      });

      return buildChatSuccessResponse({
        requestId,
        clientMode: actionExecutionMode,
        reply: replyTextForUser ?? "No reply returned",
        coach: coachParsed,
        sessionId,
        creditsCharged,
        creditsRemaining,
        usage,
        rateMeta,
        workflowGuidance,
        executionIntelligence: executionObj,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      });
    }

    /*
    ---------------------------------------------------------
    PERSIST USER MESSAGE
    ---------------------------------------------------------
    */
    await persistUserMessageIdempotent({
      sessionId,
      auth0Sub,
      requestId,
      content: message,
    });

    /*
    ---------------------------------------------------------
    GUIDED ARTIFACT PATCH
    ---------------------------------------------------------
    */
    const guidedArtifactResult = await applyGuidedArtifactPatch({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      message,
      guidedAnswer,
    });

    sessionArtifact = guidedArtifactResult.sessionArtifact;
    artifactUpdatedAtIso = guidedArtifactResult.artifactUpdatedAtIso;

  const guidedReleaseHealthPersistResult = await persistReleaseHealthArtifact({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      releaseHealth: buildReleaseHealthArtifact(sessionArtifact),
    });

    sessionArtifact = guidedReleaseHealthPersistResult.sessionArtifact;
    artifactUpdatedAtIso = guidedReleaseHealthPersistResult.artifactUpdatedAtIso;
    const requirementTelemetry: RequirementRefinedTelemetry | null =
      guidedArtifactResult.requirementTelemetry;

    if (requirementTelemetry) {
      await emitTelemetryEvent({
        eventType: requirementTelemetry.eventType,
        auth0Sub,
        organizationId: orgId,
        sessionId,
        workflowStage: "strategy",
        status: "success",
        artifactType: requirementTelemetry.artifactType,
        metadataJson: requirementTelemetry.metadata,
      });
    }

    /*
    ---------------------------------------------------------
    PROMPT BUILD
    ---------------------------------------------------------
    */
    const { messagesForModel } = buildPromptPayload({
      message,
      weakInput,
      guidedAnswer,
      wantCases,
      executionMode,
      explicitRegenerationRequest,
      sessionArtifact,
    });

    /*
    ---------------------------------------------------------
    OPENAI EXECUTION
    ---------------------------------------------------------
    */
    const completionResult = await executeChatCompletion({
      messagesForModel,
      executionMode,
      wantCases,
    });

    const rawReply = completionResult.rawReply;

    const promptTokens = completionResult.promptTokens;
    const completionTokens = completionResult.completionTokens;
    const totalTokens = completionResult.totalTokens;

    const usage = {
      promptTokens,
      completionTokens,
      totalTokens,
    };

    const creditsCharged = completionResult.creditsCharged;

    const costUsd = completionResult.costUsd;
    const costEur = completionResult.costEur;

    openaiModel = completionResult.model;
    openaiLatencyMs = completionResult.openaiLatencyMs;

    /*
    ---------------------------------------------------------
    POST-MODEL FLOW ORCHESTRATION
    ---------------------------------------------------------
    */
    const postModel = await runPostModelFlow({
      rawReply,
      executionMode,
      wantCases,
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      message,
      guidedAnswer,
      weakInput,
      explicitRegenerationRequest,
      workflowAction,
    });

    const coachParsed: CoachResult | null = postModel.coachParsed;
    const replyTextForUser: string | null = postModel.replyTextForUser;

    const reviewObj: ReviewResult | null = postModel.reviewObj;
    const reviewRepaired = postModel.reviewRepaired;

    const executionObj: ExecutionIntelligenceArtifact | null =
      postModel.executionObj;
    const executionRepaired = postModel.executionRepaired;

    const assistantContentToStore = postModel.assistantContentToStore;

    const nextTestSuiteArtifact: TestSuiteArtifact | null =
      postModel.nextTestSuiteArtifact;
    const testSuiteAddedCount = postModel.testSuiteAddedCount;

    sessionArtifact = postModel.sessionArtifact;
    artifactUpdatedAtIso = postModel.artifactUpdatedAtIso;

    const casesFlowTelemetry: CasesFlowTelemetry | null =
      postModel.casesFlowTelemetry;

    const suiteAnalysis = postModel.suiteAnalysis;
    const workflowGuidance = postModel.workflowGuidance;

    const shouldEmitCasesTelemetry =
      !!casesFlowTelemetry && !casesFlowTelemetry.metadata.unchanged;

    const reviewFlowTelemetry: ReviewFlowTelemetry | null =
      postModel.reviewFlowTelemetry;

    /*
    ---------------------------------------------------------
    BILLING TRANSACTION
    ---------------------------------------------------------
    */
    let creditsRemaining: number | null = null;

    try {
      creditsRemaining = await persistAssistantWithBillingTx({
        sessionId,
        auth0Sub,
        requestId,
        creditsCharged,
        assistantContentToStore,
        promptTokens,
        completionTokens,
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        await recordChatMetric({
          nowMs: Date.now(),
          mode: modeForMetric,
          status: 402,
          latencyMs: Date.now() - startTime,
        });

        return buildInsufficientCreditsBillingResponse({
          requestId,
          clientMode,
          sessionId,
          creditsCharged,
          creditsRemaining: orgState.wallet?.balance ?? 0,
          usage,
          rateMeta,
          artifact: sessionArtifact,
          artifactUpdatedAt: artifactUpdatedAtIso,
        });
      }

      throw e;
    }

    /*
    ---------------------------------------------------------
    SUITE ARTIFACT PERSIST
    ---------------------------------------------------------
    */
    const suitePersistResult = await persistGeneratedSuiteArtifact({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      nextTestSuiteArtifact,
    });

    sessionArtifact = suitePersistResult.sessionArtifact;
    artifactUpdatedAtIso = suitePersistResult.artifactUpdatedAtIso;

    /*
    ---------------------------------------------------------
    REVIEW ARTIFACT PERSIST
    ---------------------------------------------------------
    */
    const reviewPersistResult = await persistReviewArtifact({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      reviewResult: reviewObj,
    });

    sessionArtifact = reviewPersistResult.sessionArtifact;
    artifactUpdatedAtIso = reviewPersistResult.artifactUpdatedAtIso;

    /*
    ---------------------------------------------------------
    EXECUTION ARTIFACT PERSIST
    ---------------------------------------------------------
    */
    const executionPersistResult = await persistExecutionArtifact({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      executionIntelligence: executionObj,
    });   

    const releaseHealthPersistResult = await persistReleaseHealthArtifact({
      sessionId,
      sessionArtifact,
      artifactUpdatedAtIso,
      releaseHealth: buildReleaseHealthArtifact(sessionArtifact),
    });

    sessionArtifact = releaseHealthPersistResult.sessionArtifact;
    artifactUpdatedAtIso = releaseHealthPersistResult.artifactUpdatedAtIso;

    sessionArtifact = executionPersistResult.sessionArtifact;
    artifactUpdatedAtIso = executionPersistResult.artifactUpdatedAtIso;

    if (shouldEmitCasesTelemetry && casesFlowTelemetry) {
      await emitTelemetryEvent({
        eventType: casesFlowTelemetry.eventType,
        auth0Sub,
        organizationId: orgId,
        sessionId,
        workflowStage: "test_design",
        status: "success",
        durationMs: Date.now() - startTime,
        tokenInput: promptTokens,
        tokenOutput: completionTokens,
        tokenTotal: totalTokens,
        artifactType: casesFlowTelemetry.artifactType,
        artifactVersion: casesFlowTelemetry.artifactVersion,
        metadataJson: casesFlowTelemetry.metadata,
      });
    }

    /*
    ---------------------------------------------------------
    RESPONSES
    ---------------------------------------------------------
    */
    if (executionMode === "review") {
      if (reviewFlowTelemetry) {
        await emitTelemetryEvent({
          eventType: reviewFlowTelemetry.eventType,
          auth0Sub,
          organizationId: orgId,
          sessionId,
          workflowStage: "test_review",
          status:
            reviewFlowTelemetry.eventType === "review_failed"
              ? "failed"
              : "success",
          durationMs: Date.now() - startTime,
          tokenInput: promptTokens,
          tokenOutput: completionTokens,
          tokenTotal: totalTokens,
          artifactType: reviewFlowTelemetry.artifactType,
          metadataJson: reviewFlowTelemetry.metadata,
        });
      }

      await recordChatMetric({
        nowMs: Date.now(),
        mode: modeForMetric,
        status: 200,
        latencyMs: Date.now() - startTime,
      });

      return buildReviewFlowResponse({
        requestId,
        clientMode,
        rawReply,
        sessionId,
        creditsCharged,
        creditsRemaining,
        usage,
        rateMeta,
        reviewObj,
        reviewRepaired,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      });
    }

    await recordChatMetric({
      nowMs: Date.now(),
      mode: modeForMetric,
      status: 200,
      latencyMs: Date.now() - startTime,
    });

    log("info", {
      event: "chat_completed",
      requestId,
      auth0Sub,
      orgId,
      sessionId,
      mode: clientMode,
      durationMs: Date.now() - startTime,
      model: openaiModel,
      openaiLatencyMs,
      retryCount,
      meta: {
        promptTokens,
        completionTokens,
        totalTokens,
        creditsCharged,
        creditsRemaining,
        costUsd,
        costEur,
        explicitRegenerationRequest,
        testSuiteAddedCount,
        hasArtifact: hasMeaningfulRefinedRequirement(sessionArtifact),
        hasTestSuite: !!getTestSuite(sessionArtifact),
        hasExecutionIntelligence: !!executionObj,
        executionRepaired,
        executionSource: executionObj?.source,
        executionSuiteStatus: executionObj?.suiteStatus,
        executionObservedCases: executionObj?.summary.total ?? 0,
        suiteTelemetrySuppressed:
          !!casesFlowTelemetry && !shouldEmitCasesTelemetry,
        suiteDuplicateGroups: casesFlowTelemetry?.metadata.duplicateGroups ?? 0,
        suiteUnchanged: casesFlowTelemetry?.metadata.unchanged ?? false,
        suiteCoverageLevel: suiteAnalysis?.coverageLevel,
        suiteDuplicateRisk: suiteAnalysis?.duplicateRisk,
        suiteMissingAreasCount: suiteAnalysis?.missingAreas.length ?? 0,
        workflowRecommendedAction: workflowGuidance?.recommendedAction,
        workflowGuidanceMessage: workflowGuidance?.message,
      },
    });

    return buildChatSuccessResponse({
      requestId,
      clientMode,
      reply: replyTextForUser ?? "No reply returned",
      coach: coachParsed,
      sessionId,
      creditsCharged,
      creditsRemaining,
      usage,
      rateMeta,
      workflowGuidance,
      executionIntelligence: executionObj,
      artifact: sessionArtifact,
      artifactUpdatedAt: artifactUpdatedAtIso,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : "Unknown server error";

    const t = getOpenAITraceFromError(e);

    if (t) {
      openaiLatencyMs = t.latencyMs;
      openaiErrorCode = t.errorCode;
      openaiModel = t.model;
    }

    const isAuthExpired =
      /access token has expired|refresh token was not provided/i.test(errMsg);

    log("error", {
      event: "chat_error",
      requestId,
      auth0Sub: auth0SubForLog,
      orgId,
      sessionId: sessionIdForLog,
      mode:
        modeForMetric === "coach" ||
        modeForMetric === "review" ||
        modeForMetric === "cases"
          ? modeForMetric
          : undefined,
      durationMs: Date.now() - startTime,
      model: openaiModel,
      openaiLatencyMs,
      openaiErrorCode,
      retryCount,
      errorType: isAuthExpired ? "auth_expired" : "chat_error",
      errorMessage: errMsg,
    });

    await recordChatMetric({
      nowMs: Date.now(),
      mode: modeForMetric,
      status: isAuthExpired ? 401 : 500,
      latencyMs: Date.now() - startTime,
    });

    if (isAuthExpired) {
      return buildAuthExpiredResponse({
        requestId,
        rateMeta,
        artifact: sessionArtifact,
        artifactUpdatedAt: artifactUpdatedAtIso,
      });
    }

    return buildServerErrorResponse({
      requestId,
      errorMessage: errMsg,
      rateMeta,
      artifact: sessionArtifact,
      artifactUpdatedAt: artifactUpdatedAtIso,
    });
  }
}