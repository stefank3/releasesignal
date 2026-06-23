import type { RefinedRequirement } from "../../lib/chat/artifact";
import type { CoachResult } from "../../lib/framework/reviewSchema";

export const manualWorkflowSource = [
  "PATCH /manual-workflow-restart/{orderLineId}",
  "Path parameter: orderLineId.",
  "Request fields: modifiedBy, dateModified, deleteNcTfcOrderData.",
  "When manual restart succeeds, mod_process_flow is updated with deleted = 1 for all records for the orderLineId.",
  "When deleteNcTfcOrderData=true, delete matching mod_nc_tfc_orders rows.",
  "When deleteNcTfcOrderData=true, delete matching mod_error_retry rows.",
  "When deleteNcTfcOrderData=false, mod_nc_tfc_orders and mod_error_retry remain unchanged.",
  "Set exSystem = 'NetCracker' for the restart action.",
  "200 OK returns actionResult and actionsPerformed.",
  "400 Bad Request returns actionResult and failureReason.",
  "404 Not Found returns actionResult and failureReason.",
  "500 Internal Server Error returns actionResult and failureReason.",
  "PHP owns Order Line History updates.",
  "PHP owns process restart orchestration.",
].join("\n");

export const manualWorkflowStrict = {
  objective:
    "Restart a manual workflow for an order line through PATCH /manual-workflow-restart/{orderLineId}.",
  context:
    "PHP owns Order Line History updates and process restart orchestration.",
  functionalScope: [
    "PATCH /manual-workflow-restart/{orderLineId}.",
    "Path parameter orderLineId is required.",
    "Request fields are modifiedBy, dateModified, and deleteNcTfcOrderData.",
  ],
  businessRules: [
    "When manual restart succeeds, mod_process_flow is updated with deleted = 1 for all records for the orderLineId.",
    "When deleteNcTfcOrderData=true, delete matching mod_nc_tfc_orders rows.",
    "When deleteNcTfcOrderData=true, delete matching mod_error_retry rows.",
    "When deleteNcTfcOrderData=false, mod_nc_tfc_orders and mod_error_retry remain unchanged.",
    "Set exSystem = 'NetCracker' for the restart action.",
    "PHP owns Order Line History updates and process restart orchestration.",
  ],
  acceptanceCriteria: [
    "200 OK returns actionResult and actionsPerformed.",
    "400 Bad Request returns actionResult and failureReason.",
    "404 Not Found returns actionResult and failureReason.",
    "500 Internal Server Error returns actionResult and failureReason.",
    "Source-confirmed cleanup behavior is preserved as acceptance criteria.",
  ],
  edgeCases: [
    "400 Bad Request is returned for invalid restart input.",
    "404 Not Found is returned when the orderLineId is not found.",
    "500 Internal Server Error is returned when restart processing fails.",
  ],
  riskAreas: [
    "The deleteNcTfcOrderData=false cleanup branch can regress if optional table deletion is applied.",
  ],
  coverageTargets: [
    "Cover true and false deleteNcTfcOrderData branches.",
    "Cover 200, 400, 404, and 500 responses.",
  ],
  minimalReproScenarios: [
    "Given deleteNcTfcOrderData=false and a valid orderLineId When PATCH /manual-workflow-restart/{orderLineId} is called Then mod_process_flow is updated with deleted = 1 and mod_nc_tfc_orders and mod_error_retry remain unchanged.",
  ],
  openQuestions: [
    "Confirm whether any authorization rule applies to PATCH /manual-workflow-restart/{orderLineId}.",
  ],
};

export const manualWorkflowLegacy: CoachResult = {
  assumptions: [
    "PHP owns Order Line History updates and process restart orchestration.",
  ],
  riskMatrix: [
    {
      risk: "The deleteNcTfcOrderData=false cleanup branch can regress if optional table deletion is applied.",
      likelihood: "Medium",
      impact: "High",
      mitigation: "Cover false cleanup branch.",
    },
  ],
  highSignalApproach: {
    goals: [
      "PATCH /manual-workflow-restart/{orderLineId}.",
      "Request fields: modifiedBy, dateModified, deleteNcTfcOrderData.",
      "Validate mod_process_flow deleted = 1 for all records.",
    ],
    testIdeas: [
      "Test 200 OK returns actionResult and actionsPerformed.",
      "Test 400 Bad Request returns actionResult and failureReason.",
      "Test rollback behavior after database failure.",
    ],
    minimalRepro: [
      "Given deleteNcTfcOrderData=true When PATCH /manual-workflow-restart/{orderLineId} is called Then verify mod_nc_tfc_orders and mod_error_retry cleanup follows the source rule.",
    ],
  },
  optionalClarifications: [
    "Confirm whether any authorization rule applies to PATCH /manual-workflow-restart/{orderLineId}.",
  ],
};

