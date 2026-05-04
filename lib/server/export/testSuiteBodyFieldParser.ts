// lib/server/export/testSuiteBodyFieldParser.ts
// M15 Generic Suite Export Layer:
// Deterministic body fallback parser for export-only structured fields.
//
// Purpose:
// If an edited TestCase preserved body text but lost structured arrays,
// exports can still produce useful JSON/CSV without mutating artifacts.
//
// This parser is export-only.
// It does not update persistence.
// It does not infer product truth beyond explicit section labels.
// It does not use AI.

import { normalizeMultilineText, normalizeWhitespace } from "@/lib/chat/artifact";

export type ParsedExportBodyFields = {
  type: string | null;
  priority: string | null;
  preconditions: string[];
  steps: string[];
  expectedResults: string[];
};

const SECTION_LABELS = [
  "Type",
  "Priority",
  "Preconditions",
  "Test Steps",
  "Steps",
  "Expected Result",
  "Expected Results",
  "Tags",
  "Notes",
] as const;

const SECTION_HEADER_REGEX =
  /^\s*(Type|Priority|Preconditions|Test Steps|Steps|Expected Result|Expected Results|Tags|Notes)\s*:\s*(.*)$/i;

function normalizeSectionLabel(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function isSectionHeader(line: string): boolean {
  return SECTION_HEADER_REGEX.test(line);
}

function cleanListItem(value: string): string {
  return normalizeMultilineText(value)
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function readSingleLineField(body: string, label: "Type" | "Priority"): string | null {
  const lines = normalizeMultilineText(body).split("\n");

  for (const line of lines) {
    const match = line.match(SECTION_HEADER_REGEX);
    if (!match) continue;

    const currentLabel = normalizeSectionLabel(match[1]);
    if (currentLabel !== normalizeSectionLabel(label)) continue;

    const value = normalizeWhitespace(match[2] ?? "");
    return value || null;
  }

  return null;
}

function readListSection(body: string, labels: string[]): string[] {
  const wanted = new Set(labels.map((label) => normalizeSectionLabel(label)));
  const lines = normalizeMultilineText(body).split("\n");

  const out: string[] = [];
  let collecting = false;

  for (const line of lines) {
    const headerMatch = line.match(SECTION_HEADER_REGEX);

    if (headerMatch) {
      const currentLabel = normalizeSectionLabel(headerMatch[1]);
      const inlineValue = cleanListItem(headerMatch[2] ?? "");

      if (wanted.has(currentLabel)) {
        collecting = true;
        if (inlineValue) out.push(inlineValue);
        continue;
      }

      if (collecting) break;
    }

    if (!collecting) continue;
    if (isSectionHeader(line)) break;

    const item = cleanListItem(line);
    if (item) out.push(item);
  }

  return Array.from(new Set(out));
}

export function parseExportFieldsFromBody(body: string): ParsedExportBodyFields {
  const normalizedBody = normalizeMultilineText(body);

  if (!normalizedBody) {
    return {
      type: null,
      priority: null,
      preconditions: [],
      steps: [],
      expectedResults: [],
    };
  }

  return {
    type: readSingleLineField(normalizedBody, "Type"),
    priority: readSingleLineField(normalizedBody, "Priority"),
    preconditions: readListSection(normalizedBody, ["Preconditions"]),
    steps: readListSection(normalizedBody, ["Test Steps", "Steps"]),
    expectedResults: readListSection(normalizedBody, [
      "Expected Result",
      "Expected Results",
    ]),
  };
}