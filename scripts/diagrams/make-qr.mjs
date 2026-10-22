// usage: node make-qr.mjs <url> <out.svg>   (needs the qrcode npm package resolvable from ./qr/)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(new URL("./qr/package.json", import.meta.url));
const QRCode = require("qrcode");
const [url, out] = process.argv.slice(2);
const qr = QRCode.create(url, { errorCorrectionLevel: "Q" });
const n = qr.modules.size, data = qr.modules.data;
const M = 16, quiet = 4, size = (n + quiet * 2) * M;   // module size, quiet zone in modules
const label = url.replace(/^https?:\/\//, "");
const W = size, H = size + 70;
let rects = "";
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
  if (data[y * n + x]) rects += `<rect x="${(x + quiet) * M}" y="${(y + quiet) * M}" width="${M}" height="${M}"/>`;
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="QR code for ${url}" font-family="Nunito, 'Helvetica Neue', Arial, sans-serif">
  <rect width="${W}" height="${H}" rx="28" fill="#FFFFFF"/>
  <g fill="#160F31" shape-rendering="crispEdges">${rects}</g>
  <text x="${W / 2}" y="${size + 30}" text-anchor="middle" font-size="26" font-weight="700" fill="#160F31">${label}</text>
</svg>
`);
console.log(`QR version ${qr.version}, ${n}×${n} modules, EC level Q → ${out}`);
