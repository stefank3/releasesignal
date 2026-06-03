import type { CSSProperties } from "react";
import { PRODUCT_PACKAGE_NAMES } from "@/lib/product/packageLabels";

const workspaceLoginHref = "/auth/login?returnTo=%2Fchat";
const standardPackageName = PRODUCT_PACKAGE_NAMES.standard;
const standardTrialPackageName = PRODUCT_PACKAGE_NAMES.standardTrial;

const signature =
  "Built by Stefan Kajchevski, Senior Quality Engineer · An RSF Labs product";

const trustLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/trial-terms", label: "Trial Terms" },
  { href: "/refund-cancellation", label: "Refund / Cancellation" },
];

const workflowSteps = [
  {
    title: "Refine requirement",
    text: "Turn raw product intent into a QA-ready requirement artifact with scope, acceptance criteria, risks, and open questions.",
  },
  {
    title: "Generate structured test cases",
    text: "Create a structured test suite that can be reviewed, improved, and exported.",
  },
  {
    title: "Review test suite",
    text: "Evaluate coverage, diagnostic value, risk focus, and design quality before execution.",
  },
  {
    title: "Improve test plan",
    text: "Address review gaps while preserving the structured test-suite workflow.",
  },
  {
    title: "Export JSON/CSV",
    text: "Export QA artifacts as clean JSON or CSV for sharing, documentation, or manual mapping.",
  },
  {
    title: "Submit structured execution evidence",
    text: "Add structured execution evidence without turning execution notes into test design truth.",
  },
  {
    title: "Evaluate release readiness signal",
    text: "Use deterministic system logic to evaluate readiness from the current artifacts.",
  },
];

const featureCards = [
  {
    title: "Requirement Refinement",
    text: "Clarify scope, business rules, acceptance criteria, edge cases, risk areas, and unanswered questions.",
  },
  {
    title: "Structured Test Suite Generation",
    text: "Move from requirement intent to reviewable test cases with priorities, steps, expected results, tags, and notes.",
  },
  {
    title: "Test Suite Review",
    text: "Find coverage gaps, weak diagnostics, missing risks, and test-design issues before execution.",
  },
  {
    title: "Improve Test Plan",
    text: "Strengthen coverage and clarity while keeping the suite structured and reviewable.",
  },
  {
    title: "JSON/CSV Export",
    text: "Take structured Release Signal artifacts into downstream documentation or manual QA workflows.",
  },
  {
    title: "Release Readiness Signal",
    text: "Evaluate readiness through deterministic rules over requirement, suite, review, and execution evidence artifacts.",
  },
];

const exampleFlow = [
  {
    label: "Rough requirement",
    text: "Admins can manage users and roles.",
  },
  {
    label: "Refined requirement",
    text: "Role-based user management with create, edit, deactivate, permission boundaries, audit expectations, and negative paths.",
  },
  {
    label: "Test cases",
    text: "Structured coverage for role assignment, permission denial, duplicate users, disabled accounts, and boundary roles.",
  },
  {
    label: "Review gaps",
    text: "Missing downgrade scenarios, stale session behavior, and audit visibility checks.",
  },
  {
    label: "Improved plan",
    text: "Adds role-change regression, inactive-user access checks, and clearer expected results.",
  },
  {
    label: "Export",
    text: "JSON/CSV artifacts ready for sharing or manual mapping.",
  },
  {
    label: "Readiness signal",
    text: "Deterministic release readiness evaluation reflects design strength and submitted execution evidence.",
  },
];

