"use client";

import React from "react";

type ResolvedTheme = "light" | "dark";

type TourStep = {
  title: string;
  body: string;
  missingBody: string;
  anchorSelectors: string[];
};

const STORAGE_KEY = "release-signal-v1-2-guided-tour";

const TOUR_STEPS: TourStep[] = [
  {
    title: "Start with a requirement",
    body:
      "Paste a requirement, user story, API specification, bug fix, or workflow change into the Strategy input. AI-assisted - review before you rely on it.",
    missingBody:
      "Start with the main workspace input. Paste a Jira-style story, API change, acceptance criteria, or rough requirement.",
    anchorSelectors: [
      '[data-tour-anchor="start-here-input"]',
      '[data-tour-anchor="workflow-start"]',
    ],
  },
  {
    title: "Generate your test suite",
    body:
      "Move into Test Design when the refined requirement is ready, then generate structured QA coverage from that requirement.",
    missingBody:
      "The Test Design step remains reachable through the top tabs and artifact-driven workflow state.",
    anchorSelectors: [
      '[data-tour-anchor="test-suite-card"]',
    ],
  },
  {
    title: "Review coverage",
    body:
      "Review the generated suite for gaps, weak checks, and risk areas before relying on it.",
    missingBody:
      "The Test Review step remains reachable through the top tabs and artifact-driven workflow state.",
    anchorSelectors: [
      '[data-tour-anchor="review-card"]',
    ],
  },
  {
    title: "Add results",
    body:
      "After execution, add pass/fail results and evidence so readiness can use structured artifacts.",
    missingBody:
      "Execution evidence becomes useful after a persisted test suite exists.",
    anchorSelectors: [
      '[data-tour-anchor="execution-evidence-card"]',
    ],
  },
  {
    title: "Get your readiness signal",
    body:
      "Release Signal supports your release decision; it does not approve releases. The QA/release owner has the final call.",
    missingBody:
      "Release Readiness stays available as a decision-support signal from structured artifacts and deterministic checks.",
    anchorSelectors: [
      '[data-tour-anchor="release-readiness-panel"]',
    ],
  },
];

function getStoredTourState(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredTourState(value: "dismissed" | "completed") {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore storage failures; the tour remains manually dismissible.
  }
}

function clearStoredTourState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures; restart still works for the current render.
  }
}

