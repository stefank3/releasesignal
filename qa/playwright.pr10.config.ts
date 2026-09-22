import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

// Discovery is offline. Runtime prerequisites are enforced in the spec's beforeAll.
export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: 'pr10-beta-account-e2e.spec.ts',
  outputDir: path.join(__dirname, 'test-results', `pr10-${Date.now()}-${process.pid}`),
  workers: 1,
  retries: 0,
  repeatEach: 1,
  fullyParallel: false,
  maxFailures: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL,
    headless: process.env.HEADLESS !== 'false',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Authenticated traffic may contain credentials and signup-intent cookies.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'pr10-chromium', use: { ...devices['Desktop Chrome'] } }],
});
