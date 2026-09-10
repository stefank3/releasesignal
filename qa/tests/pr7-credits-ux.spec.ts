import { expect, test, type Page } from '@playwright/test';
import {
  expectAuthenticatedMe,
  newLivePage,
  openWorkspace,
  type MeResponse
} from '../helpers/pr60Live';

const trialStateEnv = 'PR60_TRIAL_AUTH_STATE';

async function expectVisibleBalance(page: Page, credits: number) {
  await expect(page.getByText(`${credits.toLocaleString()} credits left`, { exact: false })).toBeVisible();
}

async function routeAccountSnapshot(
  page: Page,
  initial: Extract<MeResponse, { authenticated: true }>,
  getCreditsRemaining: () => number
) {
  await page.route('**/api/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...initial,
        creditsRemaining: getCreditsRemaining()
      })
    });
  });
}

test.describe('PR7 credits visibility and exhaustion UX', () => {
  test('authenticated beta user sees the persisted server-owned balance', async ({ browser }) => {
    const live = await newLivePage(browser, trialStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    const me = await expectAuthenticatedMe(live.page);
    expect(me.isAdmin, 'PR7 balance UX validation uses a normal beta account').toBe(false);

    await openWorkspace(live.page);
    await expectVisibleBalance(live.page, me.creditsRemaining);

    if (me.planStatus === 'trialing' && typeof me.trialDaysRemaining === 'number') {
      await expect(
        live.page.getByText(`${me.trialDaysRemaining} days left`, { exact: false })
      ).toBeVisible();
    }
  });

  test('server-returned post-action balance updates and reconciles without client arithmetic', async ({ browser }) => {
    const live = await newLivePage(browser, trialStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    const me = await expectAuthenticatedMe(live.page);
    test.skip(me.creditsRemaining <= 0, 'Requires an account with a positive starting balance');

    const serverBalance = Math.max(0, me.creditsRemaining - 1);
    let accountBalance = me.creditsRemaining;

    await routeAccountSnapshot(live.page, me, () => accountBalance);
    await live.page.route('**/api/chat', async (route) => {
      accountBalance = serverBalance;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'x-request-id': 'pr7-balance-sync-request' },
        body: JSON.stringify({
          ok: true,
          mode: 'coach',
          reply: 'PR7 controlled response.',
          sessionId: 'pr7-controlled-session',
          creditsCharged: 1,
          creditsRemaining: serverBalance,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          artifact: null,
          artifactUpdatedAt: null
        })
      });
    });

    await openWorkspace(live.page);
    await expectVisibleBalance(live.page, me.creditsRemaining);

    await live.page.getByLabel('Requirement input').fill('PR7 controlled balance sync validation');
    await live.page.getByRole('button', { name: 'Refine Requirement', exact: true }).click();

    await expectVisibleBalance(live.page, serverBalance);
  });

  test('credit-specific 402 immediately exposes zero-credit state and beta recovery guidance', async ({ browser }) => {
    const live = await newLivePage(browser, trialStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    const me = await expectAuthenticatedMe(live.page);
    expect(me.isAdmin).toBe(false);
    let accountBalance = me.creditsRemaining;

    await routeAccountSnapshot(live.page, me, () => accountBalance);
    await live.page.route('**/api/chat', async (route) => {
      accountBalance = 0;
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        headers: { 'x-request-id': 'pr7-zero-credit-request' },
        body: JSON.stringify({
          ok: false,
          mode: 'coach',
          error: 'Account access required',
          reason: 'insufficient_credits',
          creditsRemaining: 0,
          planStatus: 'trialing',
          currentPeriodEnd: me.currentPeriodEnd
        })
      });
    });

    await openWorkspace(live.page);
    await live.page.getByLabel('Requirement input').fill('PR7 controlled zero-credit validation');
    await live.page.getByRole('button', { name: 'Refine Requirement', exact: true }).click();

    await expectVisibleBalance(live.page, 0);
    await expect(
      live.page.getByText('Beta credits are exhausted. AI-assisted actions are unavailable.', {
        exact: false
      })
    ).toBeVisible();
    await expect(
      live.page.getByRole('link', { name: 'contact@releasesignal.io' })
    ).toHaveAttribute('href', 'mailto:contact@releasesignal.io');
    await expect(
      live.page.getByText('You do not have enough Release Signal credits to complete this action.', {
        exact: false
      })
    ).toBeVisible();

    // Zero credits must not disable unrelated deterministic workspace controls.
    await expect(live.page.getByRole('button', { name: 'New workspace', exact: true })).toBeEnabled();
    await expect(live.page.getByRole('button', { name: 'Clear input', exact: true })).toBeEnabled();
  });

  test('zero-credit presentation remains readable at approximately 375px', async ({ browser }) => {
    const live = await newLivePage(browser, trialStateEnv);
    test.skip(!live.ok, live.ok ? '' : live.message);
    if (!live.ok) return;

    await live.page.setViewportSize({ width: 375, height: 812 });
    await openWorkspace(live.page);

    await live.page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('release-signal:credit-balance', {
          detail: { creditsRemaining: 0 }
        })
      );
    });

    await expectVisibleBalance(live.page, 0);
    await expect(
      live.page.getByText('AI-assisted actions are unavailable', { exact: false })
    ).toBeVisible();

    const viewport = await live.page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(viewport.scrollWidth, 'PR7 credit state should not introduce horizontal page overflow').toBeLessThanOrEqual(
      viewport.clientWidth
    );
  });
});
