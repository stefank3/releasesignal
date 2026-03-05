// lib/chat/suggestions.ts
import type { CoachResult } from "@/lib/framework/reviewSchema";

export type CoachSuggestions = {
  groups: { label: string; type: "single" | "multi"; options: string[] }[];
  template: string;
};

export function buildCoachSuggestionsFromCoach(coach: CoachResult): CoachSuggestions | null {
  const clarifications = (coach.optionalClarifications ?? [])
    .map((q) => (q ?? "").trim())
    .filter((q) => q.length > 0)
    .slice(0, 3);

  if (clarifications.length === 0) return null;

  type Kind = "objective" | "risk" | "scope" | "success" | "env" | "other";

  const classify = (q: string): Kind => {
    const t = q.toLowerCase();
    if (t.includes("objective") || t.includes("goal") || t.includes("outcome") || t.includes("priority")) return "objective";
    if (t.includes("risk") || t.includes("failure") || t.includes("worst case") || t.includes("worst-case")) return "risk";
    if (t.includes("scope") || t.includes("constraint") || t.includes("limit") || t.includes("in scope") || t.includes("out of scope")) return "scope";
    if (t.includes("success") || t.includes("definition of done") || t.includes("acceptance")) return "success";
    if (t.includes("environment") || t.includes("env") || t.includes("where run") || t.includes("which env")) return "env";
    return "other";
  };

  const groups: CoachSuggestions["groups"] = clarifications.map((q) => {
    const labelRaw = q.replace(/^[-•\d.)\s]+/, "").trim();
    const label = labelRaw.length > 64 ? labelRaw.slice(0, 61) + "..." : labelRaw || "Clarification";

    const kind = classify(q);

    const options =
      kind === "objective"
        ? [
            "Ship this feature safely in the next release",
            "Stabilize critical paths and regressions",
            "Explore unknown risk areas first",
            "Validate key integrations and contracts",
            "Not fully defined yet – I need your proposal",
          ]
        : kind === "risk"
          ? [
              "Auth / session / security",
              "Permissions / RBAC / roles",
              "Data integrity and migrations",
              "External integrations / contracts",
              "Performance / scalability / latency",
              "UX / flows / accessibility",
              "Not sure – highlight what you see as highest risk",
            ]
          : kind === "scope"
            ? [
                "Only this feature in isolation",
                "End-to-end flows including dependencies",
                "Happy-path plus a few critical edges",
                "Full regression on impacted areas",
                "Not decided yet – suggest a scope",
              ]
            : kind === "success"
              ? [
                  "Ready for release with no critical issues",
                  "Key risks documented and mitigated",
                  "Smoke suite green and reliable in CI",
                  "Stakeholders sign off on coverage",
                  "I need help defining clear success criteria",
                ]
              : kind === "env"
                ? ["Local / dev only", "Staging and pre-prod", "Pre-prod mirroring production", "Production shadow traffic only", "Environments are not fixed yet"]
                : ["We already have this well defined", "We have a rough idea but it’s fuzzy", "We haven’t decided yet", "Out of scope for now", "I need you to propose a default"];

    return { label, type: "single", options };
  });

  const lines: string[] = [];
  lines.push("Answers to your clarifications (to refine the strategy):");
  for (const g of groups) lines.push(`- ${g.label}: {${g.label}}`);
  lines.push("");
  lines.push("Scope / Constraints (optional):");
  lines.push("- ");
  lines.push("Success Criteria (optional):");
  lines.push("- ");

  return { groups, template: lines.join("\n") };
}

export function buildFallbackCoachSuggestions(): CoachSuggestions {
  return {
    groups: [
      {
        label: "Objective",
        type: "single",
        options: [
          "Ship safely in the next release",
          "Reduce regression risk on critical flows",
          "Explore unknown areas and edge cases",
          "Prepare for beta / stakeholder sign-off",
          "Not fully defined yet – need your proposal",
        ],
      },
      {
        label: "Risk focus",
        type: "multi",
        options: [
          "Auth / session / security",
          "Permissions / RBAC / roles",
          "Data integrity and migrations",
          "External integrations / contracts",
          "Performance / scalability",
          "UX / flows / accessibility",
          "Not sure – highlight what you see as highest risk",
        ],
      },
      {
        label: "Constraints",
        type: "multi",
        options: ["Tight deadline", "Limited QA capacity", "Limited environment access", "No production data allowed", "Change freeze window"],
      },
    ],
    template: [
      "Objective: {Objective}",
      "Risk focus: {Risk focus}",
      "Constraints (optional): {Constraints}",
      "Scope / Constraints (optional):",
      "- ",
      "Success Criteria (optional):",
      "- ",
    ].join("\n"),
  };
}