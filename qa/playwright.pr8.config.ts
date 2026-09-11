import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: 'pr8-reviews.spec.ts',
  outputDir: path.join(__dirname, 'test-results', 'pr8'),
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    storageState: { cookies: [], origins: [] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
