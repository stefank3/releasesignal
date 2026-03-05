// lib/chat/json.ts
export function stripCodeFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return t;
}

/**
 * Extract first {...} JSON block from a mixed response.
 * Tolerates prose around JSON, fenced JSON, trailing explanations.
 */
export function extractJsonObject(raw: string): string {
  const cleaned = stripCodeFences(raw).trim();

  const start = cleaned.indexOf("{");
  if (start < 0) return cleaned;

  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (depth === 0) return cleaned.slice(start, i + 1);
  }

  const end = cleaned.lastIndexOf("}");
  if (end > start) return cleaned.slice(start, end + 1);

  return cleaned;
}