import { type CartItem, HttpError, round, subtotal } from "./cart.ts";

export const FREE_SHIPPING_THRESHOLD = 50;
export const SHIPPING_FEE = 5;

/** Percentage discount codes, as a fraction of the order subtotal. */
export const DISCOUNT_CODES: Record<string, number> = {
  SAVE10: 0.1,
  WELCOME20: 0.2,
};

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

export function calculateTotals(items: CartItem[], discountCode?: string): OrderTotals {
  if (items.length === 0) throw new HttpError(400, "cart is empty");

  const sub = subtotal(items);
  const shipping = sub >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const discount = discountFor(sub, discountCode);
  return { subtotal: sub, shipping, discount, total: round(sub + shipping - discount) };
}

function discountFor(amount: number, code?: string): number {
  if (!code) return 0;
  const rate = DISCOUNT_CODES[code.trim().toUpperCase()];
  if (rate === undefined) throw new HttpError(400, `invalid discount code ${code}`);
  return round(amount * rate);
}
