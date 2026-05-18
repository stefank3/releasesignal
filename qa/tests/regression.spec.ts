import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import sessions from '../fixtures/sessions.json';
import {
  goToWorkspace,
  submitTextInput,
  waitForActionButton,
  waitForArtifactCard,
  waitForWorkspaceReady
} from '../helpers/navigate';

function requireSession(sessionId: string, description: string): void {
  test.skip(!sessionId, `Requires seeded session: ${description}. Add it to qa/fixtures/sessions.json.`);
}

async function visibleNumberNear(page: Page, label: RegExp): Promise<number> {
  const text = (await page.getByText(label).first().textContent()) || '';
  const match = text.match(/\d+/);
  expect(match, `Expected numeric value near ${label}`).not.toBeNull();
  return Number(match?.[0]);
}

async function readCaseCount(page: Page): Promise<number> {
  const text = (await page.getByText(/case|test/i).filter({ hasText: /\d+/ }).first().textContent()) || '';
  const match = text.match(/\d+/);
  expect(match, 'Expected visible case count').not.toBeNull();
  return Number(match?.[0]);
}

test.describe('Requirement workflow', () => {
  test('Refine Requirement input field is present and accepts text', async ({ page }) => {
    await goToWorkspace(page, sessions.emptyWorkspace || undefined);
    const input = page.getByRole('textbox').or(page.getByPlaceholder(/requirement|message|describe/i)).first();
    await expect(input).toBeVisible();
    await input.fill('Users can reset passwords through email verification.');
    await expect(input).toHaveValue(/reset passwords/i);
  });

  test('RefinedRequirement artifact card shows Ready state when requirement is persisted', async ({ page }) => {
    requireSession(sessions.noExecution || sessions.fullArtifacts, 'workspace with persisted refined requirement');
    await goToWorkspace(page, sessions.noExecution || sessions.fullArtifacts);
    await waitForArtifactCard(page, 'Requirement');
    await expect(page.getByText(/ready/i).first()).toBeVisible();
  });

  test('Requirement refinement invalidates stale review', async ({ page }) => {
    requireSession(sessions.fullArtifacts, 'requirement + suite + review where requirement can be refined');
    await goToWorkspace(page, sessions.fullArtifacts);
    await submitTextInput(page, 'Materially refine this requirement to include account lockout after repeated failures.');
    await expect(page.getByText(/review again|re-review|stale|out of date|needs review/i).first()).toBeVisible({
      timeout: 60000
    });
  });
});

test.describe('Test Suite workflow', () => {
  test('Generate Tests button is present when requirement exists', async ({ page }) => {
    requireSession(sessions.noExecution || sessions.emptyWorkspace, 'workspace with a requirement and no suite');
    await goToWorkspace(page, sessions.noExecution || sessions.emptyWorkspace);
    await waitForActionButton(page, 'Generate Tests');
  });

  test('Test Suite card shows case count when suite is persisted', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'workspace with persisted test suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForArtifactCard(page, 'Test Suite');
    expect(await readCaseCount(page)).toBeGreaterThan(0);
  });

  test('Generate Next Batch appends cases and does not replace suite', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'suite where next batch can append cases');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    const firstCase = (await page.getByText(/RS-|TC-|case/i).first().textContent()) || '';
    const before = await readCaseCount(page);
    await (await waitForActionButton(page, 'Generate Next Batch')).click();
    await expect.poll(async () => readCaseCount(page), { timeout: 120000 }).toBeGreaterThan(before);
    await expect(page.getByText(firstCase).first()).toBeVisible();
  });

  test('Edit/save test case preserves structured fields', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'suite with editable structured test cases');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await page.getByRole('button', { name: /edit/i }).first().click();
    await page.getByRole('textbox').first().fill('Updated title preserving structured fields');
    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/type|priority|preconditions|steps|expected|tags|notes|body/i).first()).toBeVisible();
  });

  test('Export JSON button triggers file download', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'suite available for JSON export');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    const download = page.waitForEvent('download');
    await (await waitForActionButton(page, 'Export JSON')).click();
    await download;
  });

  test('Export CSV button triggers file download', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'suite available for CSV export');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    const download = page.waitForEvent('download');
    await (await waitForActionButton(page, 'Export CSV')).click();
    await download;
  });
});

