import { test, expect } from "@playwright/test";
import {
  mergeArtifact,
  getRefinedRequirementVersion,
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
  constrainRequirementPatchForIntent,
  detectRequirementRefinementIntent,
} from "../../lib/server/chat/requirementRefinementIntent";
import {
  casualInputs,
  existingManualRequirement,
  existingManualQualityRequirement,
  existingNoBillRequirement,
  existingNoBillRefinementRequirement,
  noBillDeterministicConcurrencyRequirement,
  noBillConcurrencyUnresolvedPatch,
  manualConcurrencyScopeRequirement,
  manualWorkflowLiveConcurrencyRequirement,
  identifierAuthorityRequirement,
  conditionalCleanupRequirement,
  manualWorkflowLegacy,
  manualWorkflowSource,
  manualWorkflowStrict,
  mediumJiraStrict,
  noBillLegacy,
  noBillSource,
  noBillStrict,
  sameNoBillSource,
  speculativeManualPatch,
  speculativeNoBillPatch,
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

function mergedWithIntent(args: {
  existing: RefinedRequirement;
  message: string;
  modelPatch: Partial<RefinedRequirement>;
}): RefinedRequirement {
  const intent = detectRequirementRefinementIntent({
    message: args.message,
    existingArtifact: { refinedRequirement: args.existing },
  });
  const patch = constrainRequirementPatchForIntent({
    patch: args.modelPatch,
    existingArtifact: { refinedRequirement: args.existing },
    intent: intent.intent,
  });

  const artifact = mergeArtifact({ refinedRequirement: args.existing }, patch ?? {});
  return artifact.refinedRequirement!;
}

function itemCount(requirement: RefinedRequirement): number {
  return [
    ...(requirement.functionalScope ?? []),
    ...(requirement.businessRules ?? []),
    ...(requirement.acceptanceCriteria ?? []),
    ...(requirement.edgeCasesNegativePaths ?? []),
    ...(requirement.riskAreas ?? []),
    ...(requirement.coverageTargets ?? []),
    ...(requirement.openQuestionsClarifications ?? []),
  ].length;
}

function activeRequirementText(requirement: RefinedRequirement): string {
  return [
    ...(requirement.inScope ?? []),
    ...(requirement.functionalScope ?? []),
    ...(requirement.businessRules ?? []),
    ...(requirement.acceptanceCriteria ?? []),
    ...(requirement.edgeCases ?? []),
    ...(requirement.edgeCasesNegativePaths ?? []),
    ...(requirement.riskAreas ?? []),
    ...(requirement.riskFocus ?? []),
    ...(requirement.coverageTargets ?? []),
    ...(requirement.minimalReproScenarios ?? []),
  ].join("\n");
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

test.describe("cross-section contradiction reconciliation", () => {
  test("NoBill confirmed concurrency outcome becomes unresolved without stale claims", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          ...noBillDeterministicConcurrencyRequirement,
          coverageTargets: [
            ...(noBillDeterministicConcurrencyRequirement.coverageTargets ?? []),
            "Observe concurrent post-recharge requests to characterize unresolved duplicate handling.",
          ],
          openQuestionsClarifications: [
            ...(noBillDeterministicConcurrencyRequirement.openQuestionsClarifications ??
              []),
            "Concurrency acceptance/rejection behavior remains unresolved for simultaneous OrderID requests.",
          ],
        },
      },
      noBillConcurrencyUnresolvedPatch
    );
    const requirement = artifact.refinedRequirement!;

    expectNotContains(requirement, "only one transaction is accepted");
    expectNotContains(requirement, "only one transaction succeeds");
    expectNotContains(requirement, "every request after the first");
    expectSectionContains(requirement, "outOfScope", "must not be assumed");
    expectSectionContains(
      requirement,
      "openQuestionsClarifications",
      "acceptance/rejection behavior"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "characterize unresolved duplicate handling"
    );
    expectContains(requirement, "GUID, OrderID, and Transaction Number remain distinct");
    expectContains(requirement, "NoBill Proxy retries");
    expectSectionContains(requirement, "openQuestionsClarifications", "KSA");
    expectSectionContains(
      requirement,
      "openQuestionsClarifications",
      "OrderID maps to Transaction Number"
    );
  });

  test("MANUAL_WORKFLOW_RESTART concurrency moved out of scope is removed everywhere active", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: manualConcurrencyScopeRequirement },
      { outOfScope: ["Concurrency control is out of scope for manual workflow restart."] }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionContains(requirement, "outOfScope", "Concurrency control");
    expectSectionNotContains(requirement, "riskAreas", "Concurrency issues");
    expectSectionNotContains(requirement, "riskFocus", "Race-condition");
    expectSectionNotContains(requirement, "coverageTargets", "simultaneous restart");
    expectSectionNotContains(requirement, "minimalReproScenarios", "two concurrent");
    expectContains(requirement, "deleteNcTfcOrderData=true");
    expectContains(requirement, "exSystem = 'NetCracker'");
    expectContains(requirement, "200 OK returns actionResult");
  });

  test("live MANUAL_WORKFLOW_RESTART context exclusion removes stale concurrency wording", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: manualWorkflowLiveConcurrencyRequirement },
      {
        context:
          "Concurrency control, race-condition handling, locking, rollback, atomicity, logging, monitoring, pagination, batch-size, and path/body ID matching are explicitly out of scope.",
        coverageTargets: [
          "Verify deleteNcTfcOrderData=false leaves optional cleanup tables unchanged.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionNotContains(requirement, "riskAreas", "Concurrency issues");
    expectSectionNotContains(requirement, "riskAreas", "initiated simultaneously");
    expectSectionNotContains(
      requirement,
      "coverageTargets",
      "concurrent requests"
    );
    expectSectionNotContains(
      requirement,
      "coverageTargets",
      "concurrency handling"
    );
    const activeText = activeRequirementText(requirement);
    expect(activeText).not.toContain("manual workflow restarts are initiated simultaneously");
    expect(activeText).not.toContain("race-condition");
    expectContains(requirement, "explicitly out of scope");
    expectContains(requirement, "Concurrency control, race-condition handling");
    expectSectionContains(
      requirement,
      "coverageTargets",
      "optional cleanup tables"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "non-existent orderLineId"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "missing or invalid request body fields"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "deleteNcTfcOrderData true"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "deleteNcTfcOrderData false"
    );
    expectSectionContains(requirement, "coverageTargets", "HTTP 500 response");
    expectSectionContains(requirement, "riskAreas", "Partial cleanup failure");
    expectContains(requirement, "PATCH /manual-workflow-restart/{orderLineId}");
    expectContains(requirement, "mod_process_flow");
    expectContains(requirement, "mod_nc_tfc_orders");
    expectContains(requirement, "mod_error_retry");
    expectContains(requirement, "PHP owns Order Line History updates");
    expectContains(requirement, "200 OK returns actionResult");
  });

  test("concurrency exclusion preserves generic request and orderLineId content", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          ...manualWorkflowLiveConcurrencyRequirement,
          functionalScope: [
            "Request with non-existent orderLineId returns 404.",
            "Request with invalid deleteNcTfcOrderData returns 400.",
            "All mod_process_flow records for orderLineId are marked deleted.",
            "Multiple mod_process_flow records for the same orderLineId are handled.",
          ],
        },
      },
      {
        outOfScope: [
          "Concurrent request handling is out of scope for manual workflow restart.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionContains(
      requirement,
      "outOfScope",
      "Concurrent request handling"
    );
    expectSectionContains(requirement, "riskAreas", "OrderLineId not found");
    expectSectionContains(requirement, "riskAreas", "request body fields");
    expectSectionContains(requirement, "functionalScope", "non-existent orderLineId");
    expectSectionContains(requirement, "functionalScope", "invalid deleteNcTfcOrderData");
    expectSectionContains(requirement, "functionalScope", "mod_process_flow records");
    expectSectionContains(requirement, "functionalScope", "Multiple mod_process_flow");
    expectSectionContains(
      requirement,
      "coverageTargets",
      "non-existent orderLineId"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "missing or invalid request body fields"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "only mod_process_flow records are marked deleted"
    );
    expectSectionNotContains(requirement, "riskAreas", "simultaneous restarts");
    expectSectionNotContains(
      requirement,
      "coverageTargets",
      "concurrent requests"
    );
  });

  test("logging and monitoring exclusion preserves structured responses", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          objective: "Restart a manual workflow.",
          acceptanceCriteria: [
            "The API returns structured 200, 400, 404, and 500 JSON responses.",
            "Invalid request body validation returns a structured 400 response.",
          ],
          coverageTargets: [
            "Verify logging and monitoring coverage for cleanup decisions.",
            "Verify validation response coverage for malformed request bodies.",
          ],
        },
      },
      {
        nonFunctionalConstraints: [
          "Logging and monitoring are explicitly out of scope for this correction.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionContains(requirement, "nonFunctionalConstraints", "Logging");
    expectSectionNotContains(requirement, "coverageTargets", "logging");
    expectSectionNotContains(requirement, "coverageTargets", "monitoring");
    expectSectionContains(requirement, "acceptanceCriteria", "200, 400, 404, and 500");
    expectSectionContains(requirement, "acceptanceCriteria", "structured 400 response");
    expectSectionContains(requirement, "coverageTargets", "validation response");
  });

  test("pagination and batch-size exclusion preserves multiple-record handling", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          objective: "Restart a manual workflow.",
          businessRules: [
            "API must handle multiple mod_process_flow records per orderLineId.",
          ],
          coverageTargets: [
            "Test pagination behavior for large cleanup result sets.",
            "Test batch-size limits when many records match the orderLineId.",
          ],
        },
      },
      {
        context:
          "Pagination and batch-size are explicitly out of scope for this requirement.",
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectContains(requirement, "Pagination and batch-size");
    expectSectionContains(requirement, "businessRules", "multiple mod_process_flow");
    expectSectionNotContains(requirement, "coverageTargets", "pagination");
    expectSectionNotContains(requirement, "coverageTargets", "batch-size");
  });

  test("rollback and atomicity exclusion preserves structured failure responses", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          objective: "Restart a manual workflow.",
          businessRules: [
            "Cleanup must provide rollback, atomicity, and compensation guarantees.",
            "Cleanup failure returns a structured 500 response.",
          ],
          riskAreas: [
            "Partial cleanup failure where some database updates or deletes succeed and others fail.",
            "Rollback or compensation failure may leave data inconsistent.",
          ],
          coverageTargets: [
            "Verify rollback and compensation behavior for failed cleanup.",
            "Verify structured 500 response handling for cleanup failure.",
          ],
        },
      },
      {
        nonFunctionalConstraints: [
          "Rollback, atomicity, and compensation are explicitly out of scope.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionContains(requirement, "nonFunctionalConstraints", "Rollback");
    expectSectionNotContains(requirement, "businessRules", "rollback");
    expectSectionNotContains(requirement, "businessRules", "atomicity");
    expectSectionNotContains(requirement, "riskAreas", "compensation");
    expectSectionNotContains(requirement, "coverageTargets", "rollback");
    expectSectionContains(requirement, "businessRules", "structured 500 response");
    expectSectionContains(requirement, "riskAreas", "Partial cleanup failure");
    expectSectionContains(requirement, "coverageTargets", "structured 500 response");
  });

  test("contrastive exclusion guard preserves non-excluded rollback content", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          objective: "Restart a manual workflow.",
          businessRules: [
            "Rollback is required for failed cleanup operations.",
            "Logging captures cleanup decisions.",
          ],
          coverageTargets: [
            "Verify rollback behavior for failed cleanup.",
            "Verify logging coverage for cleanup decisions.",
          ],
        },
      },
      {
        context: "Rollback is required, but logging is out of scope.",
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectContains(requirement, "Rollback is required, but logging is out of scope");
    expectSectionContains(requirement, "businessRules", "Rollback is required");
    expectSectionContains(requirement, "coverageTargets", "rollback behavior");
    expectSectionNotContains(requirement, "businessRules", "Logging captures");
    expectSectionNotContains(requirement, "coverageTargets", "logging coverage");
  });

  test("path/body ID matching exclusion preserves path and body validation", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          objective: "Update an entity by path identifier.",
          acceptanceCriteria: [
            "Body identifier must match path identifier before processing.",
            "Missing path parameter returns 400.",
            "Invalid request body fields return 400.",
          ],
          coverageTargets: [
            "Test path/body identifier mismatch.",
            "Test missing path parameter validation.",
            "Test invalid request body validation.",
          ],
        },
      },
      {
        outOfScope: [
          "Path/body ID matching is explicitly out of scope for this correction.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionContains(requirement, "outOfScope", "Path/body ID matching");
    expectSectionNotContains(requirement, "acceptanceCriteria", "match path identifier");
    expectSectionNotContains(requirement, "coverageTargets", "path/body identifier mismatch");
    expectSectionContains(requirement, "acceptanceCriteria", "Missing path parameter");
    expectSectionContains(requirement, "acceptanceCriteria", "Invalid request body");
    expectSectionContains(requirement, "coverageTargets", "path parameter validation");
    expectSectionContains(requirement, "coverageTargets", "request body validation");
  });

  test("same-turn additions merge against the reconciled MANUAL_WORKFLOW_RESTART base", () => {
    const artifact = mergeArtifact(
      {
        refinedRequirement: {
          ...manualConcurrencyScopeRequirement,
          edgeCases: [
            "Concurrent restart requests for the same orderLineId may race.",
          ],
          edgeCasesNegativePaths: [
            "Concurrent restart requests for the same orderLineId may race.",
          ],
        },
      },
      {
        outOfScope: [
          "Concurrency control and race-condition handling are out of scope.",
        ],
        coverageTargets: [
          "Verify deleteNcTfcOrderData=false leaves optional cleanup tables unchanged.",
        ],
        edgeCasesNegativePaths: [
          "Invalid deleteNcTfcOrderData value returns a validation error.",
        ],
        minimalReproScenarios: [
          "Given deleteNcTfcOrderData=false, when the restart endpoint is called, then optional cleanup tables remain unchanged.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectSectionNotContains(requirement, "edgeCases", "Concurrent restart");
    expectSectionNotContains(
      requirement,
      "edgeCasesNegativePaths",
      "Concurrent restart"
    );
    expectSectionNotContains(
      requirement,
      "coverageTargets",
      "simultaneous restart"
    );
    expectSectionNotContains(
      requirement,
      "minimalReproScenarios",
      "two concurrent"
    );
    expectSectionContains(
      requirement,
      "coverageTargets",
      "optional cleanup tables"
    );
    expectSectionContains(
      requirement,
      "edgeCasesNegativePaths",
      "validation error"
    );
    expectSectionContains(
      requirement,
      "minimalReproScenarios",
      "restart endpoint is called"
    );
    expectSectionContains(requirement, "outOfScope", "Concurrency control");
    expect(requirement.edgeCases).toEqual(requirement.edgeCasesNegativePaths);
    expectContains(requirement, "PATCH /manual-workflow-restart/{orderLineId}");
    expectContains(requirement, "mod_process_flow");
    expectContains(requirement, "200 OK returns actionResult");
    expectContains(requirement, "PHP owns Order Line History updates");
  });

  test("identifier correction replaces GUID authority while preserving distinct identifiers", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: identifierAuthorityRequirement },
      {
        businessRules: [
          "Correction: OrderID must be used as the deduplication identifier instead of GUID; GUID is incorrect for deduplication authority.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectNotContains(requirement, "GUID is used as the authoritative");
    expectNotContains(requirement, "detected using GUID");
    expectContains(requirement, "OrderID must be used");
    expectContains(requirement, "GUID, OrderID, and Transaction Number are distinct");
    expectContains(requirement, "NoBill persists Transaction Number");
  });

  test("conditional false-branch correction removes always-delete claims", () => {
    const artifact = mergeArtifact(
      { refinedRequirement: conditionalCleanupRequirement },
      {
        businessRules: [
          "When deleteNcTfcOrderData=false, mod_nc_tfc_orders and mod_error_retry remain unchanged.",
        ],
        acceptanceCriteria: [
          "With deleteNcTfcOrderData=false, optional cleanup tables remain unchanged.",
        ],
      }
    );
    const requirement = artifact.refinedRequirement!;

    expectNotContains(requirement, "always deleted");
    expectNotContains(requirement, "unconditionally deleted");
    expectContains(requirement, "deleteNcTfcOrderData=false");
    expectContains(requirement, "deleteNcTfcOrderData=true");
  });
});

test.describe("refinement intent control", () => {
  test("detects quality-only generic refinement with no new facts", () => {
    const result = detectRequirementRefinementIntent({
      message: "Refine and improve this technical requirement.",
      existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
    });

    expect(result).toEqual({
      intent: "quality_only",
      newFactDetected: false,
      correctionDetected: false,
      scopeChangeDetected: false,
    });
  });

  test("ordinary repeated include prose is quality-only", () => {
    const result = detectRequirementRefinementIntent({
      message: "Response fields include actionResult and failureReason.",
      existingArtifact: {
        refinedRequirement: {
          ...existingManualQualityRequirement,
          acceptanceCriteria: [
            ...(existingManualQualityRequirement.acceptanceCriteria ?? []),
            "Response fields include actionResult and failureReason.",
          ],
        },
      },
    });

    expect(result.intent).toBe("quality_only");
    expect(result.newFactDetected).toBe(false);
    expect(result.scopeChangeDetected).toBe(false);
  });

  test("include with concrete technical facts is a clarification update", () => {
    const result = detectRequirementRefinementIntent({
      message: "Include failureReason CLEANUP_FAILED in the 500 response.",
      existingArtifact: { refinedRequirement: existingManualQualityRequirement },
    });

    expect(result.intent).toBe("clarification_update");
    expect(result.newFactDetected).toBe(true);
    expect(result.scopeChangeDetected).toBe(false);
  });

  test("vague include request remains quality-only", () => {
    const result = detectRequirementRefinementIntent({
      message: "Include more detail.",
      existingArtifact: { refinedRequirement: existingManualQualityRequirement },
    });

    expect(result.intent).toBe("quality_only");
    expect(result.newFactDetected).toBe(false);
    expect(result.scopeChangeDetected).toBe(false);
  });

  test("natural add and remove scope phrasing is scope-change intent", () => {
    for (const message of [
      "Remove concurrency handling from scope.",
      "Add retry ownership to scope.",
      "Concurrency control is out of scope.",
      "Exclude logging from this ticket.",
      "Do not include monitoring.",
      "Exclude logging and monitoring from this ticket.",
    ]) {
      const result = detectRequirementRefinementIntent({
        message,
        existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
      });

      expect(result.intent).toBe("scope_change");
      expect(result.scopeChangeDetected).toBe(true);
    }
  });

  test("new technical product fact using include is a clarification update", () => {
    const result = detectRequirementRefinementIntent({
      message: "The success response fields include actionResult and actionsPerformed.",
      existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
    });

    expect(result.intent).toBe("clarification_update");
    expect(result.newFactDetected).toBe(true);
    expect(result.scopeChangeDetected).toBe(false);
  });

  test("quality-only NoBill refinement does not add speculative scope", () => {
    const beforeCount = itemCount(existingNoBillRefinementRequirement);
    const requirement = mergedWithIntent({
      existing: existingNoBillRefinementRequirement,
      message: "Refine and improve this technical requirement.",
      modelPatch: speculativeNoBillPatch,
    });

    expectDistinctIdentifiers(requirement);
    expectSectionContains(
      requirement,
      "openQuestionsClarifications",
      "same OrderID"
    );
    expectSectionContains(requirement, "openQuestionsClarifications", "KSA");
    expectSectionContains(
      requirement,
      "openQuestionsClarifications",
      "OrderID maps to Transaction Number"
    );
    expectNotContains(requirement, "Only one transaction is accepted");
    expectNotContains(requirement, "atomic transaction locking");
    expectNotContains(requirement, "OrderID is the Transaction Number");
    expectNotContains(requirement, "409 DUPLICATE_TRANSACTION");
    expectNotContains(requirement, "monitoring");
    expectNotContains(requirement, "rollback");
    expect(itemCount(requirement)).toBeLessThanOrEqual(beforeCount + 2);
    expect(getRefinedRequirementVersion(requirement)).toBeGreaterThanOrEqual(1);
  });

  test("repeated same NoBill source is quality-only and does not grow duplicates", () => {
    const result = detectRequirementRefinementIntent({
      message: sameNoBillSource,
      existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
    });
    const beforeCount = itemCount(existingNoBillRefinementRequirement);
    const requirement = mergedWithIntent({
      existing: existingNoBillRefinementRequirement,
      message: sameNoBillSource,
      modelPatch: {
        ...noBillStrict,
        businessRules: [
          ...(noBillStrict.businessRules ?? []),
          "Only one transaction is accepted and all others are rejected deterministically.",
        ],
      },
    });

    expect(result.intent).toBe("quality_only");
    expectNoDuplicatePlacement(requirement);
    expectNotContains(requirement, "Only one transaction is accepted");
    expectSectionContains(
      requirement,
      "openQuestionsClarifications",
      "same OrderID"
    );
    expect(itemCount(requirement)).toBeLessThanOrEqual(beforeCount + 2);
  });

  test("clarification update adds confirmed identifier mapping only", () => {
    const result = detectRequirementRefinementIntent({
      message: "OrderID is persisted directly as Transaction Number.",
      existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
    });
    const requirement = mergedWithIntent({
      existing: existingNoBillRefinementRequirement,
      message: "OrderID is persisted directly as Transaction Number.",
      modelPatch: {
        businessRules: ["OrderID is persisted directly as Transaction Number."],
        acceptanceCriteria: [
          "The persisted Transaction Number equals the submitted OrderID.",
        ],
      },
    });

    expect(result.intent).toBe("clarification_update");
    expectContains(requirement, "OrderID is persisted directly as Transaction Number");
    expectSectionNotContains(
      requirement,
      "openQuestionsClarifications",
      "OrderID maps to Transaction Number"
    );
    expectSectionContains(
      requirement,
      "openQuestionsClarifications",
      "same OrderID"
    );
    expectNotContains(requirement, "locking");
    expectNotContains(requirement, "rollback");
  });

  test("concurrency clarification resolves only matching Open Question", () => {
    const result = detectRequirementRefinementIntent({
      message:
        "First committed request succeeds; later requests with the same OrderID return 409 DUPLICATE_TRANSACTION.",
      existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
    });
    const requirement = mergedWithIntent({
      existing: existingNoBillRefinementRequirement,
      message:
        "First committed request succeeds; later requests with the same OrderID return 409 DUPLICATE_TRANSACTION.",
      modelPatch: {
        businessRules: [
          "First committed request succeeds; later requests with the same OrderID return 409 DUPLICATE_TRANSACTION.",
        ],
        acceptanceCriteria: [
          "Later requests with the same OrderID return 409 DUPLICATE_TRANSACTION.",
        ],
      },
    });

    expect(result.intent).toBe("clarification_update");
    expectContains(requirement, "409 DUPLICATE_TRANSACTION");
    expectSectionNotContains(
      requirement,
      "openQuestionsClarifications",
      "which transaction is accepted"
    );
    expectSectionContains(requirement, "openQuestionsClarifications", "KSA");
    expectNotContains(requirement, "all others rejected deterministically");
  });

  test("correction intent replaces old endpoint fact", () => {
    const result = detectRequirementRefinementIntent({
      message: "Correction: endpoint is PATCH, not POST.",
      existingArtifact: { refinedRequirement: existingManualRequirement },
    });
    const requirement = mergedWithIntent({
      existing: existingManualRequirement,
      message: "Correction: endpoint is PATCH, not POST.",
      modelPatch: {
        functionalScope: [
          "Correction: the endpoint is PATCH /manual-workflow-restart/{orderLineId}.",
        ],
      },
    });

    expect(result.intent).toBe("correction");
    expectContains(requirement, "PATCH /manual-workflow-restart/{orderLineId}");
    expectNotContains(requirement, "POST /manual-workflow-restart/{orderLineId}");
    expectContains(requirement, "mod_process_flow");
  });

  test("scope-change intent removes inferred concurrency scope", () => {
    const result = detectRequirementRefinementIntent({
      message: "Concurrency control is out of scope.",
      existingArtifact: { refinedRequirement: existingNoBillRefinementRequirement },
    });
    const requirement = mergedWithIntent({
      existing: {
        ...existingNoBillRefinementRequirement,
        functionalScope: [
          ...(existingNoBillRefinementRequirement.functionalScope ?? []),
          "Concurrent duplicate requests are handled by this ticket.",
        ],
        acceptanceCriteria: [
          ...(existingNoBillRefinementRequirement.acceptanceCriteria ?? []),
          "Only one transaction is accepted and all others are rejected deterministically.",
        ],
      },
      message: "Concurrency control is out of scope.",
      modelPatch: {
        outOfScope: ["Concurrency control is out of scope."],
      },
    });

    expect(result.intent).toBe("scope_change");
    expectSectionContains(requirement, "outOfScope", "Concurrency control");
    expectSectionNotContains(requirement, "functionalScope", "Concurrent duplicate");
    expectSectionNotContains(requirement, "acceptanceCriteria", "Only one transaction");
    expectContains(requirement, "Transaction Number");
  });

  test("quality-only MANUAL_WORKFLOW_RESTART does not broaden cleanup behavior", () => {
    const result = detectRequirementRefinementIntent({
      message: "Improve and broaden this requirement.",
      existingArtifact: { refinedRequirement: existingManualQualityRequirement },
    });
    const requirement = mergedWithIntent({
      existing: existingManualQualityRequirement,
      message: "Improve and broaden this requirement.",
      modelPatch: speculativeManualPatch,
    });

    expect(result.intent).toBe("quality_only");
    expectManualWorkflowQuality(requirement);
    expectNotContains(requirement, "atomic");
    expectNotContains(requirement, "rollback");
    expectNotContains(requirement, "serialized");
    expectNotContains(requirement, "soft-delete");
    expectNoDuplicatePlacement(requirement);
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
    refinementIntent: "clarification_update",
    strictRequirementParsed: false,
    legacyCoachParsed: true,
    compatibilityPatch,
    selectedPatch: compatibilityPatch,
    existingArtifactPresent: true,
    refinementMerged: true,
    artifactSaved: true,
    newFactDetected: true,
    correctionDetected: false,
    scopeChangeDetected: false,
  });

  expect(diagnostics).toEqual({
    requestId: "req-test",
    refinementPath: "legacy_coach_compatibility",
    refinementIntent: "clarification_update",
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
    newFactDetected: true,
    correctionDetected: false,
    scopeChangeDetected: false,
  });
  expect(JSON.stringify(diagnostics)).not.toContain("manual-workflow-restart");
  expect(JSON.stringify(diagnostics)).not.toContain("NetCracker");
});
