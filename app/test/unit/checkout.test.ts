import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTotals } from "../../src/checkout.ts";

const bear = { productId: "teddy-bear", name: "Giant Teddy Bear", price: 45, quantity: 1 };
const penguin = { productId: "mini-penguin", name: "Mini Penguin", price: 6, quantity: 1 };
const gopher = { productId: "gopher", name: "Gopher Plushie", price: 12, quantity: 1 };
const octopus = { productId: "octopus", name: "Octopus Plushie", price: 18, quantity: 1 };

test("orders of $50 or more ship free", () => {
  assert.deepEqual(calculateTotals([bear, penguin]), { subtotal: 51, shipping: 0, discount: 0, total: 51 });
});

test("orders under $50 pay a $5 shipping fee", () => {
  assert.deepEqual(calculateTotals([gopher]), { subtotal: 12, shipping: 5, discount: 0, total: 17 });
});

test("an empty cart cannot be checked out", () => {
  assert.throws(() => calculateTotals([]), /cart is empty/);
});

test("SAVE10 takes 10% off the order", () => {
  assert.deepEqual(calculateTotals([bear, penguin], "SAVE10"), {
    subtotal: 51,
    shipping: 0,
    discount: 5.1,
    total: 45.9,
  });
});

test("discounts apply to the subtotal only, not shipping", () => {
  assert.deepEqual(calculateTotals([gopher, octopus], "SAVE10"), {
    subtotal: 30,
    shipping: 5,
    discount: 3,
    total: 32,
  });
});

test("discount codes are case-insensitive", () => {
  assert.equal(calculateTotals([bear, penguin], "save10").discount, 5.1);
});

test("unknown discount codes are rejected", () => {
  assert.throws(() => calculateTotals([bear], "FREESTUFF"), /invalid discount code/);
});