test.describe('Review workflow', () => {
  test('Review Suite button is present when suite exists', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Review Suite');
  });

  test('Review card shows score when review is persisted', async ({ page }) => {
    requireSession(sessions.fullArtifacts, 'workspace with persisted review result');
    await goToWorkspace(page, sessions.fullArtifacts);
    await waitForArtifactCard(page, 'Review');
    await expect(page.getByText(/score|\/100/i).first()).toBeVisible();
  });

  test('Review score is a number between 0 and 100', async ({ page }) => {
    requireSession(sessions.fullArtifacts, 'workspace with persisted review score');
    await goToWorkspace(page, sessions.fullArtifacts);
    const score = await visibleNumberNear(page, /score|\/100/i);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

test.describe('Improve Test Plan', () => {
  test('Improve Test Plan button is present when suite exists', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Improve Test Plan');
  });

  test('After Improve Test Plan completes, case count is >= 80% of the count before', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'suite that can be improved');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    const before = await readCaseCount(page);
    await (await waitForActionButton(page, 'Improve Test Plan')).click();
    await expect.poll(async () => readCaseCount(page), { timeout: 120000 }).toBeGreaterThanOrEqual(Math.ceil(before * 0.8));
  });
});

test.describe('File upload', () => {
  test('Upload option is visible in Test Review mode', async ({ page }) => {
    await goToWorkspace(page, sessions.existingSuite || sessions.emptyWorkspace || undefined);
    await expect(page.getByRole('button', { name: /upload/i }).or(page.getByText(/upload/i)).first()).toBeVisible();
  });

  test('Upload is blocked when a suite already exists', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'workspace where a suite already exists');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    const upload = page.getByRole('button', { name: /upload/i }).first();

    // Upload gating may render as disabled, hidden, or as a blocked message depending on the current UI.
    if (await upload.isVisible()) {
      await expect(upload).toBeDisabled();
    } else {
      await expect(page.getByText(/suite already exists|upload blocked|no overwrite|one workspace/i).first()).toBeVisible();
    }
  });

  test('Upload TXT suite works in a clean workspace', async ({ page }) => {
    requireSession(sessions.emptyWorkspace, 'clean workspace with no existing suite');
    const fixturePath = path.join(process.cwd(), 'test-results', 'tmp', 'sample-suite.txt');
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, 'TC-001 Password reset\nSteps: Request reset email\nExpected: Email is sent\n');
    await goToWorkspace(page, sessions.emptyWorkspace);
    await page.setInputFiles('input[type="file"]', fixturePath);
    await waitForArtifactCard(page, 'Test Suite');
  });

  test('Upload structured MD suite works in a clean workspace', async ({ page }) => {
    requireSession(sessions.emptyWorkspace, 'clean workspace with no existing suite');
    const fixturePath = path.join(process.cwd(), 'test-results', 'tmp', 'sample-suite.md');
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(
      fixturePath,
      '## TC-001 Password reset\nType: Functional\nPriority: High\nPreconditions: User exists\nSteps: Request reset email\nExpected Results: Email is sent\nTags: auth\nNotes: Smoke path\n'
    );
    await goToWorkspace(page, sessions.emptyWorkspace);
    await page.setInputFiles('input[type="file"]', fixturePath);
    await waitForArtifactCard(page, 'Test Suite');
    await expect(page.getByText(/Functional|High|Preconditions|Expected Results|auth/i).first()).toBeVisible();
  });
});

test.describe('Execution evidence', () => {
  test('Submit Execution Evidence option is present', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Submit Execution Evidence');
  });

  test('Execution Evidence card shows Not Started when no evidence', async ({ page }) => {
    requireSession(sessions.noExecution, 'workspace with no execution evidence');
    await goToWorkspace(page, sessions.noExecution);
    await waitForArtifactCard(page, 'Execution Evidence');
    await expect(page.getByText(/not started|no execution evidence/i).first()).toBeVisible();
  });

  test('Review score shown in workspace is unchanged after execution evidence is submitted', async ({ page }) => {
    requireSession(sessions.noExecution, 'workspace with review and no execution evidence');
    await goToWorkspace(page, sessions.noExecution);
    const before = await visibleNumberNear(page, /score|\/100/i);
    await (await waitForActionButton(page, 'Submit Execution Evidence')).click();
    await expect(page.getByText(/execution evidence|passed|failed|blocked/i).first()).toBeVisible();
    const after = await visibleNumberNear(page, /score|\/100/i);
    expect(after).toBe(before);
  });

  test('Execution Evidence import creates/preserves ExecutionIntelligenceArtifact', async ({ page }) => {
    requireSession(sessions.noExecution || sessions.fullArtifacts, 'workspace that accepts execution evidence');
    await goToWorkspace(page, sessions.noExecution || sessions.fullArtifacts);
    await (await waitForActionButton(page, 'Submit Execution Evidence')).click();
    await waitForArtifactCard(page, 'Execution Evidence');
  });
});

