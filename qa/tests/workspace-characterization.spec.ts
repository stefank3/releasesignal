import { expect, test, type Locator, type Page } from "@playwright/test";

const SESSION_ID = "workspace-characterization-session";
const SESSION_TITLE = "Workspace characterization fixture";
const NOW = "2026-07-17T10:00:00.000Z";

type ArtifactLevel = "none" | "requirement" | "suite" | "review";

type WorkspaceFixture = {
  artifact: Record<string, unknown> | null;
  messages?: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
  }>;
};

function buildReview(args: { actionable?: boolean } = {}) {
  const actionable = args.actionable ?? true;

  return {
    score: 88,
    verdict: "Excellent",
    breakdown: {
      businessRelevance: 22,
      riskCoverage: 22,
      designQuality: 18,
      levelAndScope: 13,
      diagnosticValue: 13,
    },
    riskGaps: actionable ? ["Characterize expired-session behavior."] : [],
    antiPatterns: [],
    improvements: actionable ? ["Add an explicit expired-session case."] : [],
    basedOnRequirementVersion: 2,
    basedOnSuiteVersion: 4,
  };
}

function buildArtifact(
  level: ArtifactLevel,
  args: { actionableReview?: boolean } = {}
): Record<string, unknown> | null {
  if (level === "none") return null;

  const artifact: Record<string, unknown> = {
    refinedRequirement: {
      objective: "Keep workspace characterization deterministic.",
      context: "The saved requirement is fixture-owned structured state.",
      functionalScope: ["Preserve the aligned beta workflow hierarchy."],
      acceptanceCriteria: ["Transient input remains separate from saved artifacts."],
      riskAreas: ["Cross-mode state leakage"],
      version: 2,
      lastUpdatedAt: NOW,
    },
  };

  if (level === "suite" || level === "review") {
    artifact.testSuite = {
      version: 4,
      basedOnRequirementVersion: 2,
      createdAt: NOW,
      lastUpdatedAt: NOW,
      cases: [
        {
          id: "TC-001",
          title: "Preserve transient input boundaries",
          body: [
            "TC-001: Preserve transient input boundaries",
            "Priority: P1",
            "Type: Integration",
            "Preconditions:",
            "- A saved requirement exists",
            "Steps:",
            "1. Open Test Design",
            "2. Expand the saved suite",
            "Expected Results:",
            "- The uniquely persisted suite case is visible",
          ].join("\n"),
          priority: "P1",
          type: "Integration",
        },
      ],
    };
  }

  if (level === "review") {
    artifact.reviewResult = buildReview({
      actionable: args.actionableReview,
    });
  }

  return artifact;
}

function buildMessages(level: ArtifactLevel): WorkspaceFixture["messages"] {
  if (level === "none") return [];

  return [
    {
      id: "history-user-1",
      role: "user",
      content: "Characterize the aligned beta workspace without changing it.",
      createdAt: NOW,
    },
    {
      id: "history-assistant-1",
      role: "assistant",
      content: [
        "Refined Technical Requirement",
        "Objective: Keep workspace characterization deterministic.",
        "Acceptance Criteria: Transient input remains separate from saved artifacts.",
      ].join("\n"),
      createdAt: NOW,
    },
  ];
}

async function mockWorkspace(
  page: Page,
  fixture: WorkspaceFixture,
  args: {
    includeSession?: boolean;
    tourState?: "dismissed" | "completed" | null;
  } = {}
) {
  const includeSession = args.includeSession ?? true;
  const tourState = args.tourState === undefined ? "completed" : args.tourState;
  const artifact = fixture.artifact;
  const refinedRequirement = artifact?.refinedRequirement;
  const testSuite = artifact?.testSuite as
    | { version: number; cases: unknown[] }
    | undefined;
  const reviewResult = artifact?.reviewResult as { score: number } | undefined;

  await page.addInitScript((storedTourState) => {
    window.localStorage.clear();
    if (storedTourState) {
      window.localStorage.setItem(
        "release-signal-v1-2-guided-tour",
        storedTourState
      );
    }
  }, tourState);

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      json: {
        authenticated: true,
        auth0Sub: "auth0|workspace-characterization",
        email: "workspace-characterization@example.com",
        isAdmin: false,
        planCode: "trial_v1",
        planStatus: "trialing",
        trialEndsAt: null,
        creditsRemaining: 100,
        trialDaysRemaining: null,
      },
    });
  });

  await page.route("**/api/chat/history**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/chat/history") {
      await route.fulfill({
        json: {
          items: includeSession
            ? [
                {
                  id: SESSION_ID,
                  title: SESSION_TITLE,
                  mode: "coach",
                  effectiveMode: "coach",
                  createdAt: NOW,
                  lastActivityAt: NOW,
                  lastMessage: {
                    role: "user",
                    content: "Characterize the aligned beta workspace.",
                    createdAt: NOW,
                  },
                  hasPinnedRequirement: !!refinedRequirement,
                  hasPersistentTestSuite: !!testSuite,
                  testSuiteVersion: testSuite?.version ?? null,
                  testSuiteCount: testSuite?.cases.length ?? null,
                  hasReviewArtifact: !!reviewResult,
                  reviewScore: reviewResult?.score ?? null,
                  artifactUpdatedAt: NOW,
                },
              ]
            : [],
          nextCursor: null,
        },
      });
      return;
    }

    if (url.pathname === `/api/chat/history/${SESSION_ID}`) {
      await route.fulfill({
        json: {
          items: fixture.messages ?? [],
          nextCursor: null,
          hasMore: false,
          sessionMode: "coach",
          effectiveMode: "coach",
          artifact,
          artifactUpdatedAt: NOW,
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/chat");
  await expect(page.getByText("Feature Workspace", { exact: true })).toBeVisible();
}

async function openFixtureSession(page: Page) {
  const sessionButton = page.locator(`button[title="${SESSION_ID}"]`);
  await expect(sessionButton).toBeVisible();
  await sessionButton.click();
  await expect(page.getByRole("button", { name: "Strategy", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
}

async function openMode(page: Page, name: "Strategy" | "Test Design" | "Test Review") {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("button", { name, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
}

async function expectBefore(first: Locator, second: Locator) {
  const secondElement = await second.elementHandle();
  expect(secondElement).not.toBeNull();

  expect(
    await first.evaluate(
      (firstElement, secondElement) =>
        !!(
          firstElement.compareDocumentPosition(secondElement) &
          Node.DOCUMENT_POSITION_FOLLOWING
        ),
      secondElement!
    )
  ).toBe(true);
}

test.describe("workspace characterization", () => {
  test("empty Strategy preserves its hierarchy and an unseeded multiline input", async ({
    page,
  }) => {
    await mockWorkspace(page, { artifact: null, messages: [] }, { includeSession: false });

    const strategyStart = page.getByLabel("Strategy workspace start");
    const input = page.getByRole("textbox", { name: "Requirement input" });
    const featureWorkspace = page.getByText("Feature Workspace", { exact: true });

    await expect(strategyStart).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Start with the change you need to test." })
    ).toBeVisible();
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toHaveAttribute("rows", "5");
    await expect(page.getByRole("textbox", { name: "Requirement input" })).toHaveCount(1);
    await expect(featureWorkspace).toBeVisible();
    await expect(page.locator('[data-tour-anchor="requirement-card"]')).toBeVisible();
    await expect(page.locator('[data-tour-anchor="test-suite-card"]')).toBeVisible();
    await expect(page.locator('[data-tour-anchor="review-card"]')).toBeVisible();
    await expect(page.locator('[data-tour-anchor="execution-evidence-card"]')).toBeVisible();
    await expect(page.getByLabel("Recent activity")).toHaveCount(0);
    await expectBefore(input, featureWorkspace);
  });

  test("populated Strategy preserves saved artifacts, actions, activity, and empty transient input after restore", async ({
    page,
  }) => {
    const fixture = {
      artifact: buildArtifact("review"),
      messages: buildMessages("review"),
    };
    await mockWorkspace(page, fixture);
    await openFixtureSession(page);

    const savedRequirement = page.getByLabel("Saved requirement");
    const strategyInput = page.getByRole("textbox", { name: "Next Strategy input" });
    const featureWorkspace = page.getByText("Feature Workspace", { exact: true });
    const recentActivity = page.getByLabel("Recent activity");

    await expect(savedRequirement).toBeVisible();
    await expect(strategyInput).toHaveValue("");
    await expect(featureWorkspace).toBeVisible();
    await expect(page.locator('[data-tour-anchor="requirement-card"]')).toBeVisible();
    await expect(page.locator('[data-tour-anchor="test-suite-card"]')).toBeVisible();
    await expect(page.locator('[data-tour-anchor="review-card"]')).toBeVisible();
    await expect(page.locator('[data-tour-anchor="execution-evidence-card"]')).toBeVisible();
    await expect(recentActivity).toBeVisible();
    await expectBefore(savedRequirement, featureWorkspace);
    await expectBefore(featureWorkspace, recentActivity);

    for (const name of ["Refine again", "Generate Tests", "New workspace"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
    }
    await expect(page.getByRole("button", { name: "Clear input", exact: true })).toBeEnabled();

    await strategyInput.fill("Transient text must not survive session restore.");
    await page.reload();
    await openFixtureSession(page);
    await expect(page.getByRole("textbox", { name: "Next Strategy input" })).toHaveValue("");
  });

  test("Recent activity renders at most five events newest-first and preserves its empty state", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      artifact: buildArtifact("review"),
      messages: [
        {
          id: "activity-1",
          role: "user",
          content: "Dropped oldest activity detail",
          createdAt: NOW,
        },
        {
          id: "activity-2",
          role: "assistant",
          content: "Second activity detail",
          createdAt: NOW,
        },
        {
          id: "activity-3",
          role: "user",
          content: "Third activity detail",
          createdAt: NOW,
        },
        {
          id: "activity-4",
          role: "assistant",
          content: "Fourth activity detail",
          createdAt: NOW,
        },
        {
          id: "activity-5",
          role: "user",
          content: "Fifth activity detail",
          createdAt: NOW,
        },
        {
          id: "activity-6",
          role: "assistant",
          content: "Readiness newest activity detail",
          createdAt: NOW,
        },
      ],
    });
    await openFixtureSession(page);

    const recentActivity = page.getByLabel("Recent activity");
    const eventRows = recentActivity.locator("details");
    const newestEvent = eventRows.first();
    const nextEvent = eventRows.nth(1);
    const olderEvent = eventRows.nth(2);

    await expect(recentActivity).toBeVisible();
    await expect(eventRows).toHaveCount(5);
    await expect(newestEvent.locator("summary")).toContainText(
      "Test suite generated"
    );
    await expect(newestEvent.locator("summary")).toContainText("latest");
    await expect(nextEvent.locator("summary")).toContainText(
      "Readiness recalculated"
    );
    await expect(nextEvent.locator("summary")).toContainText("recent");
    await expect(olderEvent.locator("summary")).toContainText(
      "Workspace input added"
    );
    await expect(olderEvent.locator("summary")).toContainText("earlier");
    await expect(recentActivity).not.toContainText("Dropped oldest activity detail");

    await newestEvent.locator("summary").click();
    await nextEvent.locator("summary").click();
    await olderEvent.locator("summary").click();
    const newestDetail = newestEvent.getByText("Generated test suite artifact", {
      exact: true,
    });
    const nextDetail = nextEvent.getByText(
      "Readiness newest activity detail",
      { exact: true }
    );
    const olderDetail = olderEvent.getByText("Fifth activity detail", {
      exact: true,
    });
    await expect(newestDetail).toBeVisible();
    await expect(nextDetail).toBeVisible();
    await expect(olderDetail).toBeVisible();
    await expectBefore(newestDetail, nextDetail);
    await expectBefore(nextDetail, olderDetail);

    await page.unroute("**/api/chat/history**");
    await mockWorkspace(page, {
      artifact: buildArtifact("requirement"),
      messages: [],
    });
    await openFixtureSession(page);

    const emptyRecentActivity = page.getByLabel("Recent activity");
    await expect(emptyRecentActivity.locator("details")).toHaveCount(0);
    await expect(emptyRecentActivity).toContainText("No recent activity yet.");
  });

  test("Test Design renders one saved suite disclosure closed by default and expands it", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      artifact: buildArtifact("suite"),
      messages: buildMessages("suite"),
    });
    await openFixtureSession(page);
    await openMode(page, "Test Design");

    const designInput = page.getByRole("textbox", {
      name: "Additional Test Design input",
    });
    const suite = page.locator('[data-artifact-row="suite"]');

    await expect(designInput).toBeVisible();
    await expect(designInput).toHaveAttribute("rows", "5");
    await expect(designInput).toHaveValue("");
    await expect(suite).toHaveCount(1);
    await expect(suite).not.toHaveAttribute("open", "");
    await expect(suite.getByText("Editable cases", { exact: true })).toBeHidden();

    await suite.locator("summary").click();
    await expect(suite).toHaveAttribute("open", "");
    await expect(suite.getByText("Editable cases", { exact: true })).toBeVisible();
    await expect(
      suite.getByText("Preserve transient input boundaries", { exact: true })
    ).toBeVisible();
  });

  for (const scenario of [
    {
      name: "no artifacts",
      level: "none" as const,
      requirement: /Requirement.*not saved/,
      suite: /Test suite.*none/,
      review: /Review.*not run/,
      enabled: false,
      guidance: true,
    },
    {
      name: "requirement only",
      level: "requirement" as const,
      requirement: /Requirement.*v2/,
      suite: /Test suite.*none/,
      review: /Review.*not run/,
      enabled: false,
      guidance: false,
    },
    {
      name: "requirement and suite",
      level: "suite" as const,
      requirement: /Requirement.*v2/,
      suite: /Test suite.*v4.*1 cases/,
      review: /Review.*not run/,
      enabled: true,
      guidance: false,
    },
    {
      name: "persisted review",
      level: "review" as const,
      requirement: /Requirement.*v2/,
      suite: /Test suite.*v4.*1 cases/,
      review: /Review.*current.*88\/100/,
      enabled: true,
      guidance: false,
    },
  ]) {
    test(`Test Review prerequisites characterize ${scenario.name}`, async ({ page }) => {
      await mockWorkspace(page, {
        artifact: buildArtifact(scenario.level),
        messages: buildMessages(scenario.level),
      });
      await openFixtureSession(page);
      await openMode(page, "Test Review");

      const entry = page.getByLabel("Test Review entry");
      const reviewAction = entry.getByRole("button", {
        name: "Review Test Suite",
        exact: true,
      });

      await expect(entry).toContainText(scenario.requirement);
      await expect(entry).toContainText(scenario.suite);
      await expect(entry).toContainText(scenario.review);
      await expect(reviewAction).toBeVisible();
      if (scenario.enabled) {
        await expect(reviewAction).toBeEnabled();
      } else {
        await expect(reviewAction).toBeDisabled();
      }
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expect(page.getByLabel("Test Review getting started")).toHaveCount(
        scenario.guidance ? 1 : 0
      );
    });
  }

  test("Review-to-Design actions follow actionable persisted review state", async ({ page }) => {
    await mockWorkspace(page, {
      artifact: buildArtifact("review", { actionableReview: true }),
      messages: buildMessages("review"),
    });
    await openFixtureSession(page);
    await openMode(page, "Test Review");

    const actions = page.getByLabel("Review to test design actions").first();
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Improve Test Plan" })).toBeEnabled();
    await expect(
      actions.getByRole("button", { name: "Generate Tests from Review Gaps" })
    ).toBeEnabled();
  });

  test("Review-to-Design actions remain hidden when the persisted review has no actionable findings", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      artifact: buildArtifact("review", { actionableReview: false }),
      messages: buildMessages("review"),
    });
    await openFixtureSession(page);
    await openMode(page, "Test Review");

    const actions = page.getByLabel("Review to test design actions").first();
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Improve Test Plan" })).toHaveCount(0);
    await expect(
      actions.getByRole("button", { name: "Generate Tests from Review Gaps" })
    ).toHaveCount(0);
    await expect(actions).toContainText(
      "This review does not currently have prioritized gaps to turn into new tests."
    );
  });

  test("mode transitions keep saved artifacts out of transient inputs and hide review input", async ({
    page,
  }) => {
    await mockWorkspace(page, {
      artifact: buildArtifact("review"),
      messages: buildMessages("review"),
    });
    await openFixtureSession(page);

    const strategyInput = page.getByRole("textbox", { name: "Next Strategy input" });
    await expect(strategyInput).toHaveValue("");

    await openMode(page, "Test Design");
    const designInput = page.getByRole("textbox", {
      name: "Additional Test Design input",
    });
    await expect(designInput).toHaveValue("");
    await designInput.fill("Transient Test Design-only input");

    await openMode(page, "Test Review");
    await expect(page.getByRole("textbox")).toHaveCount(0);

    await openMode(page, "Strategy");
    await expect(page.getByRole("textbox", { name: "Next Strategy input" })).toHaveValue("");
  });

  test("guided onboarding opens automatically and explains all nine steps without changing workflow state", async ({
    page,
  }) => {
    const workflowPosts: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "POST" && url.pathname === "/api/chat") {
        workflowPosts.push(request.url());
      }
    });

    await mockWorkspace(page, {
      artifact: buildArtifact("review"),
      messages: buildMessages("review"),
    }, { tourState: null });
    await openFixtureSession(page);

    const tour = page.getByLabel("Guided onboarding tour");
    const steps = [
      {
        title: "Start with a requirement",
        copy: "Start by pasting a requirement, Jira story, API change, bug fix, or feature description into Strategy.",
      },
      {
        title: "Refine the requirement",
        copy: "Release Signal turns your input into a structured requirement artifact.",
      },
      {
        title: "Open Test Design",
        copy: "use the workspace navigation to open Test Design",
      },
      {
        title: "Generate and inspect the suite",
        copy: "Inspect and review every generated test before using it.",
      },
      {
        title: "Open Test Review",
        copy: "run Review Test Suite to evaluate its quality",
      },
      {
        title: "Understand Review Score",
        copy: "It is not release approval and remains separate from Release Readiness.",
      },
      {
        title: "Act on review findings",
        copy: "Generate Tests from Review Gaps appends new tests for uncovered areas.",
      },
      {
        title: "Add execution evidence",
        copy: "Execution evidence remains separate from Review Score and contributes to Release Readiness.",
      },
      {
        title: "Read Release Readiness",
        copy: "Your QA or release owner makes the final decision.",
      },
    ];

    await expect(tour).toBeVisible();
    await expect(page.locator('[data-tour-anchor="workflow-navigation"]')).toHaveCount(1);
    await expect(page.locator('[data-tour-anchor="requirement-card"]')).toHaveCount(1);
    await expect(page.locator('[data-tour-anchor="test-suite-card"]')).toHaveCount(1);
    await expect(page.locator('[data-tour-anchor="review-card"]')).toHaveCount(1);
    await expect(page.locator('[data-tour-anchor="execution-evidence-card"]')).toHaveCount(1);
    await expect(page.locator('[data-tour-anchor="review-actions"]')).toHaveCount(1);
    await expect(page.locator('[data-tour-anchor="release-readiness-panel"]')).toHaveCount(1);

    for (let index = 0; index < steps.length; index += 1) {
      await expect(tour).toContainText(`Step ${index + 1} of 9`);
      await expect(tour.getByRole("heading")).toHaveText(steps[index].title);
      await expect(tour).toContainText(steps[index].copy);

      if (index < steps.length - 1) {
        await tour.getByRole("button", { name: "Next" }).click();
      }
    }

    await tour.getByRole("button", { name: "Finish" }).click();
    await expect(tour).toHaveCount(0);

    expect(workflowPosts).toEqual([]);
    await expect(page.getByRole("button", { name: "Strategy", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator('[data-tour-anchor="review-card"]')).toContainText("88/100");
    await expect(
      page
        .locator('[data-tour-anchor="test-suite-card"]')
        .getByRole("button", { name: "Open test suite (1)" })
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.localStorage.getItem("release-signal-v1-2-guided-tour")
        )
      )
      .toBe("completed");
  });

  test("guided onboarding keeps conditional fallbacks visible and scrollable in an empty narrow workspace", async ({
    page,
  }) => {
    const workflowPosts: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "POST" && url.pathname === "/api/chat") {
        workflowPosts.push(request.url());
      }
    });

    await page.setViewportSize({ width: 320, height: 320 });
    await page.emulateMedia({ colorScheme: "light" });
    await mockWorkspace(
      page,
      { artifact: null, messages: [] },
      { includeSession: false, tourState: null }
    );

    const tour = page.getByLabel("Guided onboarding tour");
    await expect(tour).toBeVisible();
    await expect(tour).toContainText(
      "Start by pasting a requirement, Jira story, API change, bug fix, or feature description into Strategy."
    );
    await expect(page.locator('[data-tour-anchor="start-here-input"]')).toHaveCount(1);

    const overflowState = await tour.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        overflowY: styles.overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(overflowState.overflowY).toBe("auto");
    expect(overflowState.scrollHeight).toBeGreaterThan(overflowState.clientHeight);
    expect(overflowState.top).toBeGreaterThanOrEqual(0);
    expect(overflowState.bottom).toBeLessThanOrEqual(overflowState.viewportHeight);

    for (let index = 0; index < 6; index += 1) {
      await tour.getByRole("button", { name: "Next" }).click();
    }
    await expect(tour.getByRole("heading")).toHaveText("Act on review findings");
    await expect(tour).toContainText(
      "Review-driven actions appear when the saved review contains actionable gaps or improvements."
    );
    await expect(page.locator('[data-tour-anchor="review-actions"]')).toHaveCount(0);

    await tour.getByRole("button", { name: "Next" }).click();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour.getByRole("heading")).toHaveText("Read Release Readiness");
    await expect(tour).toContainText(
      "Release Readiness appears when enough structured artifacts or evidence exist."
    );
    await expect(page.locator('[data-tour-anchor="release-readiness-panel"]')).toHaveCount(0);

    expect(workflowPosts).toEqual([]);
    await expect(page.getByRole("button", { name: "Strategy", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator('[data-tour-anchor="requirement-card"]')).toContainText(
      "No refined requirement saved yet"
    );
  });
});
