import { expect, type Browser, type Page, type Locator } from '@playwright/test';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { runInNewContext } from 'vm';
import { expectAuthenticatedMe, getSessionHistory, newLivePage } from './pr60Live';

export const roles = ['fresh', 'owner', 'zero', 'second', 'unentitled', 'admin'] as const;
export type Role = typeof roles[number];
type Account = { subject: string; state: string; sessionId?: string };
type Inventory = { origin: string; createdAt: string; accounts: Record<Role, Account> };
export type Snapshot = {
  organizationId: string | null;
  recordIds: string[]; periodStart: number | null; periodEnd: number | null;
  subjectGrants: number; sessions: number; messages: number;
  members: number; organizations: number; subscriptions: number; trials: number;
  wallets: number; grants: number; grantTotal: number; balance: number | null;
  entries: number; total: number; debits: number;
};
export type Artifact = {
  refinedRequirement?: { version?: number };
  testSuite?: { version: number; cases: Array<{ id: string }> };
  reviewResult?: { score: number };
  executionIntelligence?: unknown;
};
const repo = path.resolve(__dirname, '../..');

function externalFile(file: string): string {
  if (!path.isAbsolute(file)) throw new Error('PR10 private fixture paths must be absolute');
  const resolved = fs.realpathSync(file);
  const relative = path.relative(fs.realpathSync(repo), resolved);
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    throw new Error('PR10 private fixtures must be outside the repository');
  }
  return resolved;
}

export function loadInventory(): Inventory {
  for (const key of ['PR10_ENABLE_LIVE', 'PR10_ALLOW_PROVISIONING', 'PR10_ALLOW_AI_SPEND',
    'PR10_ALLOW_EVIDENCE_WRITE', 'PR10_ALLOW_ZERO_CHECK', 'PR10_ALLOW_AUTH_FLOW']) {
    if (process.env[key] !== 'true') throw new Error(`PR10 requires explicit ${key}=true; see qa/README.md`);
  }
  if (process.env.HEADLESS !== 'false') throw new Error('PR10 login restoration requires HEADLESS=false');
  for (const key of ['BASE_URL', 'PR10_ALLOWED_ORIGIN', 'PR10_DATABASE_URL', 'PR10_INVENTORY']) {
    if (!process.env[key]?.trim()) throw new Error(`PR10 requires ${key}`);
  }
  const budget = Number(process.env.PR10_CREDIT_BUDGET);
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 100) {
    throw new Error('PR10_CREDIT_BUDGET must be an explicitly approved integer from 1 to 100');
  }
  const url = new URL(process.env.BASE_URL!);
  if (url.origin !== process.env.PR10_ALLOWED_ORIGIN || url.protocol !== 'https:' ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      /(^|\.)releasesignal\.io$/i.test(url.hostname)) {
    throw new Error('PR10 requires an explicitly allowed non-production HTTPS origin');
  }
  const inventory = JSON.parse(fs.readFileSync(externalFile(process.env.PR10_INVENTORY!), 'utf8')) as Inventory;
  const age = Date.now() - Date.parse(inventory.createdAt);
  if (inventory.origin !== url.origin || !Number.isFinite(age) || age < -60_000 || age > 12 * 60_000) {
    throw new Error('PR10 inventory must match BASE_URL and be freshly prepared (12 minutes maximum)');
  }
  const subjects = new Set<string>();
  const files = new Set<string>();
  for (const role of roles) {
    const account = inventory.accounts?.[role];
    if (!account?.subject?.trim() || !account.state) throw new Error(`Missing PR10 ${role} account`);
    account.state = externalFile(account.state);
    if (subjects.has(account.subject) || files.has(account.state)) throw new Error('PR10 roles must be distinct');
    subjects.add(account.subject);
    files.add(account.state);
    const state = JSON.parse(fs.readFileSync(account.state, 'utf8'));
    if (!Array.isArray(state.cookies) || !state.cookies.length || !Array.isArray(state.origins)) {
      throw new Error(`Invalid ${role} storage state`);
    }
    const intents = state.cookies.filter((cookie: { name: string }) => cookie.name === 'rs_beta_signup');
    if (intents.length) throw new Error(`${role} must begin without a signup intent`);
  }
  if (!inventory.accounts.zero.sessionId) throw new Error('Zero-credit account requires its own persisted suite session');
  return inventory;
}

