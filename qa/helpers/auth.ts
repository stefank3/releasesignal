import { chromium, expect, type FullConfig, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const authStatePath = path.join(__dirname, 'auth.json');
const maxAuthAgeMs = 8 * 60 * 60 * 1000;

function hasFreshAuthState(): boolean {
  if (!fs.existsSync(authStatePath)) return false;
  return Date.now() - fs.statSync(authStatePath).mtimeMs < maxAuthAgeMs;
}

async function isWorkspaceVisible(page: Page): Promise<boolean> {
  const workspace = page.getByText(/Feature Workspace|Release Signal|Workspace Health/i).first();

  try {
    await expect(workspace).toBeVisible({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function clickIfVisible(page: Page, name: RegExp): Promise<boolean> {
  const button = page.getByRole('button', { name }).first();

  try {
    await button.click({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function fillIfVisible(page: Page, label: RegExp, value: string): Promise<boolean> {
  const input = page.getByLabel(label).or(page.getByPlaceholder(label)).first();

  try {
    await input.fill(value, { timeout: 7000 });
    return true;
  } catch {
    return false;
  }
}

async function attemptAutomatedAuth0Login(page: Page): Promise<void> {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) return;

  if (await fillIfVisible(page, /email/i, email)) {
    await clickIfVisible(page, /continue|next|log in|sign in/i);
  }

  if (await fillIfVisible(page, /password/i, password)) {
    await clickIfVisible(page, /continue|log in|sign in|submit/i);
  }
}

async function waitForWorkspaceAfterLogin(page: Page): Promise<void> {
  await expect
    .poll(async () => isWorkspaceVisible(page), {
      timeout: 180000,
      message: 'Release Signal workspace did not load. Complete Auth0 login manually in the headed browser.'
    })
    .toBe(true);
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (hasFreshAuthState()) return;

  fs.mkdirSync(path.dirname(authStatePath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  await page.goto(new URL('/chat', baseURL).toString(), { waitUntil: 'load' }).catch(async () => {
    await page.goto(baseURL, { waitUntil: 'load' });
  });

  if (!(await isWorkspaceVisible(page))) {
    await attemptAutomatedAuth0Login(page);
  }

  await waitForWorkspaceAfterLogin(page);
  await page.context().storageState({ path: authStatePath });
  await browser.close();
}
