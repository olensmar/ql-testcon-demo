import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTotals } from "../../src/checkout.ts";

const bear = { productId: "teddy-bear", name: "Giant Teddy Bear", price: 45, quantity: 1 };
const penguin = { productId: "mini-penguin", name: "Mini Penguin", price: 6, quantity: 1 };
const gopher = { productId: "gopher", name: "Gopher Plushie", price: 12, quantity: 1 };

test("orders of $50 or more ship free", () => {
  assert.deepEqual(calculateTotals([bear, penguin]), { subtotal: 51, shipping: 0, total: 51 });
});

test("orders under $50 pay a $5 shipping fee", () => {
  assert.deepEqual(calculateTotals([gopher]), { subtotal: 12, shipping: 5, total: 17 });
});

test("an empty cart cannot be checked out", () => {
  assert.throws(() => calculateTotals([]), /cart is empty/);
});
