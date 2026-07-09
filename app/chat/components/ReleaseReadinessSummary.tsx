// app/chat/components/ReleaseReadinessSummary.tsx
// M17 Release Readiness:
// Read-only UI summary for deterministic release readiness.
// All readiness logic must stay in lib/release-readiness.

import type { ReleaseReadinessSummary as ReleaseReadinessSummaryModel } from "@/lib/release-readiness/releaseReadinessTypes";

type ReleaseReadinessSummaryProps = {
  readiness: ReleaseReadinessSummaryModel;
  commandCenter?: boolean;
  resolvedTheme?: "light" | "dark";
};

type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

const STATUS_LABELS: Record<ReleaseReadinessSummaryModel["status"], string> = {
  insufficient_data: "Not enough data yet",
  not_ready: "Not Ready",
  weak: "Weak Readiness",
  partial: "Partial Readiness",
  ready_with_risk: "Ready With Risk",
  ready: "Ready",
  blocked: "Blocked",
};

const CONFIDENCE_LABELS: Record<
  ReleaseReadinessSummaryModel["confidence"],
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "-";
}

function getStatusTone(status: ReleaseReadinessSummaryModel["status"]): Tone {
  switch (status) {
    case "ready":
      return "positive";
    case "ready_with_risk":
    case "partial":
    case "weak":
      return "warning";
    case "not_ready":
    case "blocked":
      return "negative";
    case "insufficient_data":
    default:
      return "neutral";
  }
}

function getReadinessBand(status: ReleaseReadinessSummaryModel["status"]): string {
  switch (status) {
    case "ready":
    case "ready_with_risk":
      return "Strong";
    case "partial":
    case "weak":
      return "Moderate";
    case "not_ready":
    case "blocked":
    case "insufficient_data":
    default:
      return "Low";
  }
}

function getToneStyle(tone: Tone, isDark: boolean): {
  border: string;
  background: string;
  color: string;
} {
  switch (tone) {
    case "positive":
      return {
        border: isDark ? "1px solid #7CC08A" : "1px solid #2F7A44",
        background: isDark ? "rgba(124,192,138,0.12)" : "rgba(47,122,68,0.08)",
        color: isDark ? "#EDEAE3" : "#262521",
      };
    case "warning":
      return {
        border: isDark ? "1px solid #E0AE5A" : "1px solid #96690F",
        background: isDark ? "rgba(224,174,90,0.13)" : "rgba(150,105,15,0.08)",
        color: isDark ? "#EDEAE3" : "#262521",
      };
    case "negative":
      return {
        border: isDark ? "1px solid #E8776A" : "1px solid #B0392E",
        background: isDark ? "rgba(232,119,106,0.13)" : "rgba(176,57,46,0.08)",
        color: isDark ? "#EDEAE3" : "#262521",
      };
    case "info":
      return {
        border: isDark ? "1px solid #8FB3D9" : "1px solid #39638E",
        background: isDark ? "rgba(143,179,217,0.12)" : "rgba(57,99,142,0.08)",
        color: isDark ? "#EDEAE3" : "#262521",
      };
    default:
      return {
        border: isDark ? "1px solid #3A382F" : "1px solid #D9D3C2",
        background: isDark ? "#2B2A26" : "#FCFBF6",
        color: isDark ? "#EDEAE3" : "#262521",
      };
  }
}

function Tile(args: {
  label: string;
  value: string;
  tone?: Tone;
  isDark: boolean;
}) {
  const toneStyle = getToneStyle(args.tone ?? "neutral", args.isDark);

  return (
    <div
      style={{
        border: toneStyle.border,
        background: toneStyle.background,
        color: toneStyle.color,
        borderRadius: 10,
        padding: "9px 10px",
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 950, opacity: 0.72 }}>
        {args.label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 950, lineHeight: 1.25 }}>
        {args.value}
      </div>
    </div>
  );
}

function InputTile(args: {
  label: string;
  present: boolean;
  isDark: boolean;
}) {
  return (
    <Tile
      label={args.label}
      value={args.present ? "Present" : "Missing"}
      tone={args.present ? "positive" : "warning"}
      isDark={args.isDark}
    />
  );
}

