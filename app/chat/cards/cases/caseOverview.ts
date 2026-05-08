import { normalizeWhitespace } from "@/lib/chat/artifact";

export type CaseOverview = {
  type: string | null;
  priority: string | null;
  preconditions: string | null;
  firstStep: string | null;
  expected: string | null;
};

function readSingleLineField(body: string, label: string): string | null {
  const pattern = new RegExp(`(?:^|\n)\s*${label}\s*:\s*(.+)`, "i");
  const match = String(body ?? "").match(pattern);
  const value = normalizeWhitespace(match?.[1] ?? "");
  return value || null;
}

function readSectionLines(body: string, labels: string[]): string[] {
  const lines = String(body ?? "").replace(/\r/g, "").split("\n");
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    const isMatch = normalizedLabels.some((label) => line.startsWith(`${label}:`));
    if (isMatch) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) return [];

  const values: string[] = [];
  const sectionHeaderRegex =
    /^\s*(type|priority|preconditions|test steps|steps|expected result|expected results)\s*:/i;

  const firstLine = lines[startIndex];
  const inlineValue = normalizeWhitespace(firstLine.replace(/^[^:]+:\s*/i, ""));
  if (inlineValue) values.push(inlineValue);

  for (let i = startIndex + 1; i < lines.length; i++) {
    const nextLine = lines[i];
    if (sectionHeaderRegex.test(nextLine)) break;

    const normalizedLine = normalizeWhitespace(
      nextLine.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "")
    );

    if (normalizedLine) values.push(normalizedLine);
  }

  return values;
}

export function buildCaseOverview(body: string): CaseOverview {
  const type = readSingleLineField(body, "Type");
  const priority = readSingleLineField(body, "Priority");
  const preconditions = readSectionLines(body, ["Preconditions"]).join(" • ") || null;
  const firstStep = readSectionLines(body, ["Test Steps", "Steps"])[0] ?? null;
  const expected =
    readSectionLines(body, ["Expected Result", "Expected Results"])[0] ?? null;

  return {
    type,
    priority,
    preconditions,
    firstStep,
    expected,
  };
}

export function truncateText(value: string | null, max = 180): string {
  const text = normalizeWhitespace(value ?? "");
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}
