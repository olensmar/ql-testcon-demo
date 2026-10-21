import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, createCart, subtotal } from "../../src/cart.ts";

test("adding the same product twice increases its quantity", () => {
  const cart = createCart();
  addItem(cart.id, "kube-mug");
  addItem(cart.id, "kube-mug", 2);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
});

test("subtotal sums price × quantity", () => {
  const cart = createCart();
  addItem(cart.id, "kube-mug", 2);
  addItem(cart.id, "cluster-cap");
  assert.equal(subtotal(cart.items), 42);
});

test("unknown products are rejected", () => {
  const cart = createCart();
  assert.throws(() => addItem(cart.id, "nope"), /unknown product/);
});