// Explicit connection, bounded SELECT only, read-only transaction; never imports application Prisma.
export async function snapshot(subject: string, requestId = ''): Promise<Snapshot> {
  const client = new Client({ connectionString: process.env.PR10_DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '10000ms'");
    const result = await client.query(`WITH m AS (SELECT * FROM "OrgMember" WHERE "auth0Sub" = $1),
      w AS (SELECT * FROM "CreditWallet" WHERE "organizationId" IN (SELECT "organizationId" FROM m) AND currency = 'credits'),
      l AS (SELECT * FROM "CreditLedger" WHERE "walletId" IN (SELECT id FROM w)),
      s AS (SELECT * FROM "Subscription" WHERE "organizationId" IN (SELECT "organizationId" FROM m))
      SELECT (SELECT min("organizationId") FROM m) AS "organizationId",
      (SELECT count(*)::int FROM m) AS members,
      ARRAY(SELECT id FROM m UNION SELECT id FROM w UNION SELECT id FROM s
        UNION SELECT id FROM l WHERE reason = 'trial_grant' ORDER BY id) AS "recordIds",
      (SELECT (extract(epoch FROM min("currentPeriodStart")) * 1000)::float8 FROM s) AS "periodStart",
      (SELECT (extract(epoch FROM min("currentPeriodEnd")) * 1000)::float8 FROM s) AS "periodEnd",
      (SELECT count(*)::int FROM "CreditLedger" WHERE "auth0Sub" = $1 AND reason = 'trial_grant') AS "subjectGrants",
      (SELECT count(*)::int FROM "ChatSession" WHERE "auth0Sub" = $1) AS sessions,
      (SELECT count(*)::int FROM "ChatMessage" WHERE "auth0Sub" = $1) AS messages,
      (SELECT count(*)::int FROM "Organization" WHERE id IN (SELECT "organizationId" FROM m)) AS organizations,
      (SELECT count(*)::int FROM s) AS subscriptions,
      (SELECT count(*)::int FROM s WHERE "planCode" = 'trial_v1' AND status = 'trialing') AS trials,
      (SELECT count(*)::int FROM w) AS wallets, (SELECT sum(balance)::int FROM w) AS balance,
      (SELECT count(*)::int FROM l WHERE reason = 'trial_grant') AS grants,
      (SELECT coalesce(sum(delta),0)::int FROM l WHERE reason = 'trial_grant') AS "grantTotal",
      (SELECT count(*)::int FROM l) AS entries, (SELECT coalesce(sum(delta),0)::int FROM l) AS total,
      (SELECT count(*)::int FROM l WHERE "requestId" = $2 AND delta < 0) AS debits`, [subject, requestId]);
    await client.query('COMMIT');
    return result.rows[0] as Snapshot;
  } finally {
    await client.end();
  }
}

export function expectTrial(value: Snapshot) {
  expect(value).toMatchObject({ members: 1, organizations: 1, subscriptions: 1,
    trials: 1, wallets: 1, grants: 1, grantTotal: 100, subjectGrants: 1 });
  expect(value.balance).toBeGreaterThanOrEqual(0);
}

export async function preparePages(browser: Browser, inventory: Inventory, pages: Partial<Record<Role, Page>>) {
  // Validate every identity and DB prerequisite before the first provisioning or AI request.
  for (const role of roles) {
    const account = inventory.accounts[role];
    const env = `PR10_INTERNAL_${role.toUpperCase()}_STATE`;
    process.env[env] = account.state;
    const live = await newLivePage(browser, env);
    if (!live.ok) throw new Error(`Unable to open PR10 ${role} context`);
    pages[role] = live.page;
    await live.page.setViewportSize({ width: 1440, height: 1000 });
    await live.page.addInitScript(() => localStorage.setItem('release-signal-v1-2-guided-tour', 'dismissed'));
    const profile = await live.page.request.get('/auth/profile', { maxRedirects: 0 });
    expect(profile.status(), `${role} authenticated profile`).toBe(200);
    expect((await profile.json()).sub === account.subject, `${role} identity matches approved inventory`).toBe(true);
    const state = await snapshot(account.subject);
    if (role === 'fresh' || role === 'unentitled') expect(state).toMatchObject({
      members: 0, organizations: 0, subscriptions: 0, wallets: 0, grants: 0, subjectGrants: 0, sessions: 0, messages: 0,
    });
    else {
      expect(state.members, `${role} must already be provisioned`).toBe(1);
      expect(state.wallets).toBe(1);
      if (role !== 'admin') expectTrial(state);
      if (role === 'zero') expect(state.balance).toBe(0);
      if (role === 'owner') expect(state.balance).toBeGreaterThanOrEqual(10);
      const me = await expectAuthenticatedMe(live.page);
      expect(me.organizationId, `${role} application and DB target agree`).toBe(state.organizationId);
      expect(me.creditsRemaining).toBe(state.balance);
      expect(me.isAdmin).toBe(role === 'admin');
      if (role === 'admin') expect(me.planCode).not.toBe('trial_v1');
      if (role === 'zero') {
        const saved = await artifact(live.page, account.sessionId!);
        expect(saved.testSuite?.cases.length, 'Zero account owns its prepared suite').toBeGreaterThan(0);
      }
    }
  }
}

export async function artifact(page: Page, sessionId: string): Promise<Artifact> {
  const response = await getSessionHistory(page, sessionId);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.artifact).toBeTruthy();
  return body.artifact as Artifact;
}