const faqs = [
  {
    question: "Is Release Signal just an AI test generator?",
    answer:
      "No. AI assists the workflow, but Release Signal keeps QA truth structured, deterministic, and reviewable.",
  },
  {
    question: "Does it replace TestRail, Qase, Xray, or Zephyr in V1?",
    answer:
      "No. V1 exports JSON and CSV artifacts for sharing, documentation, or manual mapping. Native test-management integrations are not part of V1.",
  },
  {
    question: "Does V1 generate Playwright or Cypress code?",
    answer:
      "No. V1 focuses on requirements, structured test design, review, improvement, export, execution evidence submission, and deterministic readiness evaluation.",
  },
  {
    question: "What does Release Readiness mean?",
    answer:
      "It is a deterministic signal derived from the current requirement, test suite, review result, and structured execution evidence.",
  },
  {
    question: `How does the ${standardTrialPackageName} work?`,
    answer:
      `${standardTrialPackageName} uses a controlled 15-day trial with included usage credits. Usage is not unlimited.`,
  },
  {
    question: "What can I export?",
    answer:
      "V1 supports JSON and CSV export of structured Release Signal test-suite artifacts.",
  },
];

const sectionStyle = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "64px 24px",
} satisfies CSSProperties;

const cardStyle = {
  border: "1px solid rgba(15,23,42,0.10)",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
} satisfies CSSProperties;

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          width: "100%",
          background:
            "linear-gradient(135deg, #0f172a 0%, #172033 58%, #1e293b 100%)",
          color: "#f8fafc",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1120,
            margin: "0 auto",
            padding: "28px 24px 72px",
          }}
        >
          <nav
            aria-label="Public navigation"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 68,
            }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 950 }}>
                Release Signal
              </h2>
              <span style={{ fontSize: 12, color: "rgba(248,250,252,0.68)" }}>
                RSF Labs · {standardPackageName}
              </span>
            </div>

            <a
              href={workspaceLoginHref}
              style={{
                border: "1px solid rgba(248,250,252,0.22)",
                borderRadius: 8,
                padding: "9px 13px",
                color: "#f8fafc",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 850,
                background: "rgba(248,250,252,0.07)",
              }}
            >
              Sign in
            </a>
          </nav>

          <div
            style={{
              display: "grid",
              gap: 40,
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: 24 }}>
              <div style={{ display: "grid", gap: 16 }}>
                <p
                  style={{
                    margin: 0,
                    color: "rgba(226,232,240,0.78)",
                    fontSize: 14,
                    fontWeight: 850,
                  }}
                >
                  QA intelligence and deterministic release readiness evaluation
                </p>

                <h1
                  style={{
                    margin: 0,
                    maxWidth: 760,
                    fontSize: 42,
                    lineHeight: 1.08,
                    fontWeight: 950,
                  }}
                >
                  AI-assisted QA intelligence for better test coverage and
                  release confidence.
                </h1>

                <p
                  style={{
                    margin: 0,
                    maxWidth: 720,
                    color: "rgba(226,232,240,0.84)",
                    fontSize: 18,
                    lineHeight: 1.6,
                  }}
                >
                  Release Signal helps QA professionals refine requirements,
                  generate and review structured test suites, improve coverage,
                  export QA artifacts, submit structured execution evidence, and
                  evaluate deterministic release readiness signals.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={workspaceLoginHref}
                  style={{
                    borderRadius: 8,
                    padding: "12px 16px",
                    background: "#f8fafc",
                    color: "#0f172a",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 950,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
                  }}
                >
                  Start Standard Trial
                </a>

                <a
                  href="#workflow"
                  style={{
                    border: "1px solid rgba(248,250,252,0.22)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    background: "rgba(248,250,252,0.10)",
                    color: "#f8fafc",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  See How It Works
                </a>
              </div>

              <p
                style={{
                  margin: 0,
                  maxWidth: 620,
                  color: "rgba(226,232,240,0.76)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Private beta remains noindex while production domain, Auth0, and
                protection setup continue through controlled validation.
              </p>
            </div>

            <aside
              aria-label="Release Signal snapshot"
              style={{
                ...cardStyle,
                padding: 18,
                background: "rgba(255,255,255,0.98)",
                color: "#0f172a",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 900,
                  marginBottom: 12,
                  textTransform: "uppercase",
                }}
              >
                V1 focus
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  "Requirement refinement",
                  "Structured test-suite generation and review",
                  "JSON/CSV export",
                  "Structured execution evidence submission",
                  "Release Readiness signal",
                ].map((item) => (
                  <div
                    key={item}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "10px 0",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: "#2563eb",
                        marginTop: 7,
                        flex: "0 0 auto",
                      }}
                    />
                    <span style={{ fontSize: 14, lineHeight: 1.45 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: 40 }}>
        <div
          style={{
            ...cardStyle,
            padding: 24,
            display: "grid",
            gap: 10,
            borderLeft: "4px solid #2563eb",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            The problem
          </p>
          <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.15 }}>
            QA teams do not just need more test cases. They need better release
            confidence.
          </h2>
          <p style={{ margin: 0, color: "#475569", fontSize: 16, lineHeight: 1.7 }}>
            More cases can still leave unclear requirements, weak risk coverage,
            unreviewed gaps, and hard-to-explain release decisions. Release
            Signal focuses on turning QA work into structured evidence that can
            be reviewed and evaluated.
          </p>
        </div>
      </section>

      <section id="workflow" style={{ ...sectionStyle, paddingTop: 40 }}>
        <div style={{ display: "grid", gap: 18, marginBottom: 24 }}>
          <p
            style={{
              margin: 0,
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Workflow
          </p>
          <h2 style={{ margin: 0, fontSize: 36, lineHeight: 1.12 }}>
            From requirement intent to a deterministic readiness signal.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          {workflowSteps.map((step, index) => (
            <article key={step.title} style={{ ...cardStyle, padding: 18 }}>
              <div
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "#e0ecff",
                  color: "#1d4ed8",
                  fontSize: 13,
                  fontWeight: 950,
                  marginBottom: 14,
                }}
              >
                {index + 1}
              </div>
              <h3 style={{ margin: 0, fontSize: 17 }}>{step.title}</h3>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#475569",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {step.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: 40 }}>
        <div style={{ display: "grid", gap: 18, marginBottom: 24 }}>
          <p
            style={{
              margin: 0,
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Capabilities
          </p>
          <h2 style={{ margin: 0, fontSize: 36, lineHeight: 1.12 }}>
            Built for structured QA decisions, not one-off prompt output.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {featureCards.map((card) => (
            <article key={card.title} style={{ ...cardStyle, padding: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{card.title}</h3>
              <p
                style={{
                  margin: "10px 0 0",
                  color: "#475569",
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                {card.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ width: "100%", background: "#0f172a", color: "#f8fafc" }}>
        <div style={sectionStyle}>
          <div style={{ display: "grid", gap: 16, maxWidth: 820 }}>
            <p
              style={{
                margin: 0,
                color: "rgba(191,219,254,0.86)",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Differentiator
            </p>
            <h2 style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>
              AI-assisted, but not AI-owned.
            </h2>
            <p
              style={{
                margin: 0,
                color: "rgba(226,232,240,0.82)",
                fontSize: 17,
                lineHeight: 1.7,
              }}
            >
              AI assists the QA workflow, but Release Signal keeps product truth
              in structured artifacts and deterministic system logic. Requirements,
              test suites, reviews, execution evidence, and readiness evaluation
              stay reviewable instead of becoming loose chat text.
            </p>
          </div>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: 56 }}>
        <div style={{ display: "grid", gap: 18, marginBottom: 24 }}>
          <p
            style={{
              margin: 0,
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Example workflow
          </p>
          <h2 style={{ margin: 0, fontSize: 36, lineHeight: 1.12 }}>
            Role-based user management, made reviewable.
          </h2>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {exampleFlow.map((item, index) => (
            <article
              key={item.label}
              style={{
                ...cardStyle,
                padding: 16,
                display: "grid",
                gap: 10,
                gridTemplateColumns: "150px minmax(0, 1fr)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  color: "#1d4ed8",
                  fontWeight: 950,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: "#e0ecff",
                  }}
                >
                  {index + 1}
                </span>
                {item.label}
              </div>
              <p
                style={{
                  margin: 0,
                  color: "#475569",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: 40 }}>
        <div
          style={{
            ...cardStyle,
            padding: 24,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            alignItems: "center",
            background: "#eef6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <div style={{ display: "grid", gap: 8 }}>
            <p
              style={{
                margin: 0,
                color: "#1d4ed8",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              {standardTrialPackageName}
            </p>
            <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.15 }}>
              Start with {standardTrialPackageName} and included usage credits.
            </h2>
            <p
              style={{
                margin: 0,
                color: "#475569",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              {standardTrialPackageName} is credit-based and intentionally
              bounded.
            </p>
          </div>
          <a
            href={workspaceLoginHref}
            style={{
              borderRadius: 8,
              padding: "12px 16px",
              background: "#0f172a",
              color: "#f8fafc",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            Start Standard Trial
          </a>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: 40 }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "stretch",
          }}
        >
          <article style={{ ...cardStyle, padding: 22 }}>
            <p
              style={{
                margin: 0,
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Founder credibility
            </p>
            <h2 style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1.15 }}>
              Built by Stefan Kajchevski, Senior Quality Engineer.
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                color: "#475569",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              Release Signal is an RSF Labs product shaped around practical QA
              analysis, test design review, and release confidence.
            </p>
          </article>

          <article style={{ ...cardStyle, padding: 22 }}>
            <p
              style={{
                margin: 0,
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              Current provider
            </p>
            <h2 style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1.15 }}>
              Current AI provider: OpenAI.
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                color: "#475569",
                fontSize: 15,
                lineHeight: 1.65,
              }}
            >
              Built with a provider-ready architecture for future Claude and
              Gemini support.
            </p>
          </article>
        </div>
      </section>

      <section style={{ ...sectionStyle, paddingTop: 40 }}>
        <div style={{ display: "grid", gap: 18, marginBottom: 24 }}>
          <p
            style={{
              margin: 0,
              color: "#2563eb",
              fontSize: 13,
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            FAQ
          </p>
          <h2 style={{ margin: 0, fontSize: 36, lineHeight: 1.12 }}>
            What Release Signal V1 does, and what it does not claim.
          </h2>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {faqs.map((faq) => (
            <article key={faq.question} style={{ ...cardStyle, padding: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>{faq.question}</h3>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#475569",
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                {faq.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          width: "100%",
          background: "#0f172a",
          color: "#f8fafc",
        }}
      >
        <div style={{ ...sectionStyle, paddingTop: 56, paddingBottom: 32 }}>
          <div style={{ display: "grid", gap: 20, maxWidth: 780 }}>
            <h2 style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>
              Start with one requirement. See how strong your coverage really is.
            </h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a
                href={workspaceLoginHref}
                style={{
                  borderRadius: 8,
                  padding: "12px 16px",
                  background: "#f8fafc",
                  color: "#0f172a",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 950,
                }}
              >
                Start Standard Trial
              </a>
              <a
                href="#workflow"
                style={{
                  border: "1px solid rgba(248,250,252,0.22)",
                  borderRadius: 8,
                  padding: "12px 16px",
                  background: "rgba(248,250,252,0.06)",
                  color: "#f8fafc",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                See How It Works
              </a>
            </div>
          </div>

          <footer
            style={{
              marginTop: 44,
              paddingTop: 18,
              borderTop: "1px solid rgba(248,250,252,0.10)",
              color: "rgba(226,232,240,0.64)",
              fontSize: 13,
              lineHeight: 1.6,
              display: "grid",
              gap: 12,
            }}
          >
            <div>{signature}</div>
            <nav
              aria-label="Trust pages"
              style={{ display: "flex", gap: 14, flexWrap: "wrap" }}
            >
              {trustLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    color: "rgba(226,232,240,0.74)",
                    textDecoration: "none",
                    fontWeight: 750,
                  }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </footer>
        </div>
      </section>
    </main>
  );
}