export const noBillSource = [
  "NoBill Proxy post-recharge Confirm API retry mechanism.",
  "NoBill Proxy persists Transaction Number in DB.",
  "SC sends GUID in the request.",
  "The expected identifier for deduplication is OrderID.",
  "SC Backend calls Paymob.",
  "Parallel duplicate detection is required.",
  "Concurrency behavior needs confirmation.",
  "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
  "KSA reference is an applicability reference, not confirmed implementation authority.",
  "End-to-end testing is requested.",
].join("\n");

export const noBillStrict = {
  objective:
    "Define retry and deduplication behavior for the NoBill Proxy post-recharge Confirm API.",
  context:
    "SC Backend calls Paymob, and KSA is reference context only.",
  functionalScope: [
    "NoBill Proxy post-recharge Confirm API retry mechanism.",
    "NoBill Proxy persists Transaction Number in DB.",
    "SC sends GUID in the request.",
    "The expected identifier for deduplication is OrderID.",
    "Parallel duplicate detection is required.",
  ],
  businessRules: [
    "GUID, OrderID, and Transaction Number remain distinct identifiers.",
    "NoBill Proxy persists Transaction Number in DB.",
    "OrderID is the expected identifier for deduplication.",
  ],
  acceptanceCriteria: [
    "Source-confirmed deduplication behavior remains preserved for OrderID duplicate detection.",
    "The artifact does not state OrderID equals Transaction Number.",
  ],
  edgeCases: [
    "Duplicate requests with the same OrderID require confirmation for accepted and rejected outcomes.",
  ],
  riskAreas: [
    "Concurrency behavior needs confirmation.",
    "KSA reference handling needs confirmation.",
  ],
  coverageTargets: [
    "End-to-end testing is requested.",
    "Cover GUID, OrderID, and Transaction Number distinction.",
  ],
  minimalReproScenarios: [],
  openQuestions: [
    "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
    "Confirm whether KSA behavior is authoritative or reference-only.",
  ],
};

export const noBillLegacy: CoachResult = {
  assumptions: [
    "SC Backend calls Paymob.",
    "KSA reference is an applicability reference, not confirmed implementation authority.",
  ],
  riskMatrix: [
    {
      risk: "Concurrency behavior needs confirmation.",
      likelihood: "High",
      impact: "High",
      mitigation: "Keep concurrency unresolved until product confirms it.",
    },
    {
      risk: "KSA reference handling needs confirmation.",
      likelihood: "Medium",
      impact: "Medium",
      mitigation: "Track KSA as reference context.",
    },
  ],
  highSignalApproach: {
    goals: [
      "NoBill Proxy post-recharge Confirm API retry mechanism.",
      "NoBill Proxy persists Transaction Number in DB.",
      "SC sends GUID in the request.",
      "The expected identifier for deduplication is OrderID.",
      "Parallel duplicate detection is required.",
    ],
    testIdeas: [
      "End-to-end testing is requested.",
      "Test GUID, OrderID, and Transaction Number distinction.",
      "Test that only one transaction is accepted and others are rejected deterministically.",
    ],
    minimalRepro: [
      "Given duplicate requests with the same OrderID When the post-recharge Confirm API is retried Then verify the source-defined deduplication outcome.",
    ],
  },
  optionalClarifications: [
    "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
    "Confirm whether KSA behavior is authoritative or reference-only.",
  ],
};

export const mediumJiraStrict = {
  objective: "Validate refund callback processing for the Billing Adapter.",
  context: "Billing Adapter receives refund callbacks.",
  functionalScope: [
    "Billing Adapter records a refund callback.",
    "Known behavior: duplicate callbackId values are not processed twice.",
  ],
  businessRules: [
    "Duplicate callbackId values must not be processed twice.",
  ],
  acceptanceCriteria: [
    "A refund callback with a new callbackId is recorded.",
  ],
  openQuestions: [
    "Confirm the endpoint path.",
    "Confirm response codes.",
    "Confirm ownership boundaries.",
  ],
  coverageTargets: [
    "Cover duplicate callbackId handling.",
  ],
};

export const weakStory = "As a support user, I want to retry a failed transaction.";

export const casualInputs = ["hello", "what should I test?", "please help with this"];

export const existingNoBillRequirement: RefinedRequirement = {
  objective: "Define NoBill Proxy retry and deduplication.",
  functionalScope: [
    "NoBill Proxy persists Transaction Number in DB.",
    "SC sends GUID in the request.",
    "The expected identifier for deduplication is OrderID.",
  ],
  businessRules: [
    "GUID, OrderID, and Transaction Number remain distinct identifiers.",
  ],
  acceptanceCriteria: [
    "Source-confirmed deduplication behavior remains preserved for OrderID duplicate detection.",
  ],
  openQuestions: [
    "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
  ],
  openQuestionsClarifications: [
    "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
  ],
  version: 1,
  lastUpdatedAt: "2026-06-17T00:00:00.000Z",
};

