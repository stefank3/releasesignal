import { defineConfig } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

// No dotenv, browser, web server, production URL, or automatic schema setup.
if (!['baseline', 'regression'].includes(process.env.LA01_TEST_PHASE ?? '')) {
  throw new Error('Set LA01_TEST_PHASE to baseline or regression explicitly');
}
if (!process.env.LA01_TEST_DATABASE_URL) throw new Error('LA01_TEST_DATABASE_URL is required');

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: 'la01-request-id.spec.ts',
  outputDir: path.join(os.tmpdir(), 'releasesignal-la01-results'),
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
});
