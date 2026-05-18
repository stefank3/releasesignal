# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Smoke >> App loads and workspace is accessible
- Location: tests\smoke.spec.ts:6:7

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /Release Signal/i
Received string:  "Create Next App"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    13 × unexpected value "Create Next App"

```

```yaml
- complementary:
  - text: Workspaces Persisted QA workspace sessions
  - button "New"
  - text: No workspaces yet. Send your first message to create one.
- main:
  - button "Collapse sidebar": «
  - heading "Release Signal" [level=1]
  - text: AI-assisted QA review, strategy refinement, and test design releasesignaltest@test.com
  - link "Admin":
    - /url: /admin
  - link "Logout":
    - /url: /auth/logout
  - button "Strategy" [pressed]
  - button "Test Design"
  - button "Test Review"
  - text: 1 Strategy 2 Test Design 3 Test Review
  - strong: "Strategy:"
  - text: Clarify requirements and risks Demo
  - button "Login + MFA (Strategy)"
  - button "Login + MFA (Test Review)"
  - button "Export CSV (Test Review)"
  - button "Login + MFA (Test Design)"
  - button "Clear"
  - text: Demo shortcuts These examples preload sample inputs for each workflow. They help first-time users explore the product without changing how real workspace actions behave. Session STRATEGY New workspace
  - button "Strategy"
  - button "Test Design"
  - button "Test Review"
  - text: "Session controls manage the current workspace context and session lifecycle. What this section does Use these controls to retry the latest request, start a fresh workspace, or switch into a new Strategy, Test Design, or Test Review session. Workspace actions Workspace actions appear after a session is created. Before workspace actions appear Create or open a workspace first. Once a session exists and the required artifacts are present, valid actions such as Generate Tests will appear here. Session: (new) Getting started This workspace helps you clarify a requirement, generate a structured test suite, and review coverage against the saved artifacts. Start here Describe the feature, release area, or system under test. Use Strategy to clarify scope and risks first, then continue into Test Design. Next suggested move:"
  - strong: Use Strategy to refine the requirement.
  - text: "Example: Clarify the login flow with MFA, identify the main risks, then generate a structured test suite. No saved requirement, suite, or review exists yet for this workspace. Artifact summary No persisted workspace artifacts yet. Start by shaping the requirement or continuing the next recommended step. Current stage: Requirement refinement Feature Workspace This session is tracked as a QA workspace backed by persisted artifacts. No saved workspace artifacts exist yet. Start with the next recommended step below to begin building the workspace state. Requirement Pending Requirement refinement is still needed The feature scope still needs refinement before downstream workflow steps. State Missing Workflow Needs refinement Artifact Not available Readiness Pending Start here when the feature scope, rules, or risks still need to be clarified. No refined requirement saved yet Test Suite Pending No persisted suite yet No persisted suite exists yet for this feature. Version — Cases 0 State Missing Readiness Pending Generate the suite after the requirement is clear and saved. Generate the suite from the refined requirement Review Pending No persisted review yet Coverage review has not yet been completed for this suite. Score — Strength — State Missing Readiness Pending Run review after a suite exists to evaluate coverage, gaps, and improvement areas. Run Test Review against the current suite Execution Evidence Pending No execution evidence imported yet Attach Release Signal execution JSON to show pass/fail evidence for the current suite. Status Not Started Linked suite — Source — Total results 0 M16 supports the Release Signal-native execution JSON format. Tool-specific report imports remain future adapter work. Workspace Health Pending No workspace health signal computed yet Workspace health has not yet been surfaced for this workspace. This will become visible once workspace-health data is computed and persisted by the backend. Workspace health will appear once the compact workspace signal is available Current stage:"
  - strong: Requirement refinement
  - text: "Next step:"
  - strong: Use Strategy to refine the requirement.
  - 'button "Release Readiness Report Deterministic release signal derived from requirement, suite, review, and execution evidence. Insufficient Data Confidence: low Release readiness cannot be calculated yet because required artifacts are missing."'
  - text: "Empty workspace Once you save a refined requirement, generate a suite, or complete a review, the latest persisted workspace state will appear here. Workflow guidance Current stage and the next recommended workspace move. Workspace stage: Requirement refinement Guided workflow Define the feature scope, constraints, integrations, and risk focus before moving into structured test design. Next:"
  - strong: Use Strategy to refine the requirement.
  - text: How to start Begin by shaping the requirement. Once the requirement is clear, generate the test suite from the saved artifact. Empty state Start with the requirement Describe the feature, release area, or system under test. The workspace will help clarify scope, risks, and the next step. Once the requirement is clear and saved, continue into test design.
  - textbox "Describe the feature, workflow, scope, or requirement to refine."
  - button "Refine"
  - text: Strategy Refine the requirement as the scope evolves. This updates the pinned Refined Requirement used for test generation. Not pinned How to use this panel Fill in the structure below, paste it into the main input, then run Strategy. This panel helps prepare requirement content, but it does not save or run the workflow by itself. Refine requirement Capture the main objective, risks, scope, and success criteria here. Then paste the structured result into the main workflow input. Objective
  - textbox "What is the main business or QA objective?"
  - text: Primary Risk
  - textbox "What failure or uncertainty matters most?"
  - text: Integrations
  - textbox "Auth0, email service, API gateway, payment provider..."
  - text: Constraints
  - textbox "Environment limits, timeline, non-goals, technical restrictions..."
  - text: Scope
  - 'textbox "In: login, MFA challenge / Out: admin portal, audit exports"'
  - text: Success Criteria
  - textbox "What must be true for this to be considered successful?"
  - button "Paste into input" [disabled]
  - button "Clear form" [disabled]
  - text: "Preview Objective: Primary Risk: Integrations: Constraints: Scope: Success Criteria: What happens after paste After pasting into the main input, run the Strategy step there. The resulting refined requirement will appear in the conversation area and can then be reused by Test Design. Nothing is pinned yet. Complete the refinement fields, paste the result into the main workflow input, and run Strategy to create the Refined Requirement."
