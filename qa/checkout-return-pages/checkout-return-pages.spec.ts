import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";
import CheckoutCancelPage from "../../app/billing/checkout/cancel/page";
import CheckoutSuccessPage from "../../app/billing/checkout/success/page";

const SUCCESS_MESSAGE =
  "Your payment was submitted to the payment provider. Your Release Signal subscription will update after payment verification.";
const CANCEL_MESSAGE =
  "Your checkout was not completed through this flow. You can return to Release Signal and try again later.";

type TestElement = {
  type?: unknown;
  props?: Record<string, unknown>;
};

function expandElement(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expandElement);
  if (!value || typeof value !== "object") return value;

  const element = value as TestElement;
  if (typeof element.type === "function") {
    return expandElement(element.type(element.props ?? {}));
  }

  if (element.props) {
    return {
      type: element.type,
      props: Object.fromEntries(
        Object.entries(element.props).map(([key, child]) => [key, expandElement(child)])
      ),
    };
  }

  return value;
}

function render(component: () => unknown, searchParams?: Record<string, string>) {
  return JSON.stringify(expandElement(component(searchParams as never)));
}

test("success route renders neutral payment-submitted guidance", () => {
  const markup = render(CheckoutSuccessPage);

  expect(markup).toContain("Payment submitted");
  expect(markup).toContain(SUCCESS_MESSAGE);
});

test("cancel route renders neutral incomplete-checkout guidance", () => {
  const markup = render(CheckoutCancelPage);

  expect(markup).toContain("Checkout not completed");
  expect(markup).toContain(CANCEL_MESSAGE);
});

test("both routes provide safe navigation back to Release Signal", () => {
  for (const component of [CheckoutSuccessPage, CheckoutCancelPage]) {
    const markup = render(component);
    expect(markup).toContain('"href":"/chat"');
    expect(markup).toContain("Return to Release Signal");
  }
});

test("success copy makes no authoritative payment or entitlement claim", () => {
  const markup = render(CheckoutSuccessPage).toLowerCase();

  for (const prohibitedClaim of [
    "payment verified",
    "subscription activated",
    "standard activated",
    "credits added",
    "payment complete in release signal",
  ]) {
    expect(markup).not.toContain(prohibitedClaim);
  }
});

test("cancel copy makes no authoritative commercial claim", () => {
  const markup = render(CheckoutCancelPage).toLowerCase();

  for (const prohibitedClaim of [
    "subscription change has been made",
    "subscription unchanged",
    "subscription canceled",
    "subscription active",
    "payment failed",
    "payment verified",
    "credits",
    "entitlement",
  ]) {
    expect(markup).not.toContain(prohibitedClaim);
  }
});

test("arbitrary query parameters cannot change either page's claims", () => {
  const query = {
    paid: "true",
    subscriptionActive: "true",
    creditsGranted: "1000000",
    plan: "enterprise",
  };

  expect(render(CheckoutSuccessPage, query)).toBe(render(CheckoutSuccessPage));
  expect(render(CheckoutCancelPage, query)).toBe(render(CheckoutCancelPage));
});

test("return pages contain no provider, secret, or persistence boundary", () => {
  const featureRoot = path.join(__dirname, "..", "..", "app", "billing", "checkout");
  const source = [
    "CheckoutReturnPage.tsx",
    path.join("success", "page.tsx"),
    path.join("cancel", "page.tsx"),
  ]
    .map((file) => readFileSync(path.join(featureRoot, file), "utf8"))
    .join("\n");

  for (const forbiddenBoundary of [
    "fetch(",
    "prisma",
    "lemon_squeezy_api_key",
    ".create(",
    ".update(",
    ".upsert(",
    "searchparams",
  ]) {
    expect(source.toLowerCase()).not.toContain(forbiddenBoundary);
  }
});
