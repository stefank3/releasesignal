import { expect, type Locator, type Page } from '@playwright/test';

const busyStateLabelPattern =
  /^(?:loading|thinking|generating|reviewing|saving|sending|improving|uploading|analyzing|refining)(?: [^.\n]+)?(?:\.\.\.|…)$/i;

export async function goToWorkspace(page: Page, sessionId?: string): Promise<void> {
  await page.goto(sessionId ? `/chat?sessionId=${encodeURIComponent(sessionId)}` : '/chat');
  await waitForWorkspaceReady(page);
}

export async function waitForWorkspaceReady(page: Page): Promise<void> {
  await expect(page.getByText(/Feature Workspace/i).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(busyStateLabelPattern)).toHaveCount(0, {
    timeout: 20000
  });
}

export async function waitForArtifactCard(page: Page, cardName: string): Promise<Locator> {
  const card = page
    .getByRole('heading', { name: new RegExp(cardName, 'i') })
    .or(page.getByText(new RegExp(cardName, 'i')))
    .first();

  await expect(card).toBeVisible({ timeout: 20000 });
  return card;
}

export async function waitForActionButton(page: Page, buttonName: string): Promise<Locator> {
  const button = page.getByRole('button', { name: new RegExp(buttonName, 'i') }).first();
  await expect(button).toBeVisible({ timeout: 20000 });
  await expect(button).toBeEnabled({ timeout: 20000 });
  return button;
}

export async function submitTextInput(page: Page, text: string): Promise<void> {
  const input = page
    .getByRole('textbox')
    .or(page.getByPlaceholder(/message|requirement|describe|ask/i))
    .first();

  await input.fill(text);

  const responsePromise = page
    .waitForResponse((response) => response.url().includes('/api/chat') && response.request().method() === 'POST', {
      timeout: 30000
    })
    .catch(() => undefined);

  const submitButton = page.getByRole('button', { name: /send|submit|refine|generate/i }).first();

  if (await submitButton.isVisible()) {
    await submitButton.click();
  } else {
    await input.press('Enter');
  }

  await responsePromise;
  await expect(page.getByText(busyStateLabelPattern)).toHaveCount(0, { timeout: 60000 });
}
