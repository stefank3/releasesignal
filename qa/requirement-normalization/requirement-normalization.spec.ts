import { test, expect } from "@playwright/test";
import {
  mergeArtifact,
  type RefinedRequirement,
} from "../../lib/chat/artifact";
import {
  legacyCoachToRequirementPatchForRegression,
  buildRequirementRefinementDiagnostics,
} from "../../lib/server/chat/coachFlowService";
import {
  normalizeRequirementLikeForRegression,
  type NormalizedRefinedRequirement,
} from "../../lib/server/chat/modelResponseParser";
import {
  casualInputs,
  existingManualRequirement,
  existingNoBillRequirement,
  manualWorkflowLegacy,
  manualWorkflowSource,
  manualWorkflowStrict,
  mediumJiraStrict,
  noBillLegacy,
  noBillSource,
  noBillStrict,
  weakStory,
} from "./fixtures";
import {
  expectContains,
  expectDistinctIdentifiers,
  expectNoDuplicatePlacement,
  expectNoGenericMinimalRepro,
  expectNotContains,
  expectSectionContains,
  expectSectionNotContains,
  expectTestActivityOnlyInCoverage,
  expectUnresolvedOnlyInOpenQuestions,
} from "./assertions";

function strictToRequirement(
  normalized: NormalizedRefinedRequirement | null
): RefinedRequirement | null {
  if (!normalized) return null;

  return {
    objective: normalized.objective,
    ...(normalized.context ? { context: normalized.context } : {}),
    inScope: normalized.inScope,
    outOfScope: normalized.outOfScope,
    integrations: normalized.integrations,
    functionalScope: normalized.functionalScope,
    businessRules: normalized.businessRules,
    acceptanceCriteria: normalized.acceptanceCriteria,
    edgeCases: normalized.edgeCasesNegativePaths,
    edgeCasesNegativePaths: normalized.edgeCasesNegativePaths,
    nonFunctionalConstraints: normalized.nonFunctionalConstraints,
    riskAreas: normalized.testStrategyHooks.riskAreas,
    riskFocus: normalized.testStrategyHooks.riskAreas,
    coverageTargets: normalized.testStrategyHooks.coverageTargets,
    minimalReproScenarios: normalized.minimalReproScenarios,
    openQuestions: normalized.openQuestionsClarifications,
    openQuestionsClarifications: normalized.openQuestionsClarifications,
  };
}

function expectManualWorkflowQuality(requirement: RefinedRequirement): void {
  expectContains(requirement, "PATCH /manual-workflow-restart/{orderLineId}");
  expectContains(requirement, "orderLineId");
  expectContains(requirement, "modifiedBy");
  expectContains(requirement, "dateModified");
  expectContains(requirement, "deleteNcTfcOrderData");
  expectContains(requirement, "mod_process_flow");
  expectContains(requirement, "deleted = 1");
  expectContains(requirement, "mod_nc_tfc_orders");
  expectContains(requirement, "mod_error_retry");
  expectContains(requirement, "exSystem = 'NetCracker'");
  expectContains(requirement, "actionResult");
  expectContains(requirement, "failureReason");
  expectContains(requirement, "actionsPerformed");
  expectContains(requirement, "200 OK");
  expectContains(requirement, "400 Bad Request");
  expectContains(requirement, "404 Not Found");
  expectContains(requirement, "500 Internal Server Error");
  expectContains(requirement, "PHP owns");
  expectContains(requirement, "deleteNcTfcOrderData=true");
  expectContains(requirement, "deleteNcTfcOrderData=false");
  expectNotContains(requirement, "rollback");
  expectNotContains(requirement, "locking");
  expectNotContains(requirement, "concurrency");
  expectSectionNotContains(requirement, "acceptanceCriteria", "Test ");
  expectSectionContains(requirement, "acceptanceCriteria", "200 OK");
  expectSectionContains(requirement, "acceptanceCriteria", "400 Bad Request");
  expectSectionContains(requirement, "acceptanceCriteria", "404 Not Found");
  expectSectionContains(requirement, "acceptanceCriteria", "500 Internal Server Error");
  expectNoDuplicatePlacement(requirement);
  expectUnresolvedOnlyInOpenQuestions(requirement);
  expectTestActivityOnlyInCoverage(requirement);
  expectNoGenericMinimalRepro(requirement);
}

