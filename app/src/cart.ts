import { randomUUID } from "node:crypto";
import { findProduct } from "./catalog.ts";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
}

const carts = new Map<string, Cart>();

export function createCart(): Cart {
  const cart: Cart = { id: randomUUID(), items: [] };
  carts.set(cart.id, cart);
  return cart;
}

export function getCart(id: string): Cart | undefined {
  return carts.get(id);
}

export function addItem(cartId: string, productId: string, quantity = 1): Cart {
  const cart = carts.get(cartId);
  if (!cart) throw new HttpError(404, `cart ${cartId} not found`);
  const product = findProduct(productId);
  if (!product) throw new HttpError(400, `unknown product ${productId}`);
  if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, "quantity must be a positive integer");

  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) existing.quantity += quantity;
  else cart.items.push({ productId, name: product.name, price: product.price, quantity });
  return cart;
}

export function subtotal(items: CartItem[]): number {
  return round(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
