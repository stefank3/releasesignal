import Link from "next/link";

const workflowSteps = [
  "Refine requirements into QA-ready artifacts",
  "Generate and review structured test suites",
  "Surface evidence-backed release readiness",
];

const signalCards = [
  {
    title: "Structured QA truth",
    text: "Release Signal keeps requirements, suites, reviews, execution evidence, and readiness as reviewable artifacts.",
  },
  {
    title: "Deterministic release signal",
    text: "Readiness is derived from saved artifacts and deterministic system logic, not chat history or free-form AI text.",
  },
  {
    title: "Built for senior QA work",
    text: "Use it as a focused intelligence layer before, around, or above traditional test management tools.",
  },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(900px 420px at 50% -160px, rgba(148,163,184,0.30), rgba(15,23,42,0)), #0f172a",
        color: "#f8fafc",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          padding: "28px 24px 40px",
        }}
      >
        <nav
          aria-label="Public navigation"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 72,
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 950 }}>
              Release Signal
            </span>
            <span style={{ fontSize: 12, color: "rgba(248,250,252,0.68)" }}>
              QA intelligence workspace
            </span>
          </div>

          <Link
            href="/auth/login"
            style={{
              border: "1px solid rgba(248,250,252,0.22)",
              borderRadius: 12,
              padding: "9px 13px",
              color: "#f8fafc",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 850,
              background: "rgba(248,250,252,0.07)",
            }}
          >
            Sign in
          </Link>
        </nav>

        <div
          style={{
            display: "grid",
            gap: 34,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <p
                style={{
                  margin: 0,
                  color: "rgba(226,232,240,0.78)",
                  fontSize: 14,
                  fontWeight: 850,
                }}
              >
                QA intelligence for release decisions
              </p>

              <h1
                style={{
                  margin: 0,
                  maxWidth: 760,
                  fontSize: 44,
                  lineHeight: 1.02,
                  fontWeight: 950,
                }}
              >
                Release Signal
              </h1>

              <p
                style={{
                  margin: 0,
                  maxWidth: 680,
                  color: "rgba(226,232,240,0.82)",
                  fontSize: 19,
                  lineHeight: 1.6,
                }}
              >
                Move from raw requirements and test plans toward structured,
                reviewable, evidence-backed release readiness.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href="/auth/login"
                style={{
                  borderRadius: 14,
                  padding: "12px 16px",
                  background: "#f8fafc",
                  color: "#0f172a",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 950,
                }}
              >
                Sign in to workspace
              </Link>

              <Link
                href="/chat"
                style={{
                  border: "1px solid rgba(248,250,252,0.22)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  background: "rgba(248,250,252,0.06)",
                  color: "#f8fafc",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                Open app
              </Link>
            </div>
          </div>

          <aside
            aria-label="Release Signal workflow"
            style={{
              border: "1px solid rgba(248,250,252,0.12)",
              borderRadius: 18,
              padding: 18,
              background: "rgba(15,23,42,0.76)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "rgba(226,232,240,0.68)",
                fontWeight: 900,
                marginBottom: 14,
              }}
            >
              V1 workflow
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {workflowSteps.map((step, index) => (
                <div
                  key={step}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "11px 12px",
                    borderRadius: 12,
                    background: "rgba(248,250,252,0.06)",
                    border: "1px solid rgba(248,250,252,0.08)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-grid",
                      placeItems: "center",
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: "rgba(248,250,252,0.12)",
                      fontSize: 12,
                      fontWeight: 950,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: "rgba(248,250,252,0.88)",
                    }}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section
          aria-label="Product signals"
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            marginTop: 52,
          }}
        >
          {signalCards.map((card) => (
            <article
              key={card.title}
              style={{
                border: "1px solid rgba(248,250,252,0.10)",
                borderRadius: 14,
                padding: 16,
                background: "rgba(248,250,252,0.045)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 950 }}>
                {card.title}
              </h2>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "rgba(226,232,240,0.76)",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {card.text}
              </p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
