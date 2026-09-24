import { test, expect, type Page, type Response } from '@playwright/test';
import { randomUUID } from 'crypto';
import { expectAuthenticatedMe, getSessionList, openWorkspace } from '../helpers/pr60Live';
import { artifact, expectLayout, expectTrial, loadInventory, preparePages, roles,
  snapshot, uploadEvidence, selectWorkspace, expectReachable, openSettledWorkspace, expectReviewAuthorizationContract, type Role } from '../helpers/pr10Gate';

test.describe('PR10 live Gate A (explicit authorization required)', () => {
  test.describe.configure({ mode: 'serial' });
  const pages: Partial<Record<Role, Page>> = {};
  let inventory: ReturnType<typeof loadInventory>;
  let ownerSession = '';
  const ownerMarker = `PR10-${randomUUID()}`;
  let aiAttempts = 0;
  let creditsSpent = 0;
  const pageFor = (role: Role) => pages[role]!;
  const subject = (role: Role) => inventory.accounts[role].subject;

  test.beforeAll(() => {
    inventory = loadInventory(); // No browser/network/DB activity before explicit opt-ins.
    console.info('PR10 evidence is INCOMPLETE unless all six live tests pass; filtered/offline runs cannot establish Gate A.');
  });
  test.beforeAll(async ({ browser }) => {
    await preparePages(browser, inventory, pages);
    let ownerRequests = 0;
    await pageFor('owner').route('**/api/chat', async route => {
      if (route.request().method() === 'POST' && ++ownerRequests > 5) {
        await route.abort('blockedbyclient');
        throw new Error('PR10 blocked an unexpected additional owner browser chat request');
      }
      await route.continue();
    });
  });
  test.afterAll(async () => {
    const results = await Promise.allSettled(roles.map(role => pages[role]?.context().close()));
    expect(results.every(result => result.status === 'fulfilled'), 'All owned contexts closed').toBe(true);
  });

  async function chargedClick(name: string): Promise<Response> {
    // Five workflow calls plus one ordinary replay; never loop to exhaust credits.
    expect(++aiAttempts, 'Bounded AI request count').toBeLessThanOrEqual(6);
    expect(creditsSpent, 'Stop before another request when the approved budget is consumed')
      .toBeLessThan(Number(process.env.PR10_CREDIT_BUDGET));
    const page = pageFor('owner');
    const before = await snapshot(subject('owner'));
    expect(before.balance).toBeGreaterThan(0);
    const [response] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === '/api/chat' && r.request().method() === 'POST',
        { timeout: 120_000 }),
      page.getByRole('button', { name, exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.sessionId).toEqual(expect.any(String));
    if (ownerSession) expect(body.sessionId).toBe(ownerSession);
    ownerSession = body.sessionId;
    expect(body.creditsCharged).toBeGreaterThan(0);
    creditsSpent += body.creditsCharged;
    expect(creditsSpent, 'Observed spending must remain within the approved budget')
      .toBeLessThanOrEqual(Number(process.env.PR10_CREDIT_BUDGET));
    const after = await snapshot(subject('owner'), response.request().headers()['x-request-id']);
    expect(after.balance).toBe(before.balance! - body.creditsCharged);
    expect(after.total).toBe(before.total - body.creditsCharged);
    expect(after.entries).toBe(before.entries + 1);
    expect(after.debits).toBe(1);
    expectTrial(after);
    expect((await expectAuthenticatedMe(page)).creditsRemaining).toBe(after.balance);
    return response;
  }

  async function responsiveActions(page: Page, width: number, billable = true) {
    await page.getByRole('button', { name: 'Test Design', exact: true }).click();
    const toolbar = page.getByLabel('Test Design workspace actions', { exact: true });
    for (const name of billable ? ['Improve Test Plan', 'Generate Next Batch', 'Review Test Suite'] : []) {
      await expectReachable(toolbar.getByRole('button', { name, exact: true }), width, true);
    }
    const exported = toolbar.getByRole('button', { name: 'Export JSON', exact: true });
    await expectReachable(exported, width, true);
    const [download] = await Promise.all([page.waitForEvent('download'), exported.click()]);
    expect(await download.failure()).toBeNull();
    await page.screenshot({ path: test.info().outputPath(`controls-${billable ? 'owner' : 'zero'}-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Strategy', exact: true }).click();
  }

  test('fresh candidate receives exactly one trial and 100 credits; repeated resolution is stable', async () => {
    const page = pageFor('fresh');
    const unprovisioned = await snapshot(subject('fresh'));
    expect(unprovisioned).toMatchObject({ members: 0, organizations: 0, subscriptions: 0,
      wallets: 0, grants: 0, subjectGrants: 0, sessions: 0, messages: 0 });
    // Hold callback navigation before any page can resolve/provision an account.
    const block = async (route: import('@playwright/test').Route) => route.abort('blockedbyclient');
    const blocked = (url: URL) => url.origin === inventory.origin && ['/chat', '/api/me', '/api/chat'].includes(url.pathname);
    await page.context().route(blocked, block);
    try {
      await page.goto('/');
      const entry = page.getByRole('link', { name: 'Start Trial', exact: true }).first();
      await expect(entry).toHaveAttribute('href', '/auth/start-trial');
      expect(await snapshot(subject('fresh'))).toEqual(unprovisioned);
      const callback = page.waitForResponse(r => new URL(r.url()).origin === inventory.origin &&
        new URL(r.url()).pathname === '/auth/callback', { timeout: 120_000 });
      const [returned] = await Promise.all([callback, entry.click({ noWaitAfter: true })]);
      expect(returned.status()).toBe(307);
      await returned.finished();
      const profile = await page.request.get('/auth/profile');
      expect(profile.status()).toBe(200);
      expect((await profile.json()).sub === subject('fresh')).toBe(true);
      expect((await page.context().cookies(inventory.origin)).some(c => c.name === 'rs_beta_signup')).toBe(true);
      expect(await snapshot(subject('fresh'))).toEqual(unprovisioned);
      const first = await expectAuthenticatedMe(page);
      expect(first.auth0Sub === subject('fresh')).toBe(true);
      expect(first).toMatchObject({ isAdmin: false, planCode: 'trial_v1', planStatus: 'trialing', creditsRemaining: 100 });
      expect(Math.abs(Date.parse(first.currentPeriodEnd!) - Date.parse(first.currentPeriodStart!) - 15 * 86400_000)).toBeLessThanOrEqual(1);
      const before = await snapshot(subject('fresh'));
      expectTrial(before);
      expect(before.balance).toBe(100);
      expect(first.organizationId).toBe(before.organizationId);
      expect(first.creditsRemaining).toBe(before.balance);
      for (const [api, db] of [[first.currentPeriodStart, before.periodStart], [first.currentPeriodEnd, before.periodEnd]] as const) {
        expect(Math.abs(Date.parse(api!) - db!)).toBeLessThanOrEqual(1);
      }
      expect(Math.abs(before.periodEnd! - before.periodStart! - 15 * 86400_000)).toBeLessThanOrEqual(1);
      const second = await expectAuthenticatedMe(page);
      expect(second).toEqual(first);
      expect(await snapshot(subject('fresh'))).toEqual(before);
    } finally { await page.context().unroute(blocked, block); }
    await openWorkspace(page);
    await expect(page.getByText('100 credits left', { exact: true })).toBeVisible();
  });

  test('Auth0-only identity cannot resolve entitlement or chat', async () => {
    const page = pageFor('unentitled');
    const before = await snapshot(subject('unentitled'));
    expect((await page.request.get('/api/me')).status()).toBe(403);
    const response = await page.request.post('/api/chat', {
      headers: { 'x-request-id': randomUUID() }, data: { mode: 'review', action: 'review_test_suite' },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.sessionId).toBeUndefined();
    expect(body.creditsCharged ?? 0).toBe(0);
    expect(await snapshot(subject('unentitled'))).toEqual(before);
  });

  test('one workspace: requirement, replay, refinement, design, review, improvement, evidence, reload', async () => {
    test.setTimeout(720_000);
    const page = pageFor('owner');
    const initial = await expectAuthenticatedMe(page);
    expect(initial.auth0Sub === subject('owner')).toBe(true);
    expect(initial.isAdmin).toBe(false);
    await openWorkspace(page);
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    await page.getByRole('textbox', { name: 'Requirement input', exact: true }).fill(
      `The feature is named ${ownerMarker}. Preserve this exact feature name in the requirement objective. ` +
      'A signed-in user can reset a forgotten password by email. Tokens expire after 15 minutes, ' +
      'are single-use, and return the same public response for known and unknown emails. ' +
      'Rate limit requests and invalidate existing sessions after a successful reset. ' +
      'Refine this requirement with acceptance criteria and negative paths.');
    const first = await chargedClick('Refine Requirement');
    expect(JSON.stringify((await artifact(page, ownerSession)).refinedRequirement)).toContain(ownerMarker);

    const requestId = first.request().headers()['x-request-id'];
    expect(requestId).toBeTruthy();
    const payload = first.request().postDataJSON();
    expect(payload.action, 'Replay probe must be an ordinary request').toBeUndefined();
    const beforeReplay = await snapshot(subject('owner'), requestId);
    expect(creditsSpent).toBeLessThan(Number(process.env.PR10_CREDIT_BUDGET));
    expect(++aiAttempts).toBeLessThanOrEqual(6);
    const replay = await page.request.post('/api/chat', {
      headers: { 'x-request-id': requestId }, data: { ...payload, sessionId: ownerSession }, timeout: 120_000,
    });
    expect(replay.status()).toBe(200);
    const replayBody = await replay.json();
    expect(replayBody.replay).toBe(true);
    expect(replayBody.sessionId).toBe(ownerSession);
    expect(replayBody.creditsRemaining).toBe(beforeReplay.balance);
    expect(await snapshot(subject('owner'), requestId)).toEqual(beforeReplay);
    expect((await expectAuthenticatedMe(page)).creditsRemaining).toBe(beforeReplay.balance);

    // Each explicit workflow action uses a fresh request ID. Their replay bypass is intentional.
    const requirement = (await artifact(page, ownerSession)).refinedRequirement;
    await chargedClick('Refine again');
    const refined = (await artifact(page, ownerSession)).refinedRequirement;
    expect(refined?.version).toBeGreaterThan(requirement?.version ?? 0);
    expect(JSON.stringify(refined)).toContain(ownerMarker);
    await chargedClick('Generate Tests');
    const designed = await artifact(page, ownerSession);
    expect(designed.testSuite?.cases.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Test Review', exact: true }).click();
    await chargedClick('Review Test Suite');
    const reviewed = await artifact(page, ownerSession);
    expect(reviewed.reviewResult?.score).toBeGreaterThanOrEqual(0);
    expect(reviewed.reviewResult?.score).toBeLessThanOrEqual(100);
    await page.getByRole('button', { name: 'Test Design', exact: true }).click();
    await chargedClick('Improve Test Plan');
    const improved = await artifact(page, ownerSession);
    expect(improved.testSuite?.version).toBeGreaterThan(designed.testSuite!.version);
    expect(improved.testSuite?.cases.length).toBeGreaterThan(0);
    const beforeFree = await snapshot(subject('owner'));
    const persisted = await uploadEvidence(page, ownerSession);
    expect(await snapshot(subject('owner'))).toEqual(beforeFree);
    await page.reload();
    await selectWorkspace(page, ownerSession, ownerMarker);
    expect(await artifact(page, ownerSession)).toEqual(persisted);
    await expect(page.getByText('Release Readiness', { exact: true }).first()).toBeVisible();
    for (const width of [1440, 375]) {
      await expectLayout(page, width);
      await responsiveActions(page, width);
      await expect(page.getByRole('button', { name: 'Test Design', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Test Review', exact: true })).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`owner-${width}.png`), fullPage: true });
    }
  });

  test('real zero balance rejects AI; export, evidence, readiness, and local controls remain usable', async () => {
    const page = pageFor('zero');
    const sessionId = inventory.accounts.zero.sessionId!;
    const me = await expectAuthenticatedMe(page);
    expect(me.creditsRemaining).toBe(0);
    const before = await snapshot(subject('zero'));
    expect(before.balance).toBe(0); // Assert the raw DB value in addition to displayed account state.
    for (const review of [false, true]) {
      const response = await page.request.post('/api/chat', {
        headers: { 'x-request-id': randomUUID() },
        data: review ? { mode: 'review', action: 'review_test_suite', sessionId } :
          { mode: 'coach', sessionId, message: 'Refine the current requirement.' },
      });
      expect(response.status()).toBe(402);
      expect((await response.json()).reason).toBe('insufficient_credits');
      const rejected = await snapshot(subject('zero'));
      expect(rejected.balance).toBe(0);
      expect(rejected).toEqual(before); // Persisted state immediately after rejection, before free operations.
    }
    for (const format of ['json', 'csv', 'execution-csv']) {
      const exported = await page.request.get(`/api/test-suites/export?sessionId=${encodeURIComponent(sessionId)}&format=${format}`);
      expect(exported.status()).toBe(200);
      expect((await exported.body()).length).toBeGreaterThan(0);
    }
    const persisted = await uploadEvidence(page, sessionId);
    await selectWorkspace(page, sessionId);
    for (const width of [1440, 375]) {
      await expectLayout(page, width);
      await responsiveActions(page, width, false);
      await expect(page.getByText('AI-assisted actions are unavailable', { exact: false })).toBeVisible();
      await expect(page.getByText('Release Readiness', { exact: true }).first()).toBeVisible();
      await page.screenshot({ path: test.info().outputPath(`zero-${width}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'New workspace', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Requirement input', exact: true });
    await input.fill('Local draft only');
    await page.getByRole('button', { name: 'Clear input', exact: true }).click();
    await expect(input).toHaveValue('');
    expect(await artifact(page, sessionId)).toEqual(persisted);
    expect(await snapshot(subject('zero'))).toEqual(before);
  });

  test('second user cannot see the owner session; admin boundaries preserve entitlements', async () => {
    const second = pageFor('second');
    const owner = await expectAuthenticatedMe(pageFor('owner'));
    const other = await expectAuthenticatedMe(second);
    expect(other.auth0Sub).not.toBe(owner.auth0Sub);
    expect(other.organizationId).not.toBe(owner.organizationId);
    expect((await second.request.get(`/api/chat/history/${encodeURIComponent(ownerSession)}`)).status()).toBe(404);
    expect((await getSessionList(second)).items?.some(item => item.id === ownerSession)).toBe(false);
    await selectWorkspace(pageFor('owner'), ownerSession, ownerMarker);
    await openSettledWorkspace(second);
    await expect(second.getByText(ownerMarker, { exact: false })).toHaveCount(0);
    await expect(second.getByRole('button').and(second.getByTitle(ownerSession, { exact: true }))).toHaveCount(0);
    expect((await second.request.get(`/api/chat/history/${encodeURIComponent(ownerSession)}`)).status()).toBe(404);
    const before = await snapshot(subject('admin'));
    const admin = await expectAuthenticatedMe(pageFor('admin'));
    expect(admin.isAdmin).toBe(true);
    expect(admin.planCode).not.toBe('trial_v1');
    for (const route of ['/admin', '/admin/metrics', '/admin/telemetry']) {
      expect((await pageFor('admin').goto(route))?.status()).toBe(200);
      expect((await second.goto(route))?.status()).toBe(404);
    }
    for (const route of ['/api/admin/metrics', '/api/admin/billing/overview']) {
      expect((await pageFor('admin').request.get(route)).status()).toBe(200);
      expect((await second.request.get(route)).status()).toBe(403);
    }
    expect(await snapshot(subject('admin'))).toEqual(before);
  });

  test('logout then real interactive Sign In restores the existing account and persisted workspace', async () => {
    const page = pageFor('owner');
    const before = await expectAuthenticatedMe(page);
    const ledger = await snapshot(subject('owner'));
    const saved = await artifact(page, ownerSession);
    await page.goto('/auth/logout');
    const anonymous = await page.request.get('/api/me');
    expect(anonymous.status()).toBe(200);
    expect((await anonymous.json()).authenticated).toBe(false);
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign In', exact: true }).first().click();
    // Operator completes Auth0/MFA for the SAME dedicated owner. No credential automation.
    await page.waitForURL(url => url.origin === inventory.origin && url.pathname === '/chat', { timeout: 120_000 });
    const restored = await expectAuthenticatedMe(page);
    for (const key of ['auth0Sub', 'organizationId', 'planCode', 'planStatus', 'creditsRemaining',
      'currentPeriodStart', 'currentPeriodEnd'] as const) expect(restored[key]).toBe(before[key]);
    expect(await snapshot(subject('owner'))).toEqual(ledger);
    await selectWorkspace(page, ownerSession, ownerMarker);
    expect(await artifact(page, ownerSession)).toEqual(saved);
  });
});

test.describe('PR10 preflight @offline', () => {
  // These checks exercise the real guard without opening a browser, reading credentials, or connecting to DB.
  const approvals = ['PR10_ENABLE_LIVE', 'PR10_ALLOW_PROVISIONING', 'PR10_ALLOW_AI_SPEND',
    'PR10_ALLOW_EVIDENCE_WRITE', 'PR10_ALLOW_ZERO_CHECK', 'PR10_ALLOW_AUTH_FLOW'];
  const keys = [...approvals, 'HEADLESS', 'BASE_URL', 'PR10_ALLOWED_ORIGIN',
    'PR10_DATABASE_URL', 'PR10_INVENTORY', 'PR10_CREDIT_BUDGET'];
  let saved: Record<string, string | undefined>;
  test.beforeEach(() => {
    saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    for (const key of approvals) process.env[key] = 'true';
    Object.assign(process.env, { HEADLESS: 'false', BASE_URL: 'https://qa.invalid',
      PR10_ALLOWED_ORIGIN: 'https://qa.invalid', PR10_DATABASE_URL: 'unused',
      PR10_INVENTORY: 'unused', PR10_CREDIT_BUDGET: '10' });
  });
  test.afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  test('every mutation class requires its own explicit approval', () => {
    for (const key of approvals) {
      delete process.env[key];
      expect(() => loadInventory()).toThrow(`${key}=true`);
      process.env[key] = 'true';
    }
  });
  test('production, HTTP, and mismatched origins are rejected before fixture access', () => {
    for (const origin of ['https://releasesignal.io', 'https://www.releasesignal.io', 'http://qa.invalid']) {
      process.env.BASE_URL = origin;
      process.env.PR10_ALLOWED_ORIGIN = origin;
      expect(() => loadInventory()).toThrow('non-production HTTPS origin');
    }
    process.env.BASE_URL = 'https://different.invalid';
    expect(() => loadInventory()).toThrow('non-production HTTPS origin');
  });
  test('review authorization retains normal account and credit gates', expectReviewAuthorizationContract);
  test('missing budget fails before fixture access', () => {
    delete process.env.PR10_CREDIT_BUDGET;
    expect(() => loadInventory()).toThrow('PR10_CREDIT_BUDGET');
  });
});