test.describe('Release Readiness', () => {
  test('Report panel is present in the workspace', async ({ page }) => {
    await goToWorkspace(page, sessions.fullArtifacts || undefined);
    await expect(page.getByText(/Release Readiness Report/i).first()).toBeVisible();
  });

  test('Insufficient Data status shows when execution evidence is missing', async ({ page }) => {
    requireSession(sessions.noExecution, 'workspace with suite and review but no execution evidence');
    await goToWorkspace(page, sessions.noExecution);
    await expect(page.getByText(/insufficient data/i).first()).toBeVisible();
  });

  test('Readiness status appears exactly once in the panel', async ({ page }) => {
    requireSession(sessions.fullArtifacts || sessions.noExecution, 'workspace with release readiness panel');
    await goToWorkspace(page, sessions.fullArtifacts || sessions.noExecution);
    await page.getByText(/Release Readiness Report/i).first().click();
    await expect(page.getByText(/insufficient data|not ready|weak|partial|ready with risk|ready|blocked/i)).toHaveCount(1);
  });

  test('Blocked status shows when execution evidence is blocked', async ({ page }) => {
    requireSession(sessions.blockedExecution, 'workspace with blocked execution evidence');
    await goToWorkspace(page, sessions.blockedExecution);
    await expect(page.getByText(/blocked/i).first()).toBeVisible();
  });

  test('Workspace Health card renders', async ({ page }) => {
    await goToWorkspace(page, sessions.fullArtifacts || undefined);
    await waitForArtifactCard(page, 'Workspace Health');
  });
});

test.describe('Session behavior', () => {
  test('Artifacts survive page reload', async ({ page }) => {
    requireSession(sessions.fullArtifacts || sessions.existingSuite, 'workspace with persisted artifacts');
    await goToWorkspace(page, sessions.fullArtifacts || sessions.existingSuite);
    await waitForArtifactCard(page, 'Test Suite');
    await page.reload();
    await waitForWorkspaceReady(page);
    await waitForArtifactCard(page, 'Test Suite');
  });

  test('Switching sessions loads the correct workspace', async ({ page }) => {
    requireSession(sessions.fullArtifacts && sessions.emptyWorkspace, 'two distinct seeded sessions');
    await goToWorkspace(page, sessions.fullArtifacts);
    await waitForArtifactCard(page, 'Test Suite');
    await goToWorkspace(page, sessions.emptyWorkspace);
    await expect(page.getByText(/empty|no requirement|Generate Tests|Requirement/i).first()).toBeVisible();
  });
});

test.describe('Workspace actions by mode', () => {
  test('In Test Review mode, Review Suite action is visible', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'test review workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Review Suite');
  });

  test('In Test Review mode, Export JSON action is visible', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'test review workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Export JSON');
  });

  test('In Test Review mode, Export CSV action is visible', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'test review workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Export CSV');
  });

  test('In Test Review mode, Submit Execution Evidence is visible', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'test review workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    await waitForActionButton(page, 'Submit Execution Evidence');
  });

  test('In Test Review mode, Generate Tests is NOT the only action', async ({ page }) => {
    requireSession(sessions.existingSuite || sessions.fullArtifacts, 'test review workspace with suite');
    await goToWorkspace(page, sessions.existingSuite || sessions.fullArtifacts);
    const actions = page.getByRole('button', {
      name: /Review Suite|Export JSON|Export CSV|Submit Execution Evidence|Generate Tests/i
    });
    await expect(actions).not.toHaveCount(1);
    await expect(page.getByRole('button', { name: /Review Suite/i }).first()).toBeVisible();
  });
});
