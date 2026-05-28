"use client";

type RequirementSection = {
  title: string;
  lines: string[];
  isDocumentTitle?: boolean;
};

type Props = {
  text: string;
  resolvedTheme?: "light" | "dark";
};

const KNOWN_HEADINGS = new Set([
  "objective",
  "context / constraints",
  "context",
  "functional scope",
  "business rules",
  "acceptance criteria",
  "edge cases / negative paths",
  "edge cases",
  "non-functional constraints",
  "test strategy hooks",
  "risk areas",
  "coverage targets",
  "minimal repro scenarios",
  "open questions / clarifications",
  "open questions",
]);

function normalizeHeading(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.endsWith(":")) return null;

  const title = trimmed.slice(0, -1).trim();
  if (!KNOWN_HEADINGS.has(title.toLowerCase())) return null;

  return title;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;

  return lines.slice(start, end);
}

function parseRequirementSections(text: string): RequirementSection[] | null {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  const sections: RequirementSection[] = [];
  let current: RequirementSection | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const linesToKeep = trimBlankEdges(current.lines);
    if (current.isDocumentTitle || linesToKeep.length > 0) {
      sections.push({ ...current, lines: linesToKeep });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "Refined Technical Requirement") {
      pushCurrent();
      current = { title: trimmed, lines: [], isDocumentTitle: true };
      continue;
    }

    const heading = normalizeHeading(line);
    if (heading) {
      pushCurrent();
      current = { title: heading, lines: [] };
      continue;
    }

    if (!current) {
      current = { title: "Requirement notes", lines: [] };
    }

    current.lines.push(line);
  }

  pushCurrent();

  const contentSections = sections.filter((section) => !section.isDocumentTitle);
  return contentSections.length >= 2 ? sections : null;
}

function PlainRequirementText({
  text,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";

  return (
    <pre
      style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        fontSize: 12,
        lineHeight: 1.5,
        fontFamily: "inherit",
        color: isDark ? "#ffffff" : "#0f172a",
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)",
        border: isDark
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(15,23,42,0.08)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      {text}
    </pre>
  );
}

export function RequirementContentRenderer({
  text,
  resolvedTheme = "dark",
}: Props) {
  const isDark = resolvedTheme === "dark";
  const sections = parseRequirementSections(text);

  if (!sections) {
    return <PlainRequirementText text={text} resolvedTheme={resolvedTheme} />;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
      }}
    >
      {sections.map((section, index) => {
        if (section.isDocumentTitle) {
          return (
            <div
              key={`${section.title}-${index}`}
              style={{
                fontSize: 13,
                fontWeight: 950,
                color: isDark ? "#ffffff" : "#0f172a",
              }}
            >
              {section.title}
            </div>
          );
        }

        return (
          <section
            key={`${section.title}-${index}`}
            style={{
              border: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: 12,
              background: isDark
                ? "rgba(255,255,255,0.03)"
                : "rgba(15,23,42,0.025)",
              display: "grid",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 950,
                color: isDark ? "#ffffff" : "#0f172a",
              }}
            >
              {section.title}
            </div>

            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: 12,
                lineHeight: 1.55,
                color: isDark ? "rgba(255,255,255,0.88)" : "rgba(15,23,42,0.86)",
              }}
            >
              {section.lines.join("\n")}
            </pre>
          </section>
        );
      })}
    </div>
  );
}