export const existingNoBillRefinementRequirement: RefinedRequirement = {
  objective: "Define NoBill Proxy retry and deduplication.",
  context: "SC Backend calls Paymob, and KSA is reference context only.",
  functionalScope: [
    "NoBill Proxy post-recharge Confirm API retry mechanism.",
    "NoBill Proxy persists Transaction Number in DB.",
    "SC sends GUID in the request.",
    "The expected identifier for deduplication is OrderID.",
    "Parallel duplicate detection is required.",
  ],
  businessRules: [
    "GUID, OrderID, and Transaction Number remain distinct identifiers.",
    "OrderID is the expected identifier for deduplication.",
  ],
  acceptanceCriteria: [
    "Source-confirmed deduplication behavior remains preserved for OrderID duplicate detection.",
  ],
  riskAreas: [
    "Concurrency behavior needs confirmation.",
    "KSA reference handling needs confirmation.",
  ],
  coverageTargets: [
    "Cover GUID, OrderID, and Transaction Number distinction.",
  ],
  openQuestions: [
    "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
    "Confirm whether KSA behavior is authoritative or reference-only.",
    "Confirm whether OrderID maps to Transaction Number.",
  ],
  openQuestionsClarifications: [
    "Confirm which transaction is accepted or rejected when simultaneous requests use the same OrderID.",
    "Confirm whether KSA behavior is authoritative or reference-only.",
    "Confirm whether OrderID maps to Transaction Number.",
  ],
  version: 1,
  lastUpdatedAt: "2026-06-17T00:00:00.000Z",
};

export const speculativeNoBillPatch: Partial<RefinedRequirement> = {
  businessRules: [
    "Only one transaction is accepted and all others are rejected deterministically.",
    "Duplicate requests are handled through atomic transaction locking.",
    "OrderID is the Transaction Number.",
  ],
  acceptanceCriteria: [
    "Later concurrent requests with the same OrderID return 409 DUPLICATE_TRANSACTION.",
    "The system logs every duplicate request for monitoring.",
  ],
  riskAreas: [
    "Rollback must preserve transaction integrity.",
  ],
  openQuestionsClarifications: [],
};

export const sameNoBillSource = noBillSource;

export const existingManualQualityRequirement: RefinedRequirement = {
  objective: "Restart a manual workflow for an order line.",
  functionalScope: [
    "PATCH /manual-workflow-restart/{orderLineId}.",
    "Request fields are modifiedBy, dateModified, and deleteNcTfcOrderData.",
  ],
  businessRules: [
    "When deleteNcTfcOrderData=true, delete matching mod_nc_tfc_orders rows.",
    "When deleteNcTfcOrderData=true, delete matching mod_error_retry rows.",
    "When manual restart succeeds, mod_process_flow is updated with deleted = 1 for all records for the orderLineId.",
    "When deleteNcTfcOrderData=false, mod_nc_tfc_orders and mod_error_retry remain unchanged.",
    "Set exSystem = 'NetCracker' for the restart action.",
    "PHP owns Order Line History updates and process restart orchestration.",
  ],
  acceptanceCriteria: [
    "200 OK returns actionResult and actionsPerformed.",
    "400 Bad Request returns actionResult and failureReason.",
    "404 Not Found returns actionResult and failureReason.",
    "500 Internal Server Error returns actionResult and failureReason.",
  ],
};

export const speculativeManualPatch: Partial<RefinedRequirement> = {
  businessRules: [
    "Cleanup is atomic across mod_process_flow, mod_nc_tfc_orders, and mod_error_retry.",
    "Rollback restores all database changes when restart processing fails.",
  ],
  acceptanceCriteria: [
    "Concurrent restart requests are serialized by orderLineId.",
  ],
  riskAreas: [
    "Physical-delete versus soft-delete behavior must be resolved as an implementation rule.",
  ],
};

export const existingManualRequirement: RefinedRequirement = {
  objective: "Restart a manual workflow for an order line.",
  functionalScope: [
    "POST /manual-workflow-restart/{orderLineId}.",
    "Request fields are modifiedBy, dateModified, and deleteNcTfcOrderData.",
  ],
  businessRules: [
    "When deleteNcTfcOrderData=true, delete matching mod_nc_tfc_orders rows.",
    "When deleteNcTfcOrderData=true, delete matching mod_error_retry rows.",
    "When manual restart succeeds, mod_process_flow is updated with deleted = 1 for all records for the orderLineId.",
  ],
  acceptanceCriteria: [
    "500 Internal Server Error returns actionResult.",
  ],
  openQuestions: [
    "Confirm optional cleanup behavior when deleteNcTfcOrderData=false.",
  ],
  openQuestionsClarifications: [
    "Confirm optional cleanup behavior when deleteNcTfcOrderData=false.",
  ],
  version: 1,
  lastUpdatedAt: "2026-06-17T00:00:00.000Z",
};

export const noBillDeterministicConcurrencyRequirement: RefinedRequirement = {
  objective: "Define NoBill Proxy retry and deduplication.",
  context: "SC Backend owns NoBill retry handling; KSA is reference-only context.",
  functionalScope: [
    "NoBill Proxy persists Transaction Number in DB.",
    "Retry handling remains owned by NoBill Proxy.",
  ],
  businessRules: [
    "When multiple requests with the same OrderID arrive concurrently, only one transaction is accepted and others are rejected deterministically.",
    "GUID, OrderID, and Transaction Number remain distinct identifiers.",
  ],
  acceptanceCriteria: [
    "For simultaneous requests sharing one OrderID, only one transaction succeeds and all others are rejected deterministically.",
    "NoBill Proxy retries a failed post-recharge confirmation.",
  ],
  edgeCasesNegativePaths: [
    "Concurrent requests with the same OrderID reject every request after the first accepted transaction.",
  ],
  coverageTargets: [
    "Verify only one concurrent request succeeds and all others are rejected.",
    "Cover GUID, OrderID, and Transaction Number distinction.",
  ],
  openQuestionsClarifications: [
    "Confirm whether KSA behavior is authoritative or reference-only.",
    "Confirm whether OrderID maps to Transaction Number.",
  ],
  version: 1,
  lastUpdatedAt: "2026-06-17T00:00:00.000Z",
};

export const noBillConcurrencyUnresolvedPatch: Partial<RefinedRequirement> = {
  outOfScope: [
    "Deterministic acceptance/rejection behavior under concurrency must not be assumed.",
  ],
  openQuestionsClarifications: [
    "Concurrency acceptance/rejection behavior for simultaneous requests with the same OrderID is unresolved.",
  ],
};

export const manualConcurrencyScopeRequirement: RefinedRequirement = {
  ...existingManualQualityRequirement,
  riskAreas: [
    "Concurrency issues when multiple restart requests target the same orderLineId.",
    "deleteNcTfcOrderData mishandling can delete optional table rows.",
  ],
  riskFocus: [
    "Race-condition handling for parallel manual restart requests.",
    "Wrong exSystem filtering may update unrelated records.",
  ],
  coverageTargets: [
    "Verify simultaneous restart requests are serialized by orderLineId.",
    "Verify 200 and 500 response fields.",
  ],
  minimalReproScenarios: [
    "Submit two concurrent restart requests for the same orderLineId and verify serialization.",
    "Set deleteNcTfcOrderData=false and verify optional tables remain unchanged.",
  ],
};

export const manualWorkflowLiveConcurrencyRequirement: RefinedRequirement = {
  ...existingManualQualityRequirement,
  riskAreas: [
    "Invalid or missing request body fields causing validation failures.",
    "OrderLineId not found in mod_process_flow or related tables.",
    "Partial cleanup failure where some database updates or deletes succeed and others fail.",
    "Concurrency issues when multiple manual workflow restarts are initiated simultaneously for the same orderLineId.",
  ],
  coverageTargets: [
    "Test API with valid orderLineId and deleteNcTfcOrderData true to verify all related records are cleaned up.",
    "Test API with valid orderLineId and deleteNcTfcOrderData false to verify only mod_process_flow records are marked deleted.",
    "Test API with non-existent orderLineId to verify HTTP 404 response.",
    "Test API with missing or invalid request body fields to verify HTTP 400 response.",
    "Simulate database failure during cleanup to verify HTTP 500 response.",
    "Test concurrent requests for the same orderLineId to observe concurrency handling.",
  ],
};

export const identifierAuthorityRequirement: RefinedRequirement = {
  objective: "Define NoBill Proxy deduplication identifiers.",
  businessRules: [
    "GUID is used as the authoritative deduplication identifier.",
    "GUID, OrderID, and Transaction Number are distinct source fields.",
  ],
  acceptanceCriteria: [
    "Duplicate requests are detected using GUID as the deduplication identifier.",
  ],
  context: "SC sends GUID and NoBill persists Transaction Number.",
};

export const conditionalCleanupRequirement: RefinedRequirement = {
  objective: "Restart a manual workflow for an order line.",
  businessRules: [
    "Optional cleanup tables mod_nc_tfc_orders and mod_error_retry are always deleted.",
    "When deleteNcTfcOrderData=true, delete mod_nc_tfc_orders and mod_error_retry rows.",
  ],
  acceptanceCriteria: [
    "The optional cleanup tables are unconditionally deleted during restart.",
    "When deleteNcTfcOrderData=true, both optional cleanup tables are deleted.",
  ],
};
