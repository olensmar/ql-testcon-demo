import { type CartItem, HttpError, round, subtotal } from "./cart.ts";

export const FREE_SHIPPING_THRESHOLD = 50;
export const SHIPPING_FEE = 5;

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  total: number;
}

export function calculateTotals(items: CartItem[]): OrderTotals {
  if (items.length === 0) throw new HttpError(400, "cart is empty");

  const sub = subtotal(items);
  const shipping = sub >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return { subtotal: sub, shipping, total: round(sub + shipping) };
}