function expectNoBillQuality(requirement: RefinedRequirement): void {
  expectDistinctIdentifiers(requirement);
  expectContains(requirement, "NoBill Proxy");
  expectContains(requirement, "post-recharge Confirm API");
  expectContains(requirement, "retry mechanism");
  expectContains(requirement, "SC Backend");
  expectContains(requirement, "Paymob");
  expectContains(requirement, "Parallel duplicate detection");
  expectSectionContains(requirement, "openQuestionsClarifications", "same OrderID");
  expectSectionContains(requirement, "openQuestionsClarifications", "KSA");
  expectNotContains(
    requirement,
    "only one transaction is accepted and others are rejected deterministically"
  );
  expectSectionNotContains(requirement, "functionalScope", "testing");
  expectSectionNotContains(requirement, "acceptanceCriteria", "testing");
  expectNotContains(requirement, "rollback");
  expectNotContains(requirement, "locking");
  expectNotContains(requirement, "logging");
  expectNoDuplicatePlacement(requirement);
  expectUnresolvedOnlyInOpenQuestions(requirement);
  expectTestActivityOnlyInCoverage(requirement);
  expectNoGenericMinimalRepro(requirement);
}

test.describe("requirement normalization regression fixtures", () => {
  test("strict MANUAL_WORKFLOW_RESTART preserves source technical rules", () => {
    const requirement = strictToRequirement(
      normalizeRequirementLikeForRegression(manualWorkflowStrict)
    );

    expect(requirement).not.toBeNull();
    expectManualWorkflowQuality(requirement!);
  });

  test("legacy MANUAL_WORKFLOW_RESTART compatibility preserves source technical rules", () => {
    const requirement = legacyCoachToRequirementPatchForRegression({
      coach: manualWorkflowLegacy,
      sourceMessage: manualWorkflowSource,
    });

    expect(requirement).not.toBeNull();
    expectManualWorkflowQuality(requirement!);
  });

  test("strict NoBill Proxy keeps identifiers distinct and concurrency unresolved", () => {
    const requirement = strictToRequirement(
      normalizeRequirementLikeForRegression(noBillStrict)
    );

    expect(requirement).not.toBeNull();
    expectNoBillQuality(requirement!);
  });

  test("legacy NoBill Proxy keeps identifiers distinct and concurrency unresolved", () => {
    const requirement = legacyCoachToRequirementPatchForRegression({
      coach: noBillLegacy,
      sourceMessage: noBillSource,
    });

    expect(requirement).not.toBeNull();
    expectNoBillQuality(requirement!);
  });

  test("medium Jira item creates partial requirement without invented details", () => {
    const requirement = strictToRequirement(
      normalizeRequirementLikeForRegression(mediumJiraStrict)
    );

    expect(requirement).not.toBeNull();
    expectContains(requirement!, "Billing Adapter");
    expectContains(requirement!, "duplicate callbackId");
    expectSectionContains(requirement!, "openQuestionsClarifications", "endpoint path");
    expectSectionContains(requirement!, "openQuestionsClarifications", "response codes");
    expectSectionContains(requirement!, "openQuestionsClarifications", "ownership boundaries");
    expectNotContains(requirement!, "/refund");
    expectNotContains(requirement!, "database table");
    expectNotContains(requirement!, "concurrency");
  });

  test("weak Jira story rejects rather than inventing technical contract", () => {
    const strictRequirement = normalizeRequirementLikeForRegression({
      objective: weakStory,
    });
    const legacyRequirement = legacyCoachToRequirementPatchForRegression({
      coach: {
        assumptions: [],
        riskMatrix: [],
        highSignalApproach: {
          goals: [weakStory],
          testIdeas: ["Test retrying a failed transaction."],
        },
        optionalClarifications: [],
      },
      sourceMessage: weakStory,
    });

    expect(strictRequirement).toBeNull();
    expect(legacyRequirement).toBeNull();
  });

  for (const input of casualInputs) {
    test(`casual input is rejected: ${input}`, () => {
      expect(normalizeRequirementLikeForRegression({ objective: input })).toBeNull();
      expect(
        legacyCoachToRequirementPatchForRegression({
          coach: {
            assumptions: [],
            riskMatrix: [],
            highSignalApproach: {
              goals: [input],
              testIdeas: [],
            },
            optionalClarifications: [],
          },
          sourceMessage: input,
        })
      ).toBeNull();
    });
  }
});

