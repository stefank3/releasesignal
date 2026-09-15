import { expect, test, type Page } from "@playwright/test";
import { getApprovedPublicReviews } from "../../app/reviews/publicReviews";

const fixtureUrl = "http://127.0.0.1:3109";
const section = (page: Page) => page.getByRole("region", { name: "Customer reviews", exact: true });
const previous = (page: Page) => section(page).getByRole("button", { name: "Previous review" });
const next = (page: Page) => section(page).getByRole("button", { name: "Next review" });

async function openFixture(page: Page, scenario: string) {
  await page.goto(`${fixtureUrl}/?scenario=${scenario}`);
  await expect(page.getByTestId("after")).toBeVisible();
}

async function expectPosition(page: Page, position: number, count: number) {
  await expect(section(page).getByRole("status")).toHaveText(`Review ${position} of ${count}`);
  await expect(section(page).locator("blockquote")).toContainText(`Fixture quote ${position}.`);
  await expect(section(page).locator("figcaption strong")).toContainText(`Fixture author ${position}`);
  await expect(section(page).locator("figure")).toHaveCount(1);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

for (const width of [1440, 375]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("zero and entirely rejected input omit all section spacing", async ({ page }) => {
      for (const scenario of ["zero", "rejected"]) {
        await openFixture(page, scenario);
        await expect(section(page)).toHaveCount(0);
        await expect(page.locator("main > *")).toHaveCount(2);
        const before = await page.getByTestId("before").boundingBox();
        const after = await page.getByTestId("after").boundingBox();
        expect(after!.y).toBe(before!.y + before!.height);
        await expect(page.getByRole("main")).not.toContainText("Rejected fixture");
      }
    });

    test("one approved review is static with only supplied attribution", async ({ page }) => {
      await openFixture(page, "one");
      await expect(section(page).locator("blockquote")).toContainText("Fixture quote 1.");
      await expect(section(page).locator("figcaption")).toHaveText("Fixture author 1");
      await expect(section(page).getByRole("button")).toHaveCount(0);
      await expect(section(page).getByRole("status")).toHaveCount(0);
      await expectNoOverflow(page);
    });

    test("manual navigation respects boundaries and preserves focus", async ({ page }) => {
      await openFixture(page, "multiple");
      await expectPosition(page, 1, 3);
      await expect(previous(page)).toHaveAttribute("aria-disabled", "true");
      await page.keyboard.press("Tab");
      await expect(previous(page)).toBeFocused();
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowLeft");
      await expectPosition(page, 1, 3);
      await expect(previous(page)).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(next(page)).toBeFocused();
      await page.keyboard.press("Enter");
      await expectPosition(page, 2, 3);
      await page.keyboard.press("Space");
      await expectPosition(page, 3, 3);
      await expect(next(page)).toHaveAttribute("aria-disabled", "true");
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowRight");
      await expectPosition(page, 3, 3);
      await expect(next(page)).toBeFocused();
      const outline = await next(page).evaluate((button) => {
        const style = getComputedStyle(button);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(outline).toEqual({ style: "solid", width: "3px" });
      await page.keyboard.press("ArrowLeft");
      await expectPosition(page, 2, 3);
      await expect(next(page)).toBeFocused();
      await previous(page).click();
      // Playwright treats aria-disabled as disabled; deliberately send a pointer
      // click to establish that our handler also enforces the boundary.
      await previous(page).click({ force: true });
      await expectPosition(page, 1, 3);
      await expect(previous(page)).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("ArrowRight");
      await expectPosition(page, 1, 3);
    });

    test("mixed input uses real filtering and full long content wraps", async ({ page }, testInfo) => {
      await openFixture(page, "mixed");
      await expectPosition(page, 1, 2);
      await next(page).click();
      await expectPosition(page, 2, 2);
      await expect(page.getByRole("main")).not.toContainText("Rejected fixture");
      const figure = section(page).locator("figure");
      await expect(figure.locator("blockquote")).toHaveText("Fixture quote 2. " + "Full review content. ".repeat(25));
      await expect(figure.locator("figcaption")).toContainText("Role".repeat(30));
      await expect(figure.locator("figcaption")).toContainText("Company".repeat(30));
      expect(await figure.evaluate((element) => {
        const nodes = [element, ...element.querySelectorAll("blockquote, p, figcaption, figcaption div")];
        return nodes.every((node) => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight);
      })).toBe(true);
      for (const control of [previous(page), next(page)]) {
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
      await expectNoOverflow(page);
      await section(page).screenshot({ path: testInfo.outputPath(`reviews-${width}.png`) });
    });

    test("anonymous production-source homepage and entry destinations stay truthful", async ({ page, request }) => {
      expect(getApprovedPublicReviews()).toEqual([]);
      const response = await request.get("/", { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers().location).toBeUndefined();
      for (const pathname of ["/", "/reviews"]) {
        await page.goto(pathname);
        if (pathname === "/") {
          await expect(page.locator("#customer-reviews")).toHaveCount(0);
          await expect(section(page)).toHaveCount(0);
          await expect(page.getByRole("main")).not.toContainText(/Fixture quote|Rejected fixture/);
        } else {
          await expect(page.getByRole("heading", { name: "No published reviews yet" })).toBeVisible();
        }
        const header = page.getByRole("banner");
        for (const [name, href] of [["Sign in", "/auth/login?returnTo=%2Fchat"], ["Start Trial", "/auth/start-trial"]]) {
          const link = header.getByRole("link", { name, exact: true });
          await expect(link).toHaveAttribute("href", href);
          // Intercept before the request can execute auth or provisioning logic.
          const destination = new URL(href, page.url()).href;
          await page.route(destination, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "Destination intercepted" }));
          await link.click();
          await expect(page).toHaveURL(destination);
          await page.unroute(destination);
          await page.goto(pathname);
        }
        await expectNoOverflow(page);
      }
    });
  });
}
