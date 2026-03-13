// app/admin/page.tsx
//
// M11 — Admin Console Entry
//
// Purpose:
// Provide a simple internal navigation entry for admin tools.
// This prevents scattering admin links across the main UI.
//
// Current admin tools:
// - Metrics
// - Telemetry
//
// Future admin tools may include:
// - Billing diagnostics
// - Model usage analysis
// - System health panels

import Link from "next/link";

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 18,
    background: "rgba(255,255,255,0.03)",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  };
}

export default function AdminHomePage() {
  return (
    <main
      style={{
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>
          Admin Console
        </h1>

        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Internal operational tools for Release Signal platform monitoring.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {/* Metrics */}
        <Link href="/admin/metrics" style={cardStyle()}>
          <h2 style={{ marginTop: 0 }}>Metrics</h2>
          <p style={{ opacity: 0.75 }}>
            Operational metrics for chat usage, billing activity, and system
            throughput.
          </p>
        </Link>

        {/* Telemetry */}
        <Link href="/admin/telemetry" style={cardStyle()}>
          <h2 style={{ marginTop: 0 }}>Telemetry</h2>
          <p style={{ opacity: 0.75 }}>
            Workflow telemetry events including session lifecycle, requirement
            refinement, test suite generation, and review activity.
          </p>
        </Link>
      </section>
    </main>
  );
}