import type { RefinedRequirement } from "@/lib/chat/artifact";

const CONCURRENCY_TOPIC_PATTERN =
  /\b(concurrency|concurrent|simultaneous|parallel|race[- ]condition|duplicate requests?|same orderid|only one transaction|locking)\b/i;
const DETERMINISTIC_CONCURRENCY_OUTCOME_PATTERN =
  /\b(only one|first|single)\b.{0,80}\b(accepted|succeeds?|committed)\b|\b(others?|subsequent|remaining)\b.{0,80}\b(rejected|fail|409)\b|\bdeterministic(?:ally)?\b/i;
const UNRESOLVED_PATTERN =
  /\b(unresolved|unknown|open question|confirm|clarif|must not be assumed|do not assume)\b/i;
const IDENTIFIER_CORRECTION_PATTERN =
  /\borderid\b.{0,80}\b(instead of|rather than|not guid|guid is incorrect)\b|\b(guid is incorrect|instead of guid|rather than guid)\b.{0,80}\borderid\b/i;
const GUID_AUTHORITY_PATTERN =
  /\bguid\b.{0,80}\b(deduplicat|authoritative|identifier)\b|\b(deduplicat|authoritative)\b.{0,80}\bguid\b/i;
const FALSE_BRANCH_CORRECTION_PATTERN =
  /\bdeletenctfcorderdata\s*=\s*false\b.{0,160}\b(remain unchanged|not deleted|preserv)/i;
const ALWAYS_DELETE_PATTERN =
  /\b(always|regardless|unconditionally)\b.{0,100}\b(delet|remov)|\b(delet|remov)\w*\b.{0,100}\b(always|regardless|unconditionally)\b/i;
const OPTIONAL_CLEANUP_ENTITY_PATTERN =
  /\b(mod_nc_tfc_orders|mod_error_retry|optional (?:cleanup )?tables?)\b/i;
const GENERIC_REPRO_PATTERN =
  /\bgiven the source condition applies\b|\bwhen the relevant workflow is exercised\b|\bthen verify the source-defined response\b/i;
const EXCLUSION_VERB_PATTERN =
  /\b(out of scope|not in scope|excluded|remove)\b/i;
const CONTRASTIVE_CONJUNCTION_PATTERN = /\b(but|however|although)\b/i;

type ExclusionTopicFamily = {
  name:
    | "concurrency"
    | "loggingMonitoring"
    | "rollbackAtomicity"
    | "paginationBatchSize"
    | "pathBodyIdMatching";
  topicPattern: RegExp;
  activePattern: RegExp;
  exclusionWindow: number;
};

