import { expect, test, type Page } from "@playwright/test";

async function addToCart(page: Page, ...productIds: string[]) {
  await page.goto("/");
  for (const id of productIds) await page.getByTestId(`add-${id}`).click();
  await expect(page.getByTestId("cart-count")).toHaveText(String(productIds.length));
}

test("orders under $50 pay $5 shipping", async ({ page }) => {
  await addToCart(page, "gopher", "octopus");
  await page.getByTestId("checkout-button").click();
  await expect(page.getByTestId("order-subtotal")).toHaveText("$30.00");
  await expect(page.getByTestId("order-shipping")).toHaveText("$5.00");
  await expect(page.getByTestId("order-total")).toHaveText("$35.00");
});

test("orders of $50 or more ship free", async ({ page }) => {
  await addToCart(page, "teddy-bear", "mini-penguin");
  await page.getByTestId("checkout-button").click();
  await expect(page.getByTestId("order-shipping")).toHaveText("$0.00");
  await expect(page.getByTestId("order-total")).toHaveText("$51.00");
});

test("the order summary lists the cart subtotal", async ({ page }) => {
  await addToCart(page, "gopher", "gopher", "mini-penguin");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$30.00");
  await page.getByTestId("checkout-button").click();
  await expect(page.getByTestId("order-subtotal")).toHaveText("$30.00");
});

test("SAVE10 takes 10% off the subtotal", async ({ page }) => {
  await addToCart(page, "gopher", "octopus");
  await page.getByTestId("discount-input").fill("SAVE10");
  await page.getByTestId("checkout-button").click();
  await expect(page.getByTestId("order-subtotal")).toHaveText("$30.00");
  await expect(page.getByTestId("order-discount")).toHaveText("−$3.00");
  await expect(page.getByTestId("order-shipping")).toHaveText("$5.00");
  await expect(page.getByTestId("order-total")).toHaveText("$32.00");
});

test("an invalid discount code shows an error", async ({ page }) => {
  await addToCart(page, "gopher");
  await page.getByTestId("discount-input").fill("FREESTUFF");
  await page.getByTestId("checkout-button").click();
  await expect(page.getByTestId("error")).toHaveText("invalid discount code FREESTUFF");
  await expect(page.getByTestId("order-summary")).toBeHidden();
});
