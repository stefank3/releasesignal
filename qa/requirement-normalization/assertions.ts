import { expect } from "@playwright/test";
import type { RefinedRequirement } from "../../lib/chat/artifact";

type SectionName = keyof Pick<
  RefinedRequirement,
  | "functionalScope"
  | "businessRules"
  | "acceptanceCriteria"
  | "edgeCasesNegativePaths"
  | "riskAreas"
  | "coverageTargets"
  | "minimalReproScenarios"
  | "openQuestionsClarifications"
  | "outOfScope"
>;

const sectionNames: SectionName[] = [
  "functionalScope",
  "businessRules",
  "acceptanceCriteria",
  "edgeCasesNegativePaths",
  "riskAreas",
  "coverageTargets",
  "minimalReproScenarios",
  "openQuestionsClarifications",
  "outOfScope",
];

function values(requirement: RefinedRequirement, section: SectionName): string[] {
  return requirement[section] ?? [];
}

function textOf(requirement: RefinedRequirement): string {
  return [
    requirement.objective ?? "",
    requirement.context ?? "",
    ...sectionNames.flatMap((section) => values(requirement, section)),
  ]
    .join("\n")
    .toLowerCase();
}

function placementKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(coverage for|risk coverage for|scope coverage for):\s*/i, "")
    .replace(/^(test focus|test acceptance flow|prove acceptance criterion):\s*/i, "")
    .replace(/^(validate business rule|validate in-scope behavior):\s*/i, "")
    .replace(/^(cover edge case|cover negative path):\s*/i, "")
    .replace(/[^a-z0-9_{}./'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expectContains(requirement: RefinedRequirement, term: string): void {
  expect(textOf(requirement), `Expected artifact to contain: ${term}`).toContain(
    term.toLowerCase()
  );
}

export function expectNotContains(
  requirement: RefinedRequirement,
  term: string
): void {
  expect(textOf(requirement), `Expected artifact not to contain: ${term}`).not.toContain(
    term.toLowerCase()
  );
}

export function expectSectionContains(
  requirement: RefinedRequirement,
  section: SectionName,
  term: string
): void {
  expect(
    values(requirement, section).join("\n").toLowerCase(),
    `Expected ${section} to contain: ${term}`
  ).toContain(term.toLowerCase());
}

export function expectSectionNotContains(
  requirement: RefinedRequirement,
  section: SectionName,
  term: string
): void {
  expect(
    values(requirement, section).join("\n").toLowerCase(),
    `Expected ${section} not to contain: ${term}`
  ).not.toContain(term.toLowerCase());
}

export function expectNoDuplicatePlacement(requirement: RefinedRequirement): void {
  const seen = new Map<string, string>();

  for (const section of sectionNames) {
    for (const item of values(requirement, section)) {
      const key = placementKey(item);
      if (!key) continue;
      expect(
        seen.has(key),
        `Duplicate placement key "${key}" in ${seen.get(key)} and ${section}`
      ).toBe(false);
      seen.set(key, section);
    }
  }
}

export function expectUnresolvedOnlyInOpenQuestions(
  requirement: RefinedRequirement
): void {
  const unresolved =
    /\b(confirm (whether|if)|unclear|tbd|pending|which .*?|how .*?|what .*?)\b/i;

  for (const section of sectionNames.filter(
    (name) => name !== "openQuestionsClarifications"
  )) {
    for (const item of values(requirement, section)) {
      expect(item, `Unresolved text leaked into ${section}`).not.toMatch(unresolved);
    }
  }
}

export function expectTestActivityOnlyInCoverage(
  requirement: RefinedRequirement
): void {
  const testActivity = /\b(testing|e2e testing|tester should|qa should|test ideas?)\b/i;

  for (const section of sectionNames.filter(
    (name) => name !== "coverageTargets"
  )) {
    for (const item of values(requirement, section)) {
      expect(item, `Test activity leaked into ${section}`).not.toMatch(testActivity);
    }
  }
}

export function expectNoGenericMinimalRepro(
  requirement: RefinedRequirement
): void {
  for (const item of requirement.minimalReproScenarios ?? []) {
    expect(item).not.toMatch(/given the user has access when they perform the action then/i);
    expect(item).not.toMatch(/verify expected behavior/i);
    expect(item).toMatch(/\b(given|when|then|setup|action|expected)\b/i);
  }
}

export function expectDistinctIdentifiers(requirement: RefinedRequirement): void {
  expectContains(requirement, "GUID");
  expectContains(requirement, "OrderID");
  expectContains(requirement, "Transaction Number");
  expectNotContains(requirement, "OrderID = Transaction Number");
  expectNotContains(requirement, "OrderID is the Transaction Number");
}
