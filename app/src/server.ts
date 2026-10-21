import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { products } from "./catalog.ts";
import { addItem, createCart, getCart, HttpError } from "./cart.ts";
import { calculateTotals } from "./checkout.ts";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = join(import.meta.dirname, "..", "public");
// Simulated response time of the upstream catalog service, in ms (fault injection for demos).
const CATALOG_LATENCY_MS = Number(process.env.CATALOG_LATENCY_MS ?? 0);

type Handler = (req: IncomingMessage, body: any, params: string[]) => unknown;

const STATIC_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const routes: Array<[method: string, pattern: RegExp, handler: Handler]> = [
  ["GET", /^\/healthz$/, () => ({ status: "ok" })],
  ["GET", /^\/api\/products$/, async () => {
    if (CATALOG_LATENCY_MS > 0) await new Promise((r) => setTimeout(r, CATALOG_LATENCY_MS));
    return products;
  }],
  ["POST", /^\/api\/cart$/, () => createCart()],
  [
    "GET",
    /^\/api\/cart\/([\w-]+)$/,
    (_req, _body, [id]) => getCart(id) ?? notFound(`cart ${id} not found`),
  ],
  [
    "POST",
    /^\/api\/cart\/([\w-]+)\/items$/,
    (_req, body, [id]) => addItem(id, body.productId, body.quantity ?? 1),
  ],
  [
    "POST",
    /^\/api\/checkout$/,
    (_req, body) => {
      const cart = getCart(body.cartId) ?? notFound(`cart ${body.cartId} not found`);
      return { cartId: cart.id, items: cart.items, ...calculateTotals(cart.items) };
    },
  ],
];

function notFound(message: string): never {
  throw new HttpError(404, message);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    for (const [method, pattern, handler] of routes) {
      const match = url.pathname.match(pattern);
      if (match && req.method === method) {
        const body = method === "POST" ? await readJson(req) : {};
        return send(res, 200, await handler(req, body, match.slice(1)));
      }
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(await readFile(join(PUBLIC_DIR, "index.html")));
    }
    const type = STATIC_TYPES[extname(url.pathname)];
    if (req.method === "GET" && type) {
      const file = await readFile(join(PUBLIC_DIR, basename(url.pathname))).catch(() => undefined);
      if (file) {
        res.writeHead(200, { "content-type": type });
        return res.end(file);
      }
    }
    send(res, 404, { error: "not found" });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    send(res, status, { error: (err as Error).message });
  }
});

server.listen(PORT, () => {
  const latency = CATALOG_LATENCY_MS > 0 ? ` (catalog latency ${CATALOG_LATENCY_MS}ms)` : "";
  console.log(`plushie-shop listening on :${PORT}${latency}`);
});
