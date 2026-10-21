import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the product catalog within 2 seconds", async ({ page }) => {
  await expect(page.getByTestId("product-list").locator(".card")).toHaveCount(5, { timeout: 2_000 });
  await expect(page.getByTestId("product-gopher")).toContainText("$12.00");
});

test("adding products updates the cart badge", async ({ page }) => {
  await page.getByTestId("add-gopher").click();
  await page.getByTestId("add-mini-penguin").click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$18.00");
});

test("checkout is disabled for an empty cart", async ({ page }) => {
  await expect(page.getByTestId("checkout-button")).toBeDisabled();
});