function ListCard(args: {
  title: string;
  items: string[];
  tone: Tone;
  emphasized?: boolean;
  isDark: boolean;
}) {
  const toneStyle = getToneStyle(args.tone, args.isDark);
  const accentBorder = args.isDark ? "1px solid #D97757" : "1px solid #C15F3C";

  return (
    <div
      style={{
        border: args.emphasized ? accentBorder : toneStyle.border,
        background: args.emphasized
          ? args.isDark
            ? "rgba(217,119,87,0.18)"
            : "rgba(193,95,60,0.12)"
          : toneStyle.background,
        color: toneStyle.color,
        borderRadius: 12,
        padding: args.emphasized ? 14 : 12,
        display: "grid",
        gap: 8,
        minHeight: args.emphasized ? 150 : 118,
      }}
    >
      <div style={{ fontSize: args.emphasized ? 13 : 12, fontWeight: 950 }}>
        {args.title}
      </div>
      {args.items.length ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            display: "grid",
            gap: 6,
            fontSize: args.emphasized ? 13 : 12,
            lineHeight: 1.45,
          }}
        >
          {args.items.map((item, index) => (
            <li key={`${args.title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: args.emphasized ? 13 : 12, opacity: 0.72 }}>
          No items reported by the readiness rules.
        </div>
      )}
    </div>
  );
}

export function ReleaseReadinessSummary({
  readiness,
  commandCenter = false,
  resolvedTheme = "dark",
}: ReleaseReadinessSummaryProps) {
  const isDark = resolvedTheme === "dark";
  const factors = readiness.factors;
  const statusTone = getStatusTone(readiness.status);
  const readinessBand = getReadinessBand(readiness.status);
  const shellBackground = isDark ? "#302F2A" : "#FCFBF6";
  const shellBorder = isDark ? "1px solid #3A382F" : "1px solid #D9D3C2";
  const textColor = isDark ? "#EDEAE3" : "#262521";
  const mutedColor = isDark ? "#A39F92" : "#6F6A5C";
  const total = Math.max(0, Number(factors.executionTotal ?? 0));
  const buckets = [
    {
      label: "Passed",
      value: Math.max(0, Number(factors.passed ?? 0)),
      color: isDark ? "#7CC08A" : "#2F7A44",
      tone: "positive" as Tone,
    },
    {
      label: "Failed",
      value: Math.max(0, Number(factors.failed ?? 0)),
      color: isDark ? "#E8776A" : "#B0392E",
      tone: "negative" as Tone,
    },
    {
      label: "Skipped",
      value: Math.max(0, Number(factors.skipped ?? 0)),
      color: isDark ? "#E0AE5A" : "#96690F",
      tone: "warning" as Tone,
    },
    {
      label: "Blocked",
      value: Math.max(0, Number(factors.blocked ?? 0)),
      color: isDark ? "#E8776A" : "#B0392E",
      tone: "negative" as Tone,
    },
    {
      label: "Timed out",
      value: Math.max(0, Number(factors.timedOut ?? 0)),
      color: isDark ? "#E8776A" : "#B0392E",
      tone: "negative" as Tone,
    },
    {
      label: "Unknown",
      value: Math.max(0, Number(factors.unknown ?? 0)),
      color: isDark ? "#A39F92" : "#6F6A5C",
      tone: "neutral" as Tone,
    },
  ];

  return (
    <section
      style={{
        gridColumn: "1 / -1",
        border: shellBorder,
        borderRadius: commandCenter ? 12 : 16,
        background: shellBackground,
        color: textColor,
        padding: commandCenter ? 14 : 16,
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 6,
            border: getToneStyle(statusTone, isDark).border,
            background: getToneStyle(statusTone, isDark).background,
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 950, color: mutedColor }}>
            Verdict
          </div>
          <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.12, fontWeight: 950 }}>
            {STATUS_LABELS[readiness.status]}
          </h3>
          <p style={{ margin: 0, color: textColor, fontSize: 13, lineHeight: 1.5 }}>
            {readiness.summary}
          </p>
        </div>

        <Tile
          label="Status / Band"
          value={readinessBand}
          tone={statusTone}
          isDark={isDark}
        />
        <Tile
          label="Confidence"
          value={CONFIDENCE_LABELS[readiness.confidence]}
          tone="info"
          isDark={isDark}
        />
      </div>

      <div
        style={{
          border: getToneStyle("info", isDark).border,
          background: isDark ? "rgba(143,179,217,0.07)" : "rgba(57,99,142,0.05)",
          borderRadius: 12,
          padding: "9px 11px",
          color: textColor,
          fontSize: 11,
          lineHeight: 1.45,
          opacity: 0.86,
        }}
      >
        Guardrail: Release Signal supports your release decision; it does not
        approve releases. The QA/release owner has the final call.
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 950, color: mutedColor }}>
          Artifact inputs + review score
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <InputTile
            label="Requirement"
            present={factors.requirementPresent}
            isDark={isDark}
          />
          <InputTile
            label="Test Suite"
            present={factors.suitePresent}
            isDark={isDark}
          />
          <InputTile
            label="Review"
            present={factors.reviewPresent}
            isDark={isDark}
          />
          <InputTile
            label="Execution Evidence"
            present={factors.executionEvidencePresent}
            isDark={isDark}
          />
          <Tile
            label="Suite quality - not readiness"
            value={formatOptionalNumber(factors.reviewScore)}
            tone="info"
            isDark={isDark}
          />
          <Tile
            label="Suite cases"
            value={formatOptionalNumber(factors.suiteCaseCount)}
            tone="neutral"
            isDark={isDark}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 950, color: mutedColor }}>
          Execution evidence
        </div>
        <div
          role="img"
          aria-label={`Execution evidence: ${buckets
            .map((bucket) => `${bucket.label} ${bucket.value}`)
            .join(", ")}`}
          style={{
            display: "flex",
            height: 12,
            overflow: "hidden",
            borderRadius: 999,
            background: isDark ? "#1B1A17" : "#EAE6DA",
            border: shellBorder,
          }}
        >
          {buckets
            .filter((bucket) => bucket.value > 0 && total > 0)
            .map((bucket) => (
              <div
                key={bucket.label}
                aria-hidden="true"
                style={{
                  width: `${(bucket.value / total) * 100}%`,
                  background: bucket.color,
                }}
              />
            ))}
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          }}
        >
          {buckets.map((bucket) => (
            <Tile
              key={bucket.label}
              label={bucket.label}
              value={String(bucket.value)}
              tone={bucket.value > 0 ? bucket.tone : "neutral"}
              isDark={isDark}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        }}
      >
        <ListCard
          title="Recommended Actions"
          items={readiness.recommendedActions}
          tone="warning"
          emphasized
          isDark={isDark}
        />
        <ListCard
          title="Warnings"
          items={readiness.warnings}
          tone={readiness.warnings.length ? "warning" : "neutral"}
          isDark={isDark}
        />
        <ListCard
          title="Reasons"
          items={readiness.reasons}
          tone="info"
          isDark={isDark}
        />
      </div>
    </section>
  );
}