export async function uploadEvidence(page: Page, sessionId: string) {
  const before = await artifact(page, sessionId);
  expect(before.testSuite?.cases.length).toBeGreaterThan(0);
  const suite = before.testSuite!;
  const csv = ['suiteVersion,caseId,status', ...suite.cases.map(testCase =>
    `${suite.version},"${testCase.id.replace(/"/g, '""')}",passed`)].join('\n');
  // Synthetic execution evidence is restricted to the operator-approved disposable QA workspace.
  const response = await page.request.post(`/api/execution-evidence?sessionId=${encodeURIComponent(sessionId)}`, {
    multipart: { file: { name: 'pr10-controlled-results.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).executionIntelligence).toBeTruthy();
  const after = await artifact(page, sessionId);
  expect(after.executionIntelligence).toBeTruthy();
  expect(after.testSuite).toEqual(before.testSuite);
  expect(after.reviewResult).toEqual(before.reviewResult);
  return after;
}

export async function expectLayout(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
  const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  if (width === 375 && await collapse.isVisible()) await collapse.click();
  const me = await expectAuthenticatedMe(page);
  await expectReachable(page.getByText(`${me.creditsRemaining.toLocaleString()} credits left`, { exact: true }), width);
  for (const selector of ['main', '[data-testid="chat-header"]', '[data-testid="chat-header-user-bar"]']) {
    const element = page.locator(selector);
    await expect(element).toBeVisible();
    const bounds = await element.evaluate(el => ({ left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right, scroll: el.scrollWidth, client: el.clientWidth }));
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(width + 1);
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
}

// Select via SessionSidebar's actual title=sessionId button, never an unsupported query URL.
export async function selectWorkspace(page: Page, sessionId: string, marker?: string) {
  await openSettledWorkspace(page);
  const session = page.getByRole('button').and(page.getByTitle(sessionId, { exact: true }));
  await expect(session, 'Prepared workspace must be in the visible sidebar session list').toBeVisible();
  const [loaded] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === `/api/chat/history/${sessionId}` && r.status() === 200),
    session.click(),
  ]);
  const saved = (await loaded.json()).artifact as Artifact;
  await page.getByRole('button', { name: 'Strategy', exact: true }).click();
  for (const kind of ['requirement', 'suite', 'review', 'execution'] as const) {
    const present = { requirement: saved.refinedRequirement, suite: saved.testSuite,
      review: saved.reviewResult, execution: saved.executionIntelligence }[kind];
    if (!present) continue;
    const row = page.locator(`[data-artifact-row="${kind}"]`).first();
    await expect(row).toBeVisible();
    if (await row.getAttribute('open') === null) await row.locator('summary').click();
    if (kind === 'requirement' && marker) await expect(row.getByText(marker, { exact: false }).first()).toBeVisible();
    if (kind === 'suite') await expect(row.getByText(saved.testSuite!.cases[0].id, { exact: false }).first()).toBeVisible();
  }
  if (marker) expect(JSON.stringify(saved.refinedRequirement), 'Marker must exist in the persisted requirement').toContain(marker);
}

export async function expectReachable(control: Locator, width: number, enabled = false) {
  await expect(control).toBeVisible();
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport({ ratio: 1 });
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
  if (enabled) { await expect(control).toBeEnabled(); await control.click({ trial: true }); }
}

export async function openSettledWorkspace(page: Page) {
  const [history] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/chat/history'),
    page.goto('/chat', { waitUntil: 'domcontentloaded' }),
  ]);
  expect(history.status()).toBe(200);
  await history.finished();
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  const expand = page.getByRole('button', { name: 'Expand sidebar', exact: true });
  if (await expand.isVisible()) await expand.click();
  await expect(page.getByText('Feature Workspace', { exact: true })).toBeVisible();
}

