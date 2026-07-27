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
      "Start by pasting a requirement, Jira story, API change, bug fix, or feature description into Strategy. AI assists with structuring the input, but you should review the result before relying on it.",
    missingBody:
      "Open Strategy and use the main workspace input to begin with a requirement, story, API change, or feature description.",
    anchorSelectors: [
      '[data-tour-anchor="start-here-input"]',
      '[data-tour-anchor="workflow-start"]',
    ],
  },
  {
    title: "Refine the requirement",
    body:
      "Release Signal turns your input into a structured requirement artifact. Review the saved requirement before using it to generate tests.",
    missingBody:
      "A structured requirement artifact appears after refinement and becomes the source for Test Design.",
    anchorSelectors: [
      '[data-tour-anchor="requirement-card"]',
    ],
  },
  {
    title: "Open Test Design",
    body:
      "When the refined requirement is ready, use the workspace navigation to open Test Design.",
    missingBody:
      "Use the top workspace navigation to move from Strategy into Test Design.",
    anchorSelectors: [
      '[data-tour-anchor="workflow-navigation"]',
    ],
  },
  {
    title: "Generate and inspect the suite",
    body:
      "Test Design generates a structured test suite from the refined requirement. Inspect and review every generated test before using it.",
    missingBody:
      "The saved test-suite summary and detailed test cases appear after generation.",
    anchorSelectors: [
      '[data-tour-anchor="test-suite-card"]',
    ],
  },
  {
    title: "Open Test Review",
    body:
      "Open Test Review after a suite has been saved, then run Review Test Suite to evaluate its quality.",
    missingBody:
      "A saved test suite is required before Test Review can evaluate coverage and quality.",
    anchorSelectors: [
      '[data-tour-anchor="workflow-navigation"]',
    ],
  },
  {
    title: "Understand Review Score",
    body:
      "Review Score reflects the quality of the saved test suite. It is not release approval and remains separate from Release Readiness.",
    missingBody:
      "Review Score appears after Test Review evaluates the saved suite. It measures suite quality, not release approval.",
    anchorSelectors: [
      '[data-tour-anchor="review-card"]',
    ],
  },
  {
    title: "Act on review findings",
    body:
      "Generate Tests from Review Gaps appends new tests for uncovered areas. Improve Test Plan regenerates a guarded replacement suite using the review findings.",
    missingBody:
      "Review-driven actions appear when the saved review contains actionable gaps or improvements. Gap generation appends tests; Improve Test Plan replaces the suite.",
    anchorSelectors: [
      '[data-tour-anchor="review-actions"]',
    ],
  },
  {
    title: "Add execution evidence",
    body:
      "After executing the suite, add structured results and evidence. Execution evidence remains separate from Review Score and contributes to Release Readiness.",
    missingBody:
      "Execution evidence can be added after a saved test suite exists.",
    anchorSelectors: [
      '[data-tour-anchor="execution-evidence-card"]',
    ],
  },
  {
    title: "Read Release Readiness",
    body:
      "Release Readiness is a deterministic decision-support signal derived from saved artifacts and execution evidence. It does not approve releases. Your QA or release owner makes the final decision.",
    missingBody:
      "Release Readiness appears when enough structured artifacts or evidence exist. It supports the decision; your QA or release owner remains responsible for final approval.",
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
  const popoverHeightEstimate = stepIndex === 0 ? 282 : 260;
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
          zIndex: isOpen ? 50 : 60,
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
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
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
                or artifacts. Reopen it from Help / Tour.
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
