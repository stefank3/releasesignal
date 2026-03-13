// app/admin/telemetry/page.tsx
//
// M11 — Internal Telemetry Page
//
// Purpose:
// Provide a first internal visibility screen over persisted telemetry.
//
// This is intentionally lightweight for the first M11 pass.
// We are not building a full dashboard yet.
// We are only exposing enough internal visibility to confirm that:
//
// - telemetry events are being written
// - event volumes are visible
// - workflow stage usage is visible
// - token usage is visible
// - recent events can be inspected
//
// IMPORTANT:
// - server component
// - reads from telemetryQueryService
// - internal/admin-facing page only

import { fetchTelemetryOverview } from "@/lib/server/telemetry/telemetryQueryService";

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function formatDurationMs(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return `${Math.round(value).toLocaleString()} ms`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value);
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 16,
    background: "rgba(255,255,255,0.03)",
  };
}

function sectionTitleStyle(): React.CSSProperties {
  return {
    fontSize: 18,
    fontWeight: 700,
    margin: "0 0 12px 0",
  };
}

export default async function AdminTelemetryPage() {
  const overview = await fetchTelemetryOverview({ recentLimit: 25 });

  const totalEvents = overview.eventCounts.reduce((sum, row) => sum + row.count, 0);

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        color: "inherit",
      }}
    >
      {/* Page header */}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
          Internal Telemetry
        </h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          First-pass internal visibility for M11 telemetry events, workflow usage,
          token consumption, and recent activity.
        </p>
      </header>

      {/* Summary cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div style={cardStyle()}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
            Total Events
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {formatNumber(totalEvents)}
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
            Total Input Tokens
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {formatNumber(overview.tokenUsage.totalInputTokens)}
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
            Total Output Tokens
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {formatNumber(overview.tokenUsage.totalOutputTokens)}
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
            Total Tokens
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            {formatNumber(overview.tokenUsage.totalTokens)}
          </div>
        </div>
      </section>

      {/* Event counts */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={sectionTitleStyle()}>Events by Type</h2>

        <div style={{ ...cardStyle(), overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <th style={{ padding: "10px 8px" }}>Event Type</th>
                <th style={{ padding: "10px 8px" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {overview.eventCounts.length === 0 ? (
                <tr>
                  <td style={{ padding: "14px 8px" }} colSpan={2}>
                    No telemetry events found yet.
                  </td>
                </tr>
              ) : (
                overview.eventCounts.map((row) => (
                  <tr
                    key={row.eventType}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td style={{ padding: "10px 8px" }}>{row.eventType}</td>
                    <td style={{ padding: "10px 8px" }}>{formatNumber(row.count)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Workflow stats */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={sectionTitleStyle()}>Workflow Stage Stats</h2>

        <div style={{ ...cardStyle(), overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <th style={{ padding: "10px 8px" }}>Workflow Stage</th>
                <th style={{ padding: "10px 8px" }}>Events</th>
                <th style={{ padding: "10px 8px" }}>Avg Duration</th>
                <th style={{ padding: "10px 8px" }}>Total Tokens</th>
              </tr>
            </thead>
            <tbody>
              {overview.workflowStageStats.length === 0 ? (
                <tr>
                  <td style={{ padding: "14px 8px" }} colSpan={4}>
                    No workflow-stage telemetry found yet.
                  </td>
                </tr>
              ) : (
                overview.workflowStageStats.map((row) => (
                  <tr
                    key={row.workflowStage ?? "null-stage"}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td style={{ padding: "10px 8px" }}>{row.workflowStage ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{formatNumber(row.events)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatDurationMs(row.avgDurationMs)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatNumber(row.totalTokens)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent events */}
      <section>
        <h2 style={sectionTitleStyle()}>Recent Events</h2>

        <div style={{ ...cardStyle(), overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <th style={{ padding: "10px 8px" }}>Created</th>
                <th style={{ padding: "10px 8px" }}>Event Type</th>
                <th style={{ padding: "10px 8px" }}>Stage</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px" }}>Duration</th>
                <th style={{ padding: "10px 8px" }}>Tokens</th>
                <th style={{ padding: "10px 8px" }}>Artifact</th>
                <th style={{ padding: "10px 8px" }}>Session</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentEvents.length === 0 ? (
                <tr>
                  <td style={{ padding: "14px 8px" }} colSpan={8}>
                    No recent telemetry events found yet.
                  </td>
                </tr>
              ) : (
                overview.recentEvents.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{row.eventType}</td>
                    <td style={{ padding: "10px 8px" }}>{row.workflowStage ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{row.status ?? "—"}</td>
                    <td style={{ padding: "10px 8px" }}>{formatDurationMs(row.durationMs)}</td>
                    <td style={{ padding: "10px 8px" }}>{formatNumber(row.tokenTotal)}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {row.artifactType
                        ? `${row.artifactType}${row.artifactVersion ? ` v${row.artifactVersion}` : ""}`
                        : "—"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {row.sessionId ? row.sessionId.slice(0, 8) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}