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
