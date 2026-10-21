import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTotals } from "../../src/checkout.ts";

const hoodie = { productId: "helm-hoodie", name: "Helm Hoodie", price: 45, quantity: 1 };
const stickers = { productId: "pod-stickers", name: "Pod Stickers", price: 6, quantity: 1 };
const mug = { productId: "kube-mug", name: "Kube Mug", price: 12, quantity: 1 };

test("orders of $50 or more ship free", () => {
  assert.deepEqual(calculateTotals([hoodie, stickers]), { subtotal: 51, shipping: 0, total: 51 });
});

test("orders under $50 pay a $5 shipping fee", () => {
  assert.deepEqual(calculateTotals([mug]), { subtotal: 12, shipping: 5, total: 17 });
});

test("an empty cart cannot be checked out", () => {
  assert.throws(() => calculateTotals([]), /cart is empty/);
});