- alert
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import sessions from '../fixtures/sessions.json';
  3  | import { goToWorkspace, waitForArtifactCard, waitForWorkspaceReady } from '../helpers/navigate';
  4  | 
  5  | test.describe('Smoke', () => {
  6  |   test('App loads and workspace is accessible', async ({ page }) => {
  7  |     await page.goto('/');
> 8  |     await expect(page).toHaveTitle(/Release Signal/i);
     |                        ^ Error: expect(page).toHaveTitle(expected) failed
  9  |     await waitForWorkspaceReady(page);
  10 |   });
  11 | 
  12 |   test('Can reach a workspace', async ({ page }) => {
  13 |     await goToWorkspace(page);
  14 |     await expect(page.getByText(/Feature Workspace/i).first()).toBeVisible();
  15 |     await expect(
  16 |       page.getByText(/Requirement|Test Suite|Review|Execution Evidence|Workspace Health/i).first()
  17 |     ).toBeVisible();
  18 |   });
  19 | 
  20 |   test('Release Readiness panel is present', async ({ page }) => {
  21 |     await goToWorkspace(page);
  22 |     const panel = page.getByText(/Release Readiness Report/i).first();
  23 |     await expect(panel).toBeVisible();
  24 |     await panel.click();
  25 |     await expect(panel).toBeVisible();
  26 |   });
  27 | 
  28 |   test('Export buttons are present when suite exists', async ({ page }) => {
  29 |     test.skip(!sessions.fullArtifacts, 'Requires fixtures.sessions.fullArtifacts with a persisted suite.');
  30 | 
  31 |     await goToWorkspace(page, sessions.fullArtifacts);
  32 |     const menu = page.getByRole('button', { name: /export|actions|more/i }).first();
  33 |     if (await menu.isVisible()) {
  34 |       await menu.click();
  35 |     }
  36 |     await expect(page.getByRole('button', { name: /Export JSON/i }).first()).toBeVisible();
  37 |     await expect(page.getByRole('button', { name: /Export CSV/i }).first()).toBeVisible();
  38 |   });
  39 | 
  40 |   test('Session survives page reload', async ({ page }) => {
  41 |     const sessionId = sessions.fullArtifacts || sessions.existingSuite || sessions.noExecution;
  42 |     test.skip(!sessionId, 'Requires a seeded session with at least one persisted artifact.');
  43 | 
  44 |     await goToWorkspace(page, sessionId);
  45 |     await waitForArtifactCard(page, /fullArtifacts|existingSuite/.test(sessionId) ? 'Test Suite' : 'Requirement');
  46 |     const before = await page.getByText(/Requirement|Test Suite|Review|Workspace Health/i).first().textContent();
  47 |     await page.reload();
  48 |     await waitForWorkspaceReady(page);
  49 |     await expect(page.getByText(before || /Requirement|Test Suite|Review|Workspace Health/i).first()).toBeVisible();
  50 |   });
  51 | });
  52 | 
```