const EXCLUSION_TOPIC_FAMILIES: ExclusionTopicFamily[] = [
  {
    name: "concurrency",
    topicPattern:
      /\b(concurrency (?:control|handling)|race[- ]condition handling|simultaneous restarts? handling|concurrent requests? handling|parallel processing handling|locking)\b/i,
    activePattern:
      /\b(concurrency issues?|concurrency handling|handle concurrency safely|concurrency-safe|safe handling of concurrent requests?|race[- ]conditions?|initiated simultaneously|simultaneous restarts?|multiple simultaneous restarts?|parallel processing|same second|same time|locking|only one transaction|duplicate requests?)\b|\bconcurrent\b.{0,50}\brequests?\b|\bsimultaneous\b.{0,50}\brequests?\b/i,
    exclusionWindow: 220,
  },
  {
    name: "loggingMonitoring",
    topicPattern:
      /\b(logging|monitoring|observability|visibility of decisions|audit trails?|auditing)\b/i,
    activePattern:
      /\b(logging|monitoring|observability|visibility of decisions|audit trails?|auditing)\b/i,
    exclusionWindow: 150,
  },
  {
    name: "rollbackAtomicity",
    topicPattern:
      /\b(rollback|atomicity|transaction rollback|compensation|partial rollback|transactional guarantees?)\b/i,
    activePattern:
      /\b(rollback|atomicity|compensation|partial rollback|transactional guarantees?)\b/i,
    exclusionWindow: 150,
  },
  {
    name: "paginationBatchSize",
    topicPattern:
      /\b(pagination|page size|batch size|batch-size|batching limits?)\b/i,
    activePattern:
      /\b(pagination|page size|batch size|batch-size|batching limits?)\b/i,
    exclusionWindow: 150,
  },
  {
    name: "pathBodyIdMatching",
    topicPattern:
      /\b(path\/body (?:id|identifier) (?:matching|comparison)|body (?:identifier|id|field|[a-z][\w-]*) must match path (?:identifier|parameter|id|field|[a-z][\w-]*)|request body id must match path parameter|path\/body identifier mismatch|path id and body id mismatch|mismatched path\/body (?:id|identifier))\b/i,
    activePattern:
      /\b(path\/body (?:id|identifier) (?:matching|comparison)|body (?:identifier|id|field|[a-z][\w-]*) must match path (?:identifier|parameter|id|field|[a-z][\w-]*)|request body id must match path parameter|path\/body identifier mismatch|path id and body id mismatch|mismatched path\/body (?:id|identifier))\b/i,
    exclusionWindow: 150,
  },
];

type StringArrayKey =
  | "inScope"
  | "outOfScope"
  | "integrations"
  | "riskFocus"
  | "functionalScope"
  | "businessRules"
  | "acceptanceCriteria"
  | "edgeCases"
  | "edgeCasesNegativePaths"
  | "nonFunctionalConstraints"
  | "testStrategyHooks"
  | "riskAreas"
  | "coverageTargets"
  | "minimalReproScenarios"
  | "openQuestions"
  | "openQuestionsClarifications";

const ACTIVE_SECTION_KEYS: StringArrayKey[] = [
  "inScope",
  "functionalScope",
  "businessRules",
  "acceptanceCriteria",
  "edgeCases",
  "edgeCasesNegativePaths",
  "riskAreas",
  "riskFocus",
  "coverageTargets",
  "minimalReproScenarios",
];

const QUESTION_SECTION_KEYS: StringArrayKey[] = [
  "openQuestions",
  "openQuestionsClarifications",
];

function patchValues(patch: Partial<RefinedRequirement>): string[] {
  return [
    patch.objective,
    patch.context,
    ...(patch.inScope ?? []),
    ...(patch.outOfScope ?? []),
    ...(patch.functionalScope ?? []),
    ...(patch.businessRules ?? []),
    ...(patch.acceptanceCriteria ?? []),
    ...(patch.edgeCases ?? []),
    ...(patch.edgeCasesNegativePaths ?? []),
    ...(patch.nonFunctionalConstraints ?? []),
    ...(patch.riskAreas ?? []),
    ...(patch.riskFocus ?? []),
    ...(patch.coverageTargets ?? []),
    ...(patch.minimalReproScenarios ?? []),
    ...(patch.openQuestions ?? []),
    ...(patch.openQuestionsClarifications ?? []),
  ].filter((value): value is string => Boolean(value));
}

function questionValues(patch: Partial<RefinedRequirement>): string[] {
  return [
    ...(patch.openQuestions ?? []),
    ...(patch.openQuestionsClarifications ?? []),
  ];
}

function filterSection(
  requirement: RefinedRequirement,
  key: StringArrayKey,
  keep: (value: string) => boolean
): void {
  const values = requirement[key];
  if (!Array.isArray(values)) return;
  (requirement as Record<StringArrayKey, string[] | undefined>)[key] = values.filter(keep);
}

