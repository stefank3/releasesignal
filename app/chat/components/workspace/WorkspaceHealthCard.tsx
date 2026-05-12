// app/chat/components/workspace/WorkspaceHealthCard.tsx
// M18.7a:
// Presentational extraction from FeatureWorkspaceSummary.
// Keeps workspace-health rendering isolated while leaving artifact-derived
// state and semantics in the parent component.

type Tone = "neutral" | "positive" | "warning" | "negative" | "info";

type WorkspaceHealthCardProps = {
  ready: boolean;
  overall: string | null;
  coverage: string | null;
  execution: string | null;
  failureBurden: string | null;
  emphasis: string;
  description: string;
  helpText: string;
  partialStateText?: string | null;
  meta: string;
  resolvedTheme: "light" | "dark";
};

function HealthStatusChip(args: {
  ready: boolean;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <span
      style={{
        borderRadius: 999,
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 850,
        background: args.ready
          ? isDark
            ? "rgba(34,197,94,0.18)"
            : "rgba(22,163,74,0.12)"
          : isDark
            ? "rgba(148,163,184,0.16)"
            : "rgba(100,116,139,0.12)",
        color: args.ready
          ? isDark
            ? "#bbf7d0"
            : "#166534"
          : isDark
            ? "#cbd5e1"
            : "#475569",
      }}
    >
      {args.ready ? "Ready" : "Pending"}
    </span>
  );
}

function toOverallTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized.includes("ready") && !normalized.includes("not")) {
    return "positive";
  }

  if (normalized.includes("blocked") || normalized.includes("not ready")) {
    return "negative";
  }

  if (normalized.includes("partial") || normalized.includes("risk")) {
    return "warning";
  }

  return "neutral";
}

function toCoverageTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized.includes("complete") || normalized.includes("strong")) {
    return "positive";
  }

  if (normalized.includes("missing") || normalized.includes("requirement only")) {
    return "warning";
  }

  return "neutral";
}

function toExecutionTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized.includes("passed") || normalized.includes("complete")) {
    return "positive";
  }

  if (normalized.includes("failed") || normalized.includes("blocked")) {
    return "negative";
  }

  if (normalized.includes("not started") || normalized.includes("partial")) {
    return "warning";
  }

  return "neutral";
}

function toFailureBurdenTone(value: string | null | undefined): Tone {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized.includes("none") || normalized.includes("low")) {
    return "positive";
  }

  if (normalized.includes("high") || normalized.includes("critical")) {
    return "negative";
  }

  if (normalized.includes("medium")) {
    return "warning";
  }

  return "neutral";
}

function getAccentBorder(tone: Tone, isDark: boolean): string {
  switch (tone) {
    case "positive":
      return isDark
        ? "1px solid rgba(34,197,94,0.38)"
        : "1px solid rgba(22,163,74,0.28)";
    case "warning":
      return isDark
        ? "1px solid rgba(245,158,11,0.42)"
        : "1px solid rgba(217,119,6,0.28)";
    case "negative":
      return isDark
        ? "1px solid rgba(248,113,113,0.42)"
        : "1px solid rgba(220,38,38,0.28)";
    case "info":
      return isDark
        ? "1px solid rgba(96,165,250,0.38)"
        : "1px solid rgba(37,99,235,0.24)";
    default:
      return isDark
        ? "1px solid rgba(148,163,184,0.22)"
        : "1px solid rgba(100,116,139,0.18)";
  }
}

function getAccentBackground(tone: Tone, isDark: boolean): string {
  switch (tone) {
    case "positive":
      return isDark ? "rgba(34,197,94,0.08)" : "rgba(22,163,74,0.045)";
    case "warning":
      return isDark ? "rgba(245,158,11,0.08)" : "rgba(217,119,6,0.045)";
    case "negative":
      return isDark ? "rgba(248,113,113,0.08)" : "rgba(220,38,38,0.045)";
    case "info":
      return isDark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.045)";
    default:
      return isDark ? "rgba(15,23,42,0.42)" : "rgba(248,250,252,0.72)";
  }
}

function HealthTile(args: {
  label: string;
  value: string;
  tone: Tone;
  resolvedTheme: "light" | "dark";
}) {
  const isDark = args.resolvedTheme === "dark";

  return (
    <div
      style={{
        border: getAccentBorder(args.tone, isDark),
        borderRadius: 12,
        padding: 10,
        background: getAccentBackground(args.tone, isDark),
        display: "grid",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 10, opacity: 0.68, fontWeight: 850 }}>
        {args.label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: isDark ? "#ffffff" : "#0f172a",
        }}
      >
        {args.value}
      </div>
    </div>
  );
}

export default function WorkspaceHealthCard(args: WorkspaceHealthCardProps) {
  const isDark = args.resolvedTheme === "dark";

  const overallTone = toOverallTone(args.overall);
  const coverageTone = toCoverageTone(args.coverage);
  const executionTone = toExecutionTone(args.execution);
  const failureTone = toFailureBurdenTone(args.failureBurden);

  const accentBorder = getAccentBorder(overallTone, isDark);
  const accentBackground = getAccentBackground(overallTone, isDark);

  return (
    <div
      style={{
        border: accentBorder,
        borderRadius: 14,
        padding: 12,
        background: accentBackground,
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 950,
            color: isDark ? "#ffffff" : "#0f172a",
          }}
        >
          Workspace Health
        </div>

        <HealthStatusChip ready={args.ready} resolvedTheme={args.resolvedTheme} />
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          lineHeight: 1.4,
          color: isDark ? "#ffffff" : "#0f172a",
        }}
      >
        {args.emphasis}
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.82 }}>
        {args.description}
      </div>

      {args.ready ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          <HealthTile
            label="Overall"
            value={args.overall ?? "Unknown"}
            tone={overallTone}
            resolvedTheme={args.resolvedTheme}
          />
          <HealthTile
            label="Coverage"
            value={args.coverage ?? "Unknown"}
            tone={coverageTone}
            resolvedTheme={args.resolvedTheme}
          />
          <HealthTile
            label="Execution"
            value={args.execution ?? "Unknown"}
            tone={executionTone}
            resolvedTheme={args.resolvedTheme}
          />
          <HealthTile
            label="Failure burden"
            value={args.failureBurden ?? "Unknown"}
            tone={failureTone}
            resolvedTheme={args.resolvedTheme}
          />
        </div>
      ) : null}

      {args.partialStateText ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.45,
            opacity: 0.78,
            borderTop: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(15,23,42,0.08)",
            paddingTop: 8,
          }}
        >
          {args.partialStateText}
        </div>
      ) : null}

      <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.74 }}>
        {args.helpText}
      </div>

      <div style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.7 }}>
        {args.meta}
      </div>
    </div>
  );
}