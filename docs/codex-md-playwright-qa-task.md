# Codex MD — Build Standalone Playwright QA Framework for Release Signal

## Task

Build a standalone local Playwright testing framework for Release Signal.

This framework is used to replace repeated manual M18 regression checks with a local automation set.

The framework must live only under:

```text
./qa/
```

Do not modify the Release Signal application source.

---

## Hard Boundary

Before doing anything:

1. Read `AGENTS.md`.
2. Read `docs/release-signal-current-state.md` if present.
3. Confirm you understand the Release Signal architecture rule:

```text
AI → parsed → structured artifacts → deterministic system logic → UI
```

Do not modify any files outside `./qa/`.

Forbidden to modify:

```text
app/
lib/
prisma/
root package.json
root configs
existing source files
.env files outside /qa
```

After implementation, run:

```bash
git diff --stat
```

Expected result:

```text
Only qa/... files changed
```

Do not push.
Do not merge.
Do not delete branches.
Do not rebase.

---

## Product Context

Release Signal is a Next.js / React / TypeScript QA intelligence platform running locally at:

```text
http://localhost:3000
```

It uses Auth0 for authentication.

The app has these key workflows:

```text
Refine Requirement → produces RefinedRequirement
Generate Tests → produces TestSuiteArtifact
Review Suite → produces PersistedReviewResult with score
Generate Next Batch → appends cases
Improve Test Plan → preserves/enhances existing suite; case count must remain >= 80%
Upload TXT or structured MD suite
Export JSON / Export CSV
Submit execution evidence → persists ExecutionIntelligenceArtifact
Release Readiness report → derived from requirement, suite, review, and execution evidence
```

Known UI facts:

```text
Workspace shows Feature Workspace / artifact cards
Cards include Requirement, Test Suite, Review, Execution Evidence, Workspace Health
Release Readiness Report is a collapsed/expandable panel below cards
Session modes are Strategy, Test Design, Test Review
```

In Test Review mode, the correct actions are:

```text
Review Suite
Export JSON
Export CSV
Submit Execution Evidence
```

Regression must catch if Test Review mode incorrectly shows only `Generate Tests`.

---

## Required Folder Structure

Create exactly this standalone QA project:

```text
qa/
  package.json
  playwright.config.ts
  .env.example
  README.md
  tests/
    smoke.spec.ts
    regression.spec.ts
  helpers/
    auth.ts
    navigate.ts
  fixtures/
    sessions.json
```

Optional but recommended inside `/qa`:

```text
qa/.gitignore
```

If added, it should ignore:

```text
.env
helpers/auth.json
test-results/
playwright-report/
node_modules/
```

Do not add or modify root `.gitignore`.

---

## package.json Requirements

Create `qa/package.json`.

It must include:

### devDependencies

```text
@playwright/test
dotenv
```

### scripts

```json
{
  "smoke": "playwright test tests/smoke.spec.ts",
  "regression": "playwright test tests/regression.spec.ts",
  "test:all": "playwright test",
  "test:headed": "playwright test --headed",
  "test:debug": "playwright test --debug"
}
```

---

## playwright.config.ts Requirements

Create `qa/playwright.config.ts`.

It must:

- Load `.env` with `dotenv`.
- Use `baseURL: process.env.BASE_URL || 'http://localhost:3000'`.
- Run headed by default so the browser is visible locally.
- Run headless only if `HEADLESS=true`.
- Use Chromium only.
- Use `retries: 1`.
- Use `trace: 'on-first-retry'`.
- Use `screenshot: 'only-on-failure'`.
- Use `video: 'retain-on-failure'`.
- Use `outputDir: './test-results'`.
- Use `actionTimeout: 15000`.
- Use `navigationTimeout: 30000`.
- Use `globalSetup: './helpers/auth.ts'`.
- Use `storageState` from `./helpers/auth.json` if that file exists.
- Use `undefined` storageState if `auth.json` does not exist.
- Use `path.join(__dirname, ...)` for file paths.

Important config behavior:

```ts
headless: process.env.HEADLESS === "true"
```

Default must be headed/visible browser.

---

## .env.example Requirements

Create `qa/.env.example`:

```env
BASE_URL=http://localhost:3000
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
HEADLESS=false
# SESSION_ID_FULL=
# SESSION_ID_EMPTY=
# SESSION_ID_NO_EXECUTION=
# SESSION_ID_EXISTING_SUITE=
# SESSION_ID_BLOCKED_EXECUTION=
```

---

## helpers/auth.ts Requirements

Create `qa/helpers/auth.ts`.

Purpose:

Log in once through Auth0 and save session state so all tests reuse it.

Must export a default `globalSetup` function.

Behavior:

1. If `helpers/auth.json` exists and is less than 8 hours old, skip login.
2. Otherwise launch Chromium headed.
3. Navigate to `BASE_URL`.
4. Detect whether the app is already authenticated.
5. If Auth0 login is shown:
   - Fill `TEST_EMAIL` if available.
   - Handle two-step email/password login if needed.
   - Fill `TEST_PASSWORD` if available.
   - Submit login.
6. If automated Auth0 login is blocked or credentials are missing:
   - Allow manual login in headed browser.
   - Save `storageState` after the app loads.
7. Wait for the Release Signal app/workspace to load.
8. Save `storageState` to `helpers/auth.json`.
9. Never commit real credentials or `helpers/auth.json`.

Auth0 may use:

```text
email first
continue button
password second
cross-origin redirects
MFA
bot protection
```

Handle this defensively and document limitations in `qa/README.md`.

If `TEST_EMAIL` or `TEST_PASSWORD` are missing:

- Do not fail immediately.
- Open headed browser for manual login.
- Save storage state after successful login.

---

## helpers/navigate.ts Requirements

Create `qa/helpers/navigate.ts`.

Must export:

```ts
goToWorkspace(page, sessionId)
waitForWorkspaceReady(page)
waitForArtifactCard(page, cardName)
waitForActionButton(page, buttonName)
submitTextInput(page, text)
```

### goToWorkspace(page, sessionId)

- Navigates to a known session by ID.
- If no `sessionId` is provided, navigates to `/chat`.
- Session URL behavior may need to be inferred from the app.
- Prefer simple and safe navigation.

### waitForWorkspaceReady(page)

- Waits for Feature Workspace to be visible.
- Waits for loading indicators to disappear.
- Timeout: 20 seconds.

### waitForArtifactCard(page, cardName)

Waits for a specific card to be visible.

Supported card names:

```text
Requirement
Test Suite
Review
Execution Evidence
Workspace Health
```

### waitForActionButton(page, buttonName)

Waits for a workspace action button to be visible and enabled.

### submitTextInput(page, text)

Finds the main chat/text input, fills it, submits, and waits for the response to complete before returning.

Use accessible locators first.

---

## fixtures/sessions.json Requirements

Create `qa/fixtures/sessions.json`:

```json
{
  "note": "Add known session IDs here after seeding your database.",
  "fullArtifacts": "",
  "noExecution": "",
  "existingSuite": "",
  "emptyWorkspace": "",
  "blockedExecution": ""
}
```

Regression tests should use known session IDs.

If a required session ID is missing, use `test.skip()` with a descriptive message.

---

## smoke.spec.ts Requirements

Create `qa/tests/smoke.spec.ts`.

The smoke suite must contain 5 tests and complete in under 3 minutes total.

Each test:
- navigates to the app fresh
- is independent
- does not depend on previous test order

### Test 1 — App loads and workspace is accessible

- Navigate to `BASE_URL`.
- Confirm the app loads without error.
- Confirm the main workspace UI is visible.

### Test 2 — Can reach a workspace

- Navigate to `/chat`.
- Confirm Feature Workspace section is visible.
- Confirm at least one artifact card is present.

### Test 3 — Release Readiness panel is present

- Navigate to a workspace.
- Confirm Release Readiness Report exists in the DOM.
- It may be collapsed.
- Confirm it can be clicked/expanded.

### Test 4 — Export buttons are present when suite exists

- If `fixtures/sessions.json` has `fullArtifacts`, use it.
- Otherwise skip with `test.skip()` and a clear message.
- Confirm Export JSON and Export CSV buttons are visible.
- If export actions are inside a menu/dropdown, open the menu first using `getByRole()` before asserting.

### Test 5 — Session survives page reload

- Navigate to a workspace that has at least one artifact.
- Note the visible state.
- Reload the page.
- Confirm the same artifact state is present after reload.

---

## regression.spec.ts Requirements

Create `qa/tests/regression.spec.ts`.

Use one `describe` block per checklist area.

Each test must be independent.

Where a test requires a specific workspace state, use `fixtures/sessions.json`.

If the required session ID is empty, use `test.skip()` with a descriptive message explaining what state is needed.

Regression tests should prefer seeded sessions from `fixtures/sessions.json`.

Do not create full workflows through UI in regression tests unless explicitly necessary.

### describe('Requirement workflow')

Tests:

```text
Refine Requirement input field is present and accepts text
RefinedRequirement artifact card shows Ready state when requirement is persisted
Requirement refinement invalidates stale review
```

For stale review invalidation:
- Use a session with requirement + suite + review.
- Refine/update requirement materially.
- Confirm previous review is no longer treated as current.
- Confirm user is prompted or expected to re-review.
- If no suitable seeded session exists, skip with clear message.

### describe('Test Suite workflow')

Tests:

```text
Generate Tests button is present when requirement exists
Test Suite card shows case count when suite is persisted
Generate Next Batch appends cases and does not replace suite
Edit/save test case preserves structured fields
Export JSON button triggers file download
Export CSV button triggers file download
```

For Generate Next Batch:
- Read case count before.
- Trigger Generate Next Batch.
- Read case count after.
- Assert after count is greater than before.
- Assert existing first case is still present.
- If this requires a seeded session and none exists, skip with clear message.

For edit/save structured fields:
- Use a session with existing suite.
- Edit one test case.
- Save it.
- Confirm type, priority, preconditions, steps, expectedResults, tags, notes/body remain available.
- Export JSON and confirm edited case still has structured fields.
- If no suitable seeded session exists, skip with clear message.

### describe('Review workflow')

Tests:

```text
Review Suite button is present when suite exists
Review card shows score when review is persisted
Review score is a number between 0 and 100
```

### describe('Improve Test Plan')

Tests:

```text
Improve Test Plan button is present when suite exists
After Improve Test Plan completes, case count is >= 80% of the count before
```

Implementation:
- Read case count before.
- Trigger Improve Test Plan.
- Wait for completion.
- Read count after.
- Assert after count is at least 80% of before.
- If test is too slow or requires seeded state, skip unless `existingSuite` or `fullArtifacts` is configured.

### describe('File upload')

Tests:

```text
Upload option is visible in Test Review mode
Upload is blocked when a suite already exists
Upload TXT suite works in a clean workspace
Upload structured MD suite works in a clean workspace
```

For upload blocked:
- It may mean button disabled, not present, or explicit blocked message.
- Document the assertion in a comment.

For TXT / MD upload:
- Use `emptyWorkspace` session if configured.
- Upload sample file from generated temporary test fixture or inline-created file under `/qa/test-results/tmp`.
- Confirm TestSuiteArtifact appears.
- Confirm structured MD preserves structured fields.
- If no empty workspace session exists, skip with clear message.

### describe('Execution evidence')

Tests:

```text
Submit Execution Evidence option is present
Execution Evidence card shows Not Started when no evidence
Review score shown in workspace is unchanged after execution evidence is submitted
Execution Evidence import creates/preserves ExecutionIntelligenceArtifact
```

### describe('Release Readiness')

Tests:

```text
Report panel is present in the workspace
Insufficient Data status shows when execution evidence is missing
Readiness status appears exactly once in the panel
Blocked status shows when execution evidence is blocked
Workspace Health card renders
```

The “status appears exactly once” test is a regression guard for the M18-B2 layout duplication bug.

### describe('Session behavior')

Tests:

```text
Artifacts survive page reload
Switching sessions loads the correct workspace
```

### describe('Workspace actions by mode')

Tests:

```text
In Test Review mode, Review Suite action is visible
In Test Review mode, Export JSON action is visible
In Test Review mode, Export CSV action is visible
In Test Review mode, Submit Execution Evidence is visible
In Test Review mode, Generate Tests is NOT the only action
```

The final test is a regression guard for the M18-B1 bug.

---

## M18 Manual Checklist Automation Target

This `/qa` Playwright project must support automation for this M18 regression checklist:

```text
1. Refine Requirement on existing refined requirement
2. Generate Tests
3. Review Test Suite
4. Improve Test Plan
5. Generate Next Batch
6. Edit/save a test case and confirm structured fields persist
7. Export JSON
8. Export CSV
9. Upload TXT suite
10. Upload structured MD suite
11. Execution Evidence import
12. Release Readiness panel
13. Workspace Health card
14. Session switch
15. Page refresh / artifact rehydration
16. Requirement refinement invalidates stale review
```

Important:
- Prefer seeded sessions from `fixtures/sessions.json`.
- Do not create all artifacts from scratch in every regression test.
- If a state-specific session ID is missing, skip with a clear message.
- Add comments explaining which seeded state each test requires.
- Keep smoke tests fast.
- Keep long/mutating tests in regression, not smoke.

---

## README.md Requirements

Create `qa/README.md`.

It must contain exactly these sections:

```markdown
### Prerequisites
### Install
### Configure
### First run — authenticate
### Run smoke suite (fast check, < 3 min)
### Run full regression suite
### Run everything
### Watch mode / debug
### After a code change — what to run
### Test results and failure reports
### Adding known session IDs
```

### Required README content

Under `Prerequisites`, include:

```text
Node.js 18+
Release Signal running at http://localhost:3000
Valid test account credentials
```

Under `Install`, include:

```bash
cd qa
npm install
npx playwright install chromium
```

Under `Configure`, include:

```bash
cp .env.example .env
# Edit .env with your BASE_URL and test credentials
```

Under `First run — authenticate`, explain:

```text
The first time any test runs, Playwright logs in through Auth0 and saves the session.
If automated login is blocked, complete login manually in the headed browser.
The session is saved to helpers/auth.json.
Do not commit helpers/auth.json.
```

Under `Run smoke suite`, include:

```bash
npm run smoke
```

Under `Run full regression suite`, include:

```bash
npm run regression
```

Under `Run everything`, include:

```bash
npm run test:all
```

Under `Watch mode / debug`, include:

```bash
npm run test:debug
```

Under `After a code change — what to run`, include:

```text
For UI-only changes: npm run smoke
For any logic change: npm run test:all
```

Under `Test results and failure reports`, include:

```text
Screenshots, traces, and videos saved to: ./test-results/
Open trace viewer: npx playwright show-trace test-results/<trace-file>
```

Under `Adding known session IDs`, explain:

```text
Edit fixtures/sessions.json with session IDs from your running Release Signal instance.
Tests that require specific artifact states will use these.
Without them, those tests will be skipped with a descriptive message.
```

Also state:

```text
This /qa framework is isolated and must not modify Release Signal application source.
```

---

## Test Constraints

- Do not use `waitForTimeout()` anywhere.
- Use `expect().toBeVisible()`, `waitForResponse()`, `waitForLoadState()`, and web-first assertions.
- Use `getByRole()` and `getByText()` first.
- Avoid CSS selectors and XPath unless no reasonable accessible locator exists.
- Each test must pass independently when run in isolation.
- Do not depend on test execution order.
- All file paths must be relative to `./qa`.
- Use TypeScript throughout.

---

## Acceptance Criteria

1. `cd qa && npm install` completes without errors.
2. `npx playwright install chromium` completes.
3. `npm run smoke` runs; skips are acceptable if session IDs are missing.
4. `npm run regression` runs; skipped tests are acceptable, failing tests are not.
5. `README.md` contains all required sections.
6. No files outside `./qa/` are modified.
7. `git diff --stat` shows only `qa/` files.

---

## After Implementation

After implementation:

```bash
git diff --stat
```

Then report:
- all created files
- whether any test files were skipped by design
- whether any file outside `/qa` was modified
- any assumptions made about selectors/routes/Auth0

Do not push.
Do not merge.

If any file outside `/qa` was modified, revert that change before reporting completion.
