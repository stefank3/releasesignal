import { expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export type MeResponse =
  | {
      authenticated: true;
      auth0Sub: string;
      email: string;
      isAdmin: boolean;
      organizationId: string;
      planCode: string | null;
      planStatus: string | null;
      trialEndsAt: string | null;
      creditsRemaining: number;
      trialDaysRemaining: number | null;
      seats: number | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
    }
  | { authenticated: false };

export type ChatResponse = {
  ok?: boolean;
  error?: string;
  sessionId?: string;
  creditsCharged?: number;
  creditsRemaining?: number | null;
  [key: string]: unknown;
};

type LivePageResult =
  | { ok: true; page: Page }
  | { ok: false; missing: string[]; message: string };

export function liveBaseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}

export function liveUrl(route: string): string {
  return new URL(route, liveBaseUrl()).toString();
}

function resolvePath(value: string): string {
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.cwd(), value);
}

export function missingEnv(names: string[]): string[] {
  return names.filter((name) => !process.env[name]?.trim());
}

export function missingStorageState(envName: string): string[] {
  const value = process.env[envName]?.trim();
  if (!value) return [envName];

  const resolved = resolvePath(value);
  return fs.existsSync(resolved) ? [] : [`${envName} (${resolved} not found)`];
}

export function missingOptIn(envName: string): string[] {
  return process.env[envName] === 'true' ? [] : [`${envName}=true`];
}

export function setupMessage(reason: string, missing: string[]): string {
  return `${reason}. Missing setup: ${missing.join(', ')}. See qa/.env.example and qa/README.md.`;
}

export async function newLivePage(browser: Browser, storageStateEnv: string): Promise<LivePageResult> {
  const missing = missingStorageState(storageStateEnv);
  if (missing.length) {
    return {
      ok: false,
      missing,
      message: setupMessage(`Requires ${storageStateEnv} with a valid Playwright storage state`, missing)
    };
  }

  const context = await browser.newContext({
    baseURL: liveBaseUrl(),
    storageState: resolvePath(process.env[storageStateEnv]!.trim())
  });

  const page = await context.newPage();
  return { ok: true, page };
}

export async function getMe(page: Page): Promise<MeResponse> {
  const response = await page.request.get(liveUrl('/api/me'));
  expect(response.ok(), `/api/me should return a readable account snapshot, got ${response.status()}`).toBe(true);
  return (await response.json()) as MeResponse;
}

export async function expectAuthenticatedMe(page: Page): Promise<Extract<MeResponse, { authenticated: true }>> {
  const me = await getMe(page);
  expect(me.authenticated, 'Expected authenticated /api/me account snapshot').toBe(true);
  return me as Extract<MeResponse, { authenticated: true }>;
}

export async function postChatMessage(page: Page, message: string): Promise<{ status: number; body: ChatResponse }> {
  const response = await page.request.post(liveUrl('/api/chat'), {
    data: {
      mode: 'coach',
      message
    }
  });

  return {
    status: response.status(),
    body: (await response.json()) as ChatResponse
  };
}

export async function openWorkspace(page: Page, sessionId?: string): Promise<void> {
  await page.goto(liveUrl(sessionId ? `/chat?sessionId=${encodeURIComponent(sessionId)}` : '/chat'), {
    waitUntil: 'domcontentloaded'
  });
}

export async function getSessionHistory(page: Page, sessionId: string) {
  return page.request.get(liveUrl(`/api/chat/history/${encodeURIComponent(sessionId)}`));
}

export async function getSessionList(page: Page) {
  const response = await page.request.get(liveUrl('/api/chat/history?limit=50'));
  expect(response.ok(), `/api/chat/history should be readable, got ${response.status()}`).toBe(true);
  return (await response.json()) as { items?: Array<{ id?: string }> };
}
