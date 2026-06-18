import type { RefinedRequirement } from "@/lib/chat/artifact";

export type RequirementQualitySections = {
  inScope: string[];
  functionalScope: string[];
  businessRules: string[];
  acceptanceCriteria: string[];
  edgeCasesNegativePaths: string[];
  riskAreas: string[];
  coverageTargets: string[];
  minimalReproScenarios: string[];
  openQuestionsClarifications: string[];
};

export function normalizeQualitySentence(value: string): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!text) return "";

  const withoutTrailing = text.replace(/[.]+$/, "").trim();
  if (!withoutTrailing) return "";

  return `${withoutTrailing}.`;
}

export function normalizeQualityPhrase(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[.]+$/, "")
    .trim();
}

function placementKey(value: string): string {
  return normalizeQualityPhrase(value)
    .toLowerCase()
    .replace(/^(coverage for|risk coverage for|scope coverage for):\s*/i, "")
    .replace(/^(test focus|test acceptance flow|prove acceptance criterion):\s*/i, "")
    .replace(/^(validate business rule|validate in-scope behavior):\s*/i, "")
    .replace(/^(cover edge case|cover negative path):\s*/i, "")
    .replace(/\b(given|when|then|setup|action|expected observable outcome)\b/g, "")
    .replace(/[^a-z0-9_{}./'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appendUniqueByPlacementKey(
  target: string[],
  value: string | null,
  max: number
): void {
  if (!value || target.length >= max) return;

  const cleaned = normalizeQualitySentence(value);
  if (!cleaned) return;

  const key = placementKey(cleaned);
  if (!key) return;

  const seen = new Set(target.map(placementKey));
  if (seen.has(key)) return;

  target.push(cleaned);
}

const UNRESOLVED_PATTERN =
  /\b(need(?:s|ed)? confirmation|needs to be confirmed|unclear|to be defined|tbd|pending confirmation|requires alignment|requires clarification|must be clarified|confirm whether|confirm if|confirm which|confirm what|confirm how|which\s+\S.{0,40}\?|how\s+\S.{0,40}\?|what\s+\S.{0,40}\?)\b/i;
const TEST_ACTIVITY_PATTERN =
  /\b(tests|testing|perform e2e|e2e testing|qa should|tester should)\b/i;
const GENERIC_BUSINESS_RULE_PATTERN =
  /\b(system behavior must satisfy the stated objective|system should work as expected|implementation must meet requirements|must meet the requirements|works as expected)\b/i;
const NEGATIVE_BEHAVIOR_PATTERN =
  /\b(invalid|missing|malformed|duplicate|idempot|retry|transient|failure|failed|error|timeout|forbidden|unauth|unauthorized|boundary|unsupported|conflict|not found|bad request|internal server error|partial|race|concurrent|concurrency|rollback|lock|serialization)\b/i;
const POSITIVE_CORE_PATTERN =
  /\b(valid|successful|success|succeeds|200 ok|supported|happy path|correct conditional cleanup|accepted)\b/i;
const REFERENCE_IMPLEMENTATION_PATTERN =
  /\b(similar logic|reference implementation|existing implementation|ksa|as implemented in|based on another system)\b/i;

export function isUnresolvedRequirementText(value: string): boolean {
  const text = normalizeQualityPhrase(value);
  return UNRESOLVED_PATTERN.test(text) || /\?$/.test(text);
}
export function isTestActivityText(value: string): boolean {
  return TEST_ACTIVITY_PATTERN.test(normalizeQualityPhrase(value));
}
export function isGenericBusinessRule(value: string): boolean {
  return GENERIC_BUSINESS_RULE_PATTERN.test(normalizeQualityPhrase(value));
}
export function isNegativeBehaviorText(value: string): boolean {
  return NEGATIVE_BEHAVIOR_PATTERN.test(normalizeQualityPhrase(value));
}
export function isPositiveCoreText(value: string): boolean {
  return POSITIVE_CORE_PATTERN.test(normalizeQualityPhrase(value));
}
export function isReferenceImplementationText(value: string): boolean {
  return REFERENCE_IMPLEMENTATION_PATTERN.test(normalizeQualityPhrase(value));
}

function isExecutableReproText(value: string): boolean {
  const text = normalizeQualityPhrase(value);
  return (
    /\bgiven\b.+\bwhen\b.+\bthen\b/i.test(text) ||
    /\bsetup\b.+\baction\b.+\bexpected\b/i.test(text) ||
    (/\bwhen\b.+\bthen\b/i.test(text) && isNegativeBehaviorText(text))
  );
}

function unresolvedQuestionText(value: string): string {
  const text = normalizeQualityPhrase(value);
  if (!text) return "";
  if (/\?$/.test(text)) return normalizeQualitySentence(text);
  return normalizeQualitySentence(`Confirm unresolved behavior: ${text}`);
}
function referenceQuestionText(value: string): string {
  const text = normalizeQualityPhrase(value);
  if (!text) return "";
  return normalizeQualitySentence(
    `Confirm whether this reference implementation is authoritative: ${text}`
  );
}

function executableScenarioFromNegativePath(value: string): string | null {
  const text = normalizeQualityPhrase(value);
  if (!text || isUnresolvedRequirementText(text)) return null;
  if (!isNegativeBehaviorText(text)) return null;
  if (
    !/[A-Z]{2,}-?\d+|\b(GET|POST|PUT|PATCH|DELETE)\b\s+\/|\/[A-Za-z0-9_{}./-]+|\b\d{3}\b|failureReason|actionResult|OrderID|GUID|Transaction Number|mod_[a-z0-9_]+/i.test(
      text
    )
  ) {
    return null;
  }

  return [
    `Given the source condition applies: ${text}`,
    "When the relevant request or workflow step is exercised",
    "Then verify the source-defined response or persisted state",
  ].join(" ");
}

function splitResolvedItems(args: {
  values: string[];
  openQuestions: string[];
  maxOpenQuestions: number;
}): string[] {
  const resolved: string[] = [];

  for (const value of args.values) {
    if (isReferenceImplementationText(value)) {
      appendUniqueByPlacementKey(
        args.openQuestions,
        referenceQuestionText(value),
        args.maxOpenQuestions
      );
      continue;
    }

    if (isUnresolvedRequirementText(value)) {
      appendUniqueByPlacementKey(
        args.openQuestions,
        unresolvedQuestionText(value),
        args.maxOpenQuestions
      );
      continue;
    }

    resolved.push(value);
  }

  return resolved;
}

function removeItemsByPlacementKey(
  values: string[],
  blockedValues: string[]
): string[] {
  const blocked = new Set(blockedValues.map(placementKey).filter(Boolean));
  return values.filter((value) => {
    const key = placementKey(value);
    return key && !blocked.has(key);
  });
}

function unique(values: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const text = normalizeQualityPhrase(value);
    if (!text) continue;

    const key = placementKey(text);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }

  return out;
}

export function normalizeRequirementQuality(
  sections: RequirementQualitySections
): RequirementQualitySections {
  let openQuestionsClarifications = unique(
    sections.openQuestionsClarifications.map(normalizeQualitySentence),
    8
  );

  let inScope = splitResolvedItems({
    values: unique(sections.inScope, 12),
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  });
  let functionalScope = splitResolvedItems({
    values: unique(sections.functionalScope, 12),
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  });
  let acceptanceCriteria = splitResolvedItems({
    values: unique(sections.acceptanceCriteria.map(normalizeQualitySentence), 12),
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  });
  let businessRules = splitResolvedItems({
    values: unique(sections.businessRules.map(normalizeQualitySentence), 12),
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  }).filter((item) => !isGenericBusinessRule(item) && !isTestActivityText(item));

  functionalScope = removeItemsByPlacementKey(functionalScope, businessRules);
  inScope = removeItemsByPlacementKey(inScope, businessRules);
  functionalScope = removeItemsByPlacementKey(functionalScope, acceptanceCriteria);
  inScope = removeItemsByPlacementKey(inScope, acceptanceCriteria);
  let edgeCasesNegativePaths = splitResolvedItems({
    values: unique(sections.edgeCasesNegativePaths.map(normalizeQualitySentence), 12),
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  }).filter((item) => isNegativeBehaviorText(item) && !isPositiveCoreText(item));
  let riskAreas = splitResolvedItems({
    values: unique(sections.riskAreas, 8),
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  });

  const functionalScopeTestActivities = functionalScope.filter(isTestActivityText);
  functionalScope = functionalScope.filter((item) => !isTestActivityText(item));
  inScope = inScope.filter((item) => !isTestActivityText(item));

  edgeCasesNegativePaths = removeItemsByPlacementKey(
    edgeCasesNegativePaths,
    acceptanceCriteria
  );
  riskAreas = removeItemsByPlacementKey(riskAreas, [
    ...acceptanceCriteria,
    ...edgeCasesNegativePaths,
  ]);

  let coverageTargets = unique(
    [
      ...sections.coverageTargets,
      ...functionalScopeTestActivities.map(
        (item) => `Test focus: ${normalizeQualityPhrase(item)}`
      ),
    ],
    8
  );
  coverageTargets = splitResolvedItems({
    values: coverageTargets,
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  });
  coverageTargets = removeItemsByPlacementKey(coverageTargets, [
    ...acceptanceCriteria,
    ...edgeCasesNegativePaths,
    ...riskAreas,
  ]);

  let minimalReproScenarios = unique(
    sections.minimalReproScenarios
      .filter(isExecutableReproText)
      .map(normalizeQualitySentence),
    8
  );

  if (!minimalReproScenarios.length) {
    minimalReproScenarios = unique(
      edgeCasesNegativePaths
        .map(executableScenarioFromNegativePath)
        .filter((item): item is string => item !== null),
      8
    );
  }

  minimalReproScenarios = splitResolvedItems({
    values: minimalReproScenarios,
    openQuestions: openQuestionsClarifications,
    maxOpenQuestions: 8,
  });
  minimalReproScenarios = removeItemsByPlacementKey(minimalReproScenarios, [
    ...acceptanceCriteria,
    ...edgeCasesNegativePaths,
    ...riskAreas,
  ]);

  return {
    inScope,
    functionalScope,
    businessRules,
    acceptanceCriteria,
    edgeCasesNegativePaths,
    riskAreas,
    coverageTargets,
    minimalReproScenarios,
    openQuestionsClarifications,
  };
}

export function normalizeRequirementPatchQuality(
  patch: Partial<RefinedRequirement>
): Partial<RefinedRequirement> {
  const normalized = normalizeRequirementQuality({
    inScope: patch.inScope ?? [],
    functionalScope: patch.functionalScope ?? [],
    businessRules: patch.businessRules ?? [],
    acceptanceCriteria: patch.acceptanceCriteria ?? [],
    edgeCasesNegativePaths: patch.edgeCasesNegativePaths ?? patch.edgeCases ?? [],
    riskAreas: patch.riskAreas ?? patch.riskFocus ?? [],
    coverageTargets: patch.coverageTargets ?? [],
    minimalReproScenarios: patch.minimalReproScenarios ?? [],
    openQuestionsClarifications:
      patch.openQuestionsClarifications ?? patch.openQuestions ?? [],
  });

  return {
    ...patch,
    inScope: normalized.inScope,
    functionalScope: normalized.functionalScope,
    businessRules: normalized.businessRules,
    acceptanceCriteria: normalized.acceptanceCriteria,
    edgeCases: normalized.edgeCasesNegativePaths,
    edgeCasesNegativePaths: normalized.edgeCasesNegativePaths,
    riskAreas: normalized.riskAreas,
    riskFocus: normalized.riskAreas,
    coverageTargets: normalized.coverageTargets,
    minimalReproScenarios: normalized.minimalReproScenarios,
    openQuestions: normalized.openQuestionsClarifications,
    openQuestionsClarifications: normalized.openQuestionsClarifications,
  };
}