// Static route contract plus the real account policy with an in-memory subscription; no server imports.
export async function expectReviewAuthorizationContract() {
  const route = fs.readFileSync(path.join(repo, 'app/api/chat/route.ts'), 'utf8');
  const guards = fs.readFileSync(path.join(repo, 'lib/server/chat/requestGuards.ts'), 'utf8');
  expect(route + guards).not.toContain('requireReviewAccess');
  expect(route).not.toContain('isAdminFromAccessToken');
  const stages = ['requireAuthenticatedUser', 'parseAndValidateChatRequest', 'ensureBillingPreconditions',
    'enforceRateLimit', 'loadOrCreateSession'];
  const calls = stages.map(name => route.indexOf(`await ${name}(`));
  expect(calls.every((offset, index) => offset >= 0 && (index === 0 || offset > calls[index - 1]))).toBe(true);
  for (const result of ['authResult', 'parsedRequest', 'billingResult', 'rateLimitResult']) {
    expect(route).toContain(`if (!${result}.ok)`);
    expect(route).toContain(`return ${result}.response;`);
  }
  expect(guards).toContain('resolvedAccount = await resolveOrgForUser(');
  expect(guards).toContain('await evaluateAccountAccess(');
  expect(guards).toContain('if (isAdmin)');
  expect(guards).toContain('if (orgState.wallet.balance <= 0)');
  const source = fs.readFileSync(path.join(repo, 'lib/billing/accountAccess.ts'), 'utf8');
  let subscription: { status: string; currentPeriodEnd: Date } | null = {
    status: 'trialing', currentPeriodEnd: new Date('2030-01-16T00:00:00Z'),
  };
  type Policy = (args: { organizationId?: string; wallet: { balance: number }; now: Date }) =>
    Promise<{ ok: boolean; reason?: string }>;
  const exports: { evaluateAccountAccess?: Policy } = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: (name: string) => {
      if (name === 'server-only') return {};
      if (name === '@/lib/prisma') return { prisma: { subscription: { findFirst: async () => subscription } } };
      throw new Error(`Unexpected dependency in offline account policy: ${name}`);
    },
  }, { timeout: 1000 });
  const check = (balance: number) => exports.evaluateAccountAccess!({ organizationId: 'offline-org',
    wallet: { balance }, now: new Date('2030-01-01T00:00:00Z') });
  expect((await check(10)).ok).toBe(true);
  expect(await check(0)).toMatchObject({ ok: false, reason: 'insufficient_credits' });
  subscription = { status: 'trialing', currentPeriodEnd: new Date('2029-12-31T00:00:00Z') };
  expect(await check(10)).toMatchObject({ ok: false, reason: 'trial_expired' });
  subscription = null;
  expect(await check(10)).toMatchObject({ ok: false, reason: 'subscription_missing' });
}
