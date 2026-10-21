import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the product catalog", async ({ page }) => {
  await expect(page.getByTestId("product-list").locator(".card")).toHaveCount(4);
  await expect(page.getByTestId("product-kube-mug")).toContainText("$12.00");
});

test("adding products updates the cart badge", async ({ page }) => {
  await page.getByTestId("add-kube-mug").click();
  await page.getByTestId("add-pod-stickers").click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$18.00");
});

test("checkout is disabled for an empty cart", async ({ page }) => {
  await expect(page.getByTestId("checkout-button")).toBeDisabled();
});