test.describe("iterative requirement refinement", () => {
  test("resolves an Open Question without losing identifier facts", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: existingNoBillRequirement },
      {
        businessRules: [
          "For simultaneous requests with the same OrderID, the first committed request succeeds and subsequent requests return 409 DUPLICATE_TRANSACTION.",
        ],
        acceptanceCriteria: [
          "Subsequent simultaneous requests with the same OrderID return 409 DUPLICATE_TRANSACTION.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectDistinctIdentifiers(requirement);
    expectContains(requirement, "409 DUPLICATE_TRANSACTION");
    expectSectionNotContains(
      requirement,
      "openQuestionsClarifications",
      "which transaction is accepted"
    );
  });

  test("corrects a previously wrong endpoint method", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: existingManualRequirement },
      {
        functionalScope: [
          "Correction: the endpoint is PATCH /manual-workflow-restart/{orderLineId}.",
        ],
        acceptanceCriteria: [
          "PATCH /manual-workflow-restart/{orderLineId} handles manual workflow restart.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectContains(requirement, "PATCH /manual-workflow-restart/{orderLineId}");
    expectNotContains(requirement, "POST /manual-workflow-restart/{orderLineId}");
    expectContains(requirement, "mod_process_flow");
  });

  test("adds missing 500 response detail without losing existing cleanup rules", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: existingManualRequirement },
      {
        acceptanceCriteria: [
          "The 500 Internal Server Error response uses failureReason CLEANUP_FAILED.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectContains(requirement, "failureReason CLEANUP_FAILED");
    expectContains(requirement, "mod_process_flow");
    expectContains(requirement, "mod_nc_tfc_orders");
  });

  test("narrows false cleanup branch precisely", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: existingManualRequirement },
      {
        businessRules: [
          "When deleteNcTfcOrderData=false, only mod_process_flow is updated; mod_nc_tfc_orders and mod_error_retry remain unchanged.",
        ],
        acceptanceCriteria: [
          "With deleteNcTfcOrderData=false, mod_nc_tfc_orders and mod_error_retry remain unchanged.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectContains(requirement, "deleteNcTfcOrderData=false");
    expectContains(requirement, "mod_nc_tfc_orders and mod_error_retry remain unchanged");
    expectContains(requirement, "deleteNcTfcOrderData=true");
    expectSectionNotContains(
      requirement,
      "openQuestionsClarifications",
      "optional cleanup behavior"
    );
  });

  test("explicitly removes inferred concurrency scope", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          ...existingNoBillRequirement,
          functionalScope: [
            ...(existingNoBillRequirement.functionalScope ?? []),
            "Concurrent requests with the same OrderID are handled by this ticket.",
          ],
          acceptanceCriteria: [
            ...(existingNoBillRequirement.acceptanceCriteria ?? []),
            "Only one transaction is accepted and others are rejected deterministically.",
          ],
          riskAreas: ["Concurrency behavior may reject duplicate requests."],
        },
      },
      {
        outOfScope: ["Concurrency control is out of scope for this API ticket."],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionContains(requirement, "outOfScope", "Concurrency control");
    expectSectionNotContains(requirement, "functionalScope", "Concurrent requests");
    expectSectionNotContains(requirement, "acceptanceCriteria", "Only one transaction");
    expectSectionNotContains(requirement, "riskAreas", "Concurrency behavior");
    expectSectionNotContains(requirement, "openQuestionsClarifications", "same OrderID");
  });
});

test("sanitized diagnostics expose the path without content", () => {
  const compatibilityPatch = legacyCoachToRequirementPatchForRegression({
    coach: manualWorkflowLegacy,
    sourceMessage: manualWorkflowSource,
  });
  const diagnostics = buildRequirementRefinementDiagnostics({
    requestId: "req-test",
    refinementPath: "legacy_coach_compatibility",
    strictRequirementParsed: false,
    legacyCoachParsed: true,
    compatibilityPatch,
    selectedPatch: compatibilityPatch,
    existingArtifactPresent: true,
    refinementMerged: true,
    artifactSaved: true,
  });

  expect(diagnostics).toEqual({
    requestId: "req-test",
    refinementPath: "legacy_coach_compatibility",
    strictRequirementParsed: false,
    legacyCoachParsed: true,
    compatibilityAccepted: true,
    compatibilitySignalCount: expect.any(Number),
    qualitySectionCounts: {
      functionalScope: expect.any(Number),
      acceptanceCriteria: expect.any(Number),
      edgeCases: expect.any(Number),
      riskAreas: expect.any(Number),
      coverageTargets: expect.any(Number),
      minimalReproScenarios: expect.any(Number),
      openQuestions: expect.any(Number),
    },
    existingArtifactPresent: true,
    refinementMerged: true,
    artifactSaved: true,
  });
  expect(JSON.stringify(diagnostics)).not.toContain("manual-workflow-restart");
  expect(JSON.stringify(diagnostics)).not.toContain("NetCracker");
});