function matchRanges(
  value: string,
  pattern: RegExp
): { start: number; end: number }[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  return [...value.matchAll(matcher)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function hasConnectedExclusionSignal(
  value: string,
  family: ExclusionTopicFamily
): boolean {
  const topics = matchRanges(value, family.topicPattern);
  const exclusions = matchRanges(value, EXCLUSION_VERB_PATTERN);

  for (const topic of topics) {
    for (const exclusion of exclusions) {
      const betweenStart =
        topic.end <= exclusion.start ? topic.end : exclusion.end;
      const betweenEnd =
        topic.end <= exclusion.start ? exclusion.start : topic.start;
      const between = value.slice(betweenStart, betweenEnd);

      if (between.length > family.exclusionWindow) {
        continue;
      }
      if (CONTRASTIVE_CONJUNCTION_PATTERN.test(between)) {
        continue;
      }
      return true;
    }
  }

  return false;
}

export function reconcileExistingRequirementForPatch(args: {
  existing: RefinedRequirement;
  patch: Partial<RefinedRequirement>;
}): RefinedRequirement {
  const reconciled: RefinedRequirement = { ...args.existing };
  const values = patchValues(args.patch);
  const questions = questionValues(args.patch);
  const outOfScope = args.patch.outOfScope ?? [];
  const scopeDecisionValues = [
    args.patch.context,
    ...outOfScope,
    ...(args.patch.nonFunctionalConstraints ?? []),
  ].filter((value): value is string => Boolean(value));

  const excludedTopicFamilies = EXCLUSION_TOPIC_FAMILIES.filter((family) =>
    scopeDecisionValues.some((value) =>
      hasConnectedExclusionSignal(value, family)
    )
  );
  const concurrencyFullyExcluded = excludedTopicFamilies.some(
    (family) => family.name === "concurrency"
  );
  const concurrencyUnresolved =
    !concurrencyFullyExcluded &&
    values.some(
      (value) =>
        CONCURRENCY_TOPIC_PATTERN.test(value) && UNRESOLVED_PATTERN.test(value)
    ) &&
    (questions.some((value) => CONCURRENCY_TOPIC_PATTERN.test(value)) ||
      outOfScope.some(
        (value) =>
          CONCURRENCY_TOPIC_PATTERN.test(value) &&
          DETERMINISTIC_CONCURRENCY_OUTCOME_PATTERN.test(value)
      ));
  const identifierCorrected = values.some((value) =>
    IDENTIFIER_CORRECTION_PATTERN.test(value)
  );
  const falseCleanupBranchCorrected = values.some((value) =>
    FALSE_BRANCH_CORRECTION_PATTERN.test(value)
  );
  const hasDirective =
    concurrencyFullyExcluded ||
    concurrencyUnresolved ||
    identifierCorrected ||
    falseCleanupBranchCorrected;

  for (const key of ACTIVE_SECTION_KEYS) {
    filterSection(reconciled, key, (value) => {
      if (
        excludedTopicFamilies.some((family) => family.activePattern.test(value))
      ) {
        return false;
      }
      if (
        concurrencyUnresolved &&
        CONCURRENCY_TOPIC_PATTERN.test(value) &&
        DETERMINISTIC_CONCURRENCY_OUTCOME_PATTERN.test(value)
      ) {
        return false;
      }
      if (identifierCorrected && GUID_AUTHORITY_PATTERN.test(value)) {
        return false;
      }
      if (
        falseCleanupBranchCorrected &&
        OPTIONAL_CLEANUP_ENTITY_PATTERN.test(value) &&
        ALWAYS_DELETE_PATTERN.test(value)
      ) {
        return false;
      }
      if (
        key === "minimalReproScenarios" &&
        hasDirective &&
        GENERIC_REPRO_PATTERN.test(value)
      ) {
        return false;
      }
      return true;
    });
  }

  if (excludedTopicFamilies.length) {
    for (const key of QUESTION_SECTION_KEYS) {
      filterSection(
        reconciled,
        key,
        (value) =>
          !excludedTopicFamilies.some((family) => family.activePattern.test(value))
      );
    }
  }

  return reconciled;
}