function findAnchor(step: TourStep): HTMLElement | null {
  for (const selector of step.anchorSelectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) return element;
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function GuidedOnboardingTour({
  resolvedTheme = "dark",
}: {
  resolvedTheme?: ResolvedTheme;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const [anchorFound, setAnchorFound] = React.useState(false);
  const [viewport, setViewport] = React.useState({ width: 1024, height: 768 });

  const isDark = resolvedTheme === "dark";
  const step = TOUR_STEPS[stepIndex];

  React.useEffect(() => {
    if (getStoredTourState()) return;
    setIsOpen(true);
  }, []);

  React.useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const updateAnchor = () => {
      const anchor = findAnchor(step);
      setAnchorFound(!!anchor);

      if (!anchor) {
        setAnchorRect(null);
        return;
      }

      anchor.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
      window.setTimeout(() => {
        setAnchorRect(anchor.getBoundingClientRect());
      }, 160);
    };

    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);

    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [isOpen, step]);

  const closeTour = (state: "dismissed" | "completed") => {
    setStoredTourState(state);
    setIsOpen(false);
  };

  const restartTour = () => {
    clearStoredTourState();
    setStepIndex(0);
    setIsOpen(true);
  };

  const popoverWidth = Math.min(340, Math.max(280, viewport.width - 32));
  const popoverHeightEstimate = stepIndex === 0 ? 282 : 238;
  const hasRoomRight = anchorRect
    ? anchorRect.right + 12 + popoverWidth <= viewport.width - 16
    : false;
  const hasRoomLeft = anchorRect
    ? anchorRect.left - 12 - popoverWidth >= 16
    : false;
  const sidePlacement = hasRoomRight || hasRoomLeft;
  const popoverLeft = anchorRect
    ? hasRoomRight
      ? anchorRect.right + 12
      : hasRoomLeft
        ? anchorRect.left - popoverWidth - 12
        : clamp(anchorRect.left, 16, Math.max(16, viewport.width - popoverWidth - 16))
    : Math.max(16, viewport.width - popoverWidth - 22);
  const belowTop = anchorRect ? anchorRect.bottom + 12 : viewport.height - 270;
  const aboveTop = anchorRect ? anchorRect.top - popoverHeightEstimate - 12 : belowTop;
  const preferredTop = anchorRect
    ? sidePlacement
      ? anchorRect.top
      : belowTop + popoverHeightEstimate <= viewport.height - 16
        ? belowTop
        : aboveTop
    : belowTop;
  const popoverTop = clamp(
    preferredTop,
    16,
    Math.max(16, viewport.height - popoverHeightEstimate - 16)
  );

  const buttonStyle: React.CSSProperties = {
    borderRadius: 999,
    border: isDark
      ? "1px solid rgba(255,255,255,0.20)"
      : "1px solid rgba(15,23,42,0.14)",
    background: isDark ? "rgba(15,23,42,0.94)" : "#ffffff",
    color: isDark ? "#ffffff" : "#0f172a",
    boxShadow: isDark
      ? "0 12px 28px rgba(0,0,0,0.26)"
      : "0 12px 28px rgba(15,23,42,0.12)",
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  };

  return (
    <>
      <button
        type="button"
        onClick={restartTour}
        style={{
          ...buttonStyle,
          position: "fixed",
          right: 18,
          bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
          zIndex: 60,
        }}
      >
        Help / Tour
      </button>

      {isOpen ? (
        <>
          {anchorRect ? (
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                left: anchorRect.left - 6,
                top: anchorRect.top - 6,
                width: anchorRect.width + 12,
                height: anchorRect.height + 12,
                borderRadius: 18,
                border: "2px solid rgba(96,165,250,0.82)",
                boxShadow: "0 0 0 9999px rgba(15,23,42,0.12)",
                pointerEvents: "none",
                zIndex: 49,
              }}
            />
          ) : null}

          <section
            aria-live="polite"
            aria-label="Guided onboarding tour"
            style={{
              position: "fixed",
              left: popoverLeft,
              top: popoverTop,
              width: popoverWidth,
              maxWidth: "calc(100vw - 32px)",
              zIndex: 51,
              borderRadius: 16,
              border: isDark
                ? "1px solid rgba(255,255,255,0.16)"
                : "1px solid rgba(15,23,42,0.12)",
              background: isDark ? "rgba(15,23,42,0.98)" : "#ffffff",
              color: isDark ? "#ffffff" : "#0f172a",
              boxShadow: isDark
                ? "0 18px 46px rgba(0,0,0,0.42)"
                : "0 18px 46px rgba(15,23,42,0.16)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.7 }}>
                  Step {stepIndex + 1} of {TOUR_STEPS.length}
                </div>
                <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.2 }}>
                  {step.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => closeTour("dismissed")}
                aria-label="Dismiss tour"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  opacity: 0.72,
                }}
              >
                x
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, opacity: 0.84 }}>
              {anchorFound ? step.body : step.missingBody}
            </p>

            {stepIndex === 0 ? (
              <div style={{ fontSize: 11, lineHeight: 1.45, opacity: 0.68 }}>
                This tour is guidance only. It does not change workflow state,
                artifacts, review scoring, execution evidence, or Release
                Readiness. Release Signal supports your release decision; it does
                not approve releases. Reopen it from Help / Tour.
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => closeTour("dismissed")}
                style={{ ...buttonStyle, boxShadow: "none" }}
              >
                Skip
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((current) => Math.max(0, current - 1))
                  }
                  disabled={stepIndex === 0}
                  style={{
                    ...buttonStyle,
                    boxShadow: "none",
                    opacity: stepIndex === 0 ? 0.52 : 1,
                    cursor: stepIndex === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stepIndex === TOUR_STEPS.length - 1) {
                      closeTour("completed");
                      return;
                    }

                    setStepIndex((current) => current + 1);
                  }}
                  style={{ ...buttonStyle, boxShadow: "none" }}
                >
                  {stepIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
