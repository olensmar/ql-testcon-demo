// usage: node render.mjs <svgDir> [previewDir]
// Renders each SVG to a transparent 2x PNG next to it (Nunito from Google Fonts); with previewDir,
// also writes a copy on the deck background (#160F31) for review.
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const [dir, previewDir] = process.argv.slice(2);
const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=block">`;
const browser = await chromium.launch();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const svg = readFileSync(join(dir, f), "utf8");
  const [, , w, h] = svg.match(/viewBox="([\d.\s]+)"/)[1].split(/\s+/).map(Number);
  const sized = svg.replace("<svg ", `<svg width="${w}" height="${h}" `);
  for (const [bg, out] of [["transparent", join(dir, f.replace(".svg", ".png"))], ...(previewDir ? [["#160F31", join(previewDir, f.replace(".svg", ".png"))]] : [])]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await page.setContent(`<html><head>${FONTS}</head><body style="margin:0;background:${bg}">${sized}</body></html>`, { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.load("700 20px Nunito"); await document.fonts.ready; });
    const ok = await page.evaluate(() => document.fonts.check("700 20px Nunito"));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h }, omitBackground: bg === "transparent" });
    await page.close();
    if (!ok) console.log("WARNING: Nunito not loaded for", f);
  }
  console.log("rendered", f);
}
await browser.close();
