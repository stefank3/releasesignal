import { expect, test } from '@playwright/test';
import sessions from '../fixtures/sessions.json';
import { goToWorkspace, waitForArtifactCard, waitForWorkspaceReady } from '../helpers/navigate';

test.describe('Smoke', () => {
  test('Public app or authenticated workspace loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Release Signal/i);
    await expect(page.getByRole('heading', { name: /Release Signal/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in/i }).first()).toBeVisible();
  });

  test('Can reach authenticated workspace', async ({ page }) => {
    await goToWorkspace(page);
    await expect(page.getByText(/Feature Workspace/i).first()).toBeVisible();
    await expect(page.getByText(/Requirement|Test Suite|Review|Execution Evidence/i).first()).toBeVisible();
    await expect(page.getByText(/Workspace Health|Workspace Status/i)).toHaveCount(0);
  });

  test('Release Readiness panel is present', async ({ page }) => {
    await goToWorkspace(page);
    const panel = page.getByText(/Release Readiness Report/i).first();
    await expect(panel).toBeVisible();
    await panel.click();
    await expect(panel).toBeVisible();
  });

  test('Export buttons are present when suite exists', async ({ page }) => {
    test.skip(!sessions.fullArtifacts, 'Requires fixtures.sessions.fullArtifacts with a persisted suite.');

    await goToWorkspace(page, sessions.fullArtifacts);

    const menu = page.getByRole('button', { name: /export|actions|more/i }).first();
    if (await menu.isVisible()) {
      await menu.click();
    }

    await expect(page.getByRole('button', { name: /Export JSON/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i }).first()).toBeVisible();
  });

  test('Session survives page reload', async ({ page }) => {
    const sessionId = sessions.fullArtifacts || sessions.existingSuite || sessions.noExecution;
    test.skip(!sessionId, 'Requires a seeded session with at least one persisted artifact.');

    await goToWorkspace(page, sessionId);
    await waitForArtifactCard(page, sessions.fullArtifacts || sessions.existingSuite ? 'Test Suite' : 'Requirement');
    const before = await page.getByText(/Requirement|Test Suite|Review|Execution Evidence/i).first().textContent();

    await page.reload();
    await waitForWorkspaceReady(page);
    await expect(page.getByText(before || /Requirement|Test Suite|Review|Execution Evidence/i).first()).toBeVisible();
    await expect(page.getByText(/Workspace Health|Workspace Status/i)).toHaveCount(0);
  });
});
