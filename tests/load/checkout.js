import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const json = { headers: { "Content-Type": "application/json" } };

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const cart = http.post(`${BASE_URL}/api/cart`, null, json).json();
  http.post(`${BASE_URL}/api/cart/${cart.id}/items`, JSON.stringify({ productId: "gopher" }), json);
  http.post(`${BASE_URL}/api/cart/${cart.id}/items`, JSON.stringify({ productId: "octopus" }), json);
  const res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify({ cartId: cart.id }), json);
  check(res, {
    "checkout returns 200": (r) => r.status === 200,
    "checkout total is 35": (r) => r.json("total") === 35,
  });
  sleep(0.5);
}
