import { expect, test } from '@playwright/test';
import {
  getApprovedPublicReviews,
  publicReviewCandidates,
  type PublicReviewCandidate,
} from '../../app/reviews/publicReviews';

test('only explicit publication approval passes the filter', () => {
  // Synthetic fixtures belong only to tests, never public review content.
  const approved: PublicReviewCandidate = {
    id: 'test-approved', quote: 'Synthetic test-only quote',
    authorName: 'Test fixture', approvedForPublication: true,
  };
  const unapproved = { ...approved, id: 'test-unapproved', approvedForPublication: false };
  const malformed = { ...approved, approvedForPublication: 'true' };
  expect(getApprovedPublicReviews([
    unapproved, approved, malformed as unknown as PublicReviewCandidate,
  ])).toEqual([approved]);
  expect(publicReviewCandidates).toEqual([]);
  expect(getApprovedPublicReviews()).toEqual([]);
});

test('anonymous GET returns 200 without a redirect', async ({ request }) => {
  const response = await request.get('/reviews', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers().location).toBeUndefined();
});

test('anonymous nested reviews path redirects to application login', async ({ request, baseURL }) => {
  const response = await request.get('/reviews/nested', { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const expectedLogin = new URL('/auth/login', baseURL);
  expectedLogin.searchParams.set('returnTo', '/reviews/nested');
  const location = response.headers().location;
  expect(location).toBeDefined();
  // Next.js may serialize a same-origin Location as a relative URL.
  expect(new URL(location!, response.url()).toString()).toBe(expectedLogin.toString());
});

test('homepage Features link changes the fragment without reloading the document', async ({ page }) => {
  await page.goto('/');
  const marker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    Object.defineProperty(window, '__pr8DocumentMarker', { value, configurable: true });
    return value;
  });
  await page.getByRole('banner').getByRole('link', { name: 'Features', exact: true }).click();
  await expect(page).toHaveURL(/\/#features$/);
  await expect(page.locator('#features')).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, '__pr8DocumentMarker'))).toBe(marker);
  await page.evaluate(() => Reflect.deleteProperty(window, '__pr8DocumentMarker'));
});

for (const width of [1440, 375]) {
  test(`truthful public reviews and usable navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/reviews');
    await expect(page).toHaveURL(/\/reviews$/);
    await expect(page).toHaveTitle('Reviews | Release Signal');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Reviews', exact: true })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'No published reviews yet' })).toBeVisible();
    await expect(main).toContainText(
      'Reviews will appear here as feedback is collected and explicitly approved for publication during the Release Signal beta.',
    );
    await expect(main.locator('blockquote, figure, img, svg')).toHaveCount(0);
    await expect(main).not.toContainText(/★|☆|⭐|\b\d[\d,.]*\s*(customers|users|stars)|\brated\b|out of 5|Synthetic test-only/);
    await expect(page.locator('[itemtype*="Review"], [itemtype*="AggregateRating"]')).toHaveCount(0);
    expect(await page.locator('script[type="application/ld+json"]').allTextContents())
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/Review|AggregateRating/)]));
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true);

    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Start Trial', exact: true })).toHaveAttribute('href', '/auth/start-trial');
    const footer = page.getByRole('contentinfo');
    const reviewsLink = footer.getByRole('link', { name: 'Reviews', exact: true });
    await reviewsLink.click();
    await expect(page).toHaveURL(/\/reviews$/);
    await expect(footer.getByRole('link', { name: 'Contact', exact: true })).toHaveAttribute('href', '/contact');

    const features = header.getByRole('link', { name: 'Features', exact: true });
    await features.focus();
    await expect(features).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/#features$/);
    await expect(page.locator('#features')).toBeVisible();
    await page.getByRole('contentinfo').getByRole('link', { name: 'Reviews', exact: true }).click();
    await expect(page).toHaveURL(/\/reviews$/);
  });
}
