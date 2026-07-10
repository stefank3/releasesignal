import { expect, test } from '@playwright/test';
import {
  expectAuthenticatedMe,
  getMe,
  getSessionHistory,
  getSessionList,
  liveUrl,
  missingEnv,
  missingOptIn,
  missingStorageState,
  newLivePage,
  openWorkspace,
  postChatMessage,
  setupMessage
} from '../helpers/pr60Live';

const trialStateEnv = 'PR60_TRIAL_AUTH_STATE';
const adminStateEnv = 'PR60_ADMIN_AUTH_STATE';
const secondUserStateEnv = 'PR60_SECOND_USER_AUTH_STATE';
const ownerSessionEnv = 'PR60_OWNER_SESSION_ID_WITH_ARTIFACTS';

test.describe('PR60 Auth0 login/logout/callback smoke', () => {
  test('Auth0 login route starts an authorization flow without app 404s', async ({ page }) => {
    const missing = missingOptIn('PR60_ENABLE_AUTH0_ROUTE_SMOKE');
    test.skip(missing.length > 0, setupMessage('Auth0 route smoke is opt-in because it opens the live Auth0 flow', missing));

    const response = await page.goto(liveUrl('/auth/login?returnTo=/chat'), {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    expect(response?.status(), 'Login route should not produce an application 404').not.toBe(404);
    await expect
      .poll(() => page.url(), {
        timeout: 30000,
        message: 'Expected Auth0 login route to remain in app auth or redirect to Auth0/callback/chat'
      })
      .toMatch(/\/auth\/login|\/auth\/callback|\/chat|auth0|authorize/i);
  });

  test('Logout clears the authenticated account snapshot', async ({ browser }) => {
    const live = await newLivePage(browser, trialStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    const before = await expectAuthenticatedMe(live.page);
    expect(before.isAdmin, 'Logout smoke uses the normal trial account, not the admin account').toBe(false);

    await live.page.goto(liveUrl('/auth/logout'), { waitUntil: 'domcontentloaded' });

    await expect
      .poll(async () => (await getMe(live.page)).authenticated, {
        timeout: 30000,
        message: 'Expected /api/me to become unauthenticated after logout'
      })
      .toBe(false);
  });
});

test.describe('PR60 normal trial provisioning and credit charging', () => {
  test('Trial account exposes server-owned trial and credit state', async ({ browser }) => {
    const live = await newLivePage(browser, trialStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    const me = await expectAuthenticatedMe(live.page);

    expect(me.isAdmin, 'Normal trial account must not be marked admin').toBe(false);
    expect(me.organizationId, 'Trial account should have a server-owned organization').toBeTruthy();
    expect(me.planStatus, 'Trial account should be provisioned as trialing').toBe('trialing');
    expect(me.planCode, 'Trial account should keep the approved V1 trial plan code').toBe('trial_v1');
    expect(me.trialEndsAt, 'Trial account should expose a trial end timestamp').toBeTruthy();
    expect(me.currentPeriodEnd, 'Trial subscription should expose currentPeriodEnd').toBeTruthy();
    expect(me.creditsRemaining, 'Trial account should expose server-owned credits').toBeGreaterThanOrEqual(0);
    expect(me.trialDaysRemaining, 'Trial days remaining should be non-negative when present').toBeGreaterThanOrEqual(0);
  });

  test('Trial account chat request debits credits deterministically', async ({ browser }) => {
    const missing = [
      ...missingStorageState(trialStateEnv),
      ...missingOptIn('PR60_ENABLE_CREDIT_SPEND')
    ];
    test.skip(
      missing.length > 0,
      setupMessage('Live credit debit validation spends one trial credit and must be explicitly enabled', missing)
    );

    const live = await newLivePage(browser, trialStateEnv);
    if (!live.ok) return;

    const before = await expectAuthenticatedMe(live.page);
    expect(before.isAdmin, 'Credit debit validation must use a normal user').toBe(false);
    expect(before.planStatus, 'Credit debit validation requires an active trial account').toBe('trialing');
    expect(before.creditsRemaining, 'Credit debit validation requires available credits').toBeGreaterThan(0);

    const { status, body } = await postChatMessage(
      live.page,
      `PR60 regression credit debit smoke ${new Date().toISOString()}: summarize checkout happy-path QA risks.`
    );

    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.ok, JSON.stringify(body)).toBe(true);
    expect(body.creditsCharged, 'Normal trial user should be charged for AI-backed chat').toBeGreaterThan(0);
    expect(body.creditsRemaining, 'Chat response should report remaining server-owned credits').toBe(
      before.creditsRemaining - Number(body.creditsCharged)
    );

    const after = await expectAuthenticatedMe(live.page);
    expect(after.creditsRemaining, 'Subsequent /api/me should match the chat response balance').toBe(
      body.creditsRemaining
    );
  });
});

test.describe('PR60 admin no-trial/normal-credit-billing behavior', () => {
  test('Admin account is not provisioned as a normal trial user', async ({ browser }) => {
    const live = await newLivePage(browser, adminStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    const me = await expectAuthenticatedMe(live.page);

    expect(me.isAdmin, 'Admin test account must carry the Auth0 admin role').toBe(true);
    expect(me.planStatus, 'Admin account must not be converted into a trial subscription').not.toBe('trialing');
    expect(me.trialEndsAt, 'Admin account should not expose a trial end timestamp').toBeNull();
    expect(me.trialDaysRemaining, 'Admin account should not expose trial days remaining').toBeNull();
    expect(me.creditsRemaining, 'Admin account should expose a finite persisted credit balance').toBeGreaterThanOrEqual(0);
  });

  test('Admin chat request debits persisted credits', async ({ browser }) => {
    const missing = [
      ...missingStorageState(adminStateEnv),
      ...missingOptIn('PR60_ENABLE_ADMIN_CHAT_CHECK')
    ];
    test.skip(
      missing.length > 0,
      setupMessage('Live admin chat debit validation is opt-in because it spends persisted credits', missing)
    );

    const live = await newLivePage(browser, adminStateEnv);
    if (!live.ok) return;

    const before = await expectAuthenticatedMe(live.page);
    expect(before.isAdmin, 'Admin billing validation must use an admin account').toBe(true);
    expect(before.creditsRemaining, 'Admin credit debit validation requires available credits').toBeGreaterThan(0);

    const { status, body } = await postChatMessage(
      live.page,
      `PR60 regression admin credit debit smoke ${new Date().toISOString()}: summarize login smoke risks.`
    );

    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.ok, JSON.stringify(body)).toBe(true);
    expect(body.creditsCharged, 'Admin should be charged for AI-backed chat').toBeGreaterThan(0);
    expect(body.creditsRemaining, 'Admin chat response should report remaining persisted credits').toBe(
      before.creditsRemaining - Number(body.creditsCharged)
    );

    const after = await expectAuthenticatedMe(live.page);
    expect(after.creditsRemaining, 'Subsequent admin /api/me should match the chat response balance').toBe(
      body.creditsRemaining
    );
    expect(after.planStatus, 'Admin chat must not create a normal trial subscription').not.toBe('trialing');
  });
});

test.describe('PR60 user-switch/session state isolation', () => {
  test('Second user cannot load the first user seeded workspace by sessionId', async ({ browser }) => {
    const missing = [
      ...missingStorageState(trialStateEnv),
      ...missingStorageState(secondUserStateEnv),
      ...missingEnv([ownerSessionEnv])
    ];
    test.skip(
      missing.length > 0,
      setupMessage('Session isolation requires two live user storage states and one owner seeded session', missing)
    );

    const ownerSessionId = process.env[ownerSessionEnv]!.trim();
    const owner = await newLivePage(browser, trialStateEnv);
    const second = await newLivePage(browser, secondUserStateEnv);
    if (!owner.ok || !second.ok) return;

    const ownerMe = await expectAuthenticatedMe(owner.page);
    const secondMe = await expectAuthenticatedMe(second.page);
    expect(secondMe.auth0Sub, 'Isolation validation requires two different Auth0 users').not.toBe(ownerMe.auth0Sub);

    const ownerHistory = await getSessionHistory(owner.page, ownerSessionId);
    expect(ownerHistory.status(), 'Owner seeded session must be readable by its owner').toBe(200);
    const ownerHistoryBody = await ownerHistory.json();
    expect(ownerHistoryBody.artifact, 'Owner seeded session should include persisted artifacts for leakage detection').toBeTruthy();

    const secondHistory = await getSessionHistory(second.page, ownerSessionId);
    expect(secondHistory.status(), 'Cross-user session detail access must not leak owner history').toBe(404);

    const secondList = await getSessionList(second.page);
    expect(secondList.items?.map((item) => item.id)).not.toContain(ownerSessionId);
  });

  test('Stale local workspace identity does not expose previous user artifacts after switch', async ({ browser }) => {
    const missing = [
      ...missingStorageState(trialStateEnv),
      ...missingStorageState(secondUserStateEnv),
      ...missingEnv([ownerSessionEnv])
    ];
    test.skip(
      missing.length > 0,
      setupMessage('Stale-state isolation requires two live users and one owner seeded session', missing)
    );

    const ownerSessionId = process.env[ownerSessionEnv]!.trim();
    const owner = await newLivePage(browser, trialStateEnv);
    const second = await newLivePage(browser, secondUserStateEnv);
    if (!owner.ok || !second.ok) return;

    const ownerMe = await expectAuthenticatedMe(owner.page);
    await second.page.addInitScript((staleSub) => {
      window.localStorage.setItem('stefans-mvp-chat-last-auth0-sub-v1', staleSub);
    }, ownerMe.auth0Sub);

    await openWorkspace(second.page, ownerSessionId);

    await expect
      .poll(async () => (await getSessionHistory(second.page, ownerSessionId)).status(), {
        timeout: 15000,
        message: 'Second user should keep receiving a non-leaking response for the owner session'
      })
      .toBe(404);

    const ownerUniqueText = process.env.PR60_OWNER_UNIQUE_ARTIFACT_TEXT?.trim();
    if (ownerUniqueText) {
      await expect(second.page.getByText(ownerUniqueText, { exact: false })).toHaveCount(0);
    }
  });
});
