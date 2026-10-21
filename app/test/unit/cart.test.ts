import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, createCart, subtotal } from "../../src/cart.ts";

test("adding the same product twice increases its quantity", () => {
  const cart = createCart();
  addItem(cart.id, "gopher");
  addItem(cart.id, "gopher", 2);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
});

test("subtotal sums price × quantity", () => {
  const cart = createCart();
  addItem(cart.id, "gopher", 2);
  addItem(cart.id, "octopus");
  assert.equal(subtotal(cart.items), 42);
});

test("unknown products are rejected", () => {
  const cart = createCart();
  assert.throws(() => addItem(cart.id, "nope"), /unknown product/);
});
