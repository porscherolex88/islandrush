/**
 * Renders public/brand SVG sources into PNG brand kit assets via Playwright.
 * Run: node scripts/generate-brand-assets.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public/brand");
const appDir = path.join(root, "src/app");

const ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0B4F5C"/>
  <rect x="10" y="28" width="44" height="26" rx="4" fill="#1B8A99"/>
  <path d="M8 22c0-2.2 1.8-4 4-4h40c2.2 0 4 1.8 4 4v8H8v-8z" fill="#2FB3C1"/>
  <rect x="8" y="28" width="48" height="4" fill="#0E6B78"/>
  <rect x="28" y="14" width="8" height="40" rx="1" fill="#F5B942"/>
  <rect x="24" y="34" width="16" height="12" rx="2" fill="#FBBF24"/>
  <rect x="28" y="38" width="8" height="4" rx="1" fill="#0B4F5C"/>
</svg>`;

function wordmark(x, y, size) {
  const boxX = Math.round(x + size * 2.15);
  return `
  <g font-family="Outfit, Arial Black, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${size}" letter-spacing="-0.04em">
    <text x="${x}" y="${y}" fill="#0B4F5C">Loot</text>
    <text x="${boxX}" y="${y}" fill="#1B8A99">Box</text>
  </g>`;
}

const LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 64">
  <g transform="translate(0 0)">${ICON.replace(/<\/?svg[^>]*>/g, "")}</g>
  ${wordmark(80, 44, 36)}
</svg>`;

async function renderSvgPng(page, svg, width, height, outPath, { transparent = true, bg = null } = {}) {
  const html = `<!DOCTYPE html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@800&display=swap" rel="stylesheet"/>
<style>
  html,body{margin:0;width:${width}px;height:${height}px;${transparent ? "background:transparent;" : `background:${bg};`}}
  svg{display:block;width:100%;height:100%}
</style></head><body>${svg}</body></html>`;
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: outPath, omitBackground: transparent });
}

async function main() {
  await mkdir(brandDir, { recursive: true });
  await writeFile(path.join(brandDir, "icon.svg"), ICON.trim() + "\n");
  await writeFile(path.join(brandDir, "logo.svg"), LOGO.trim() + "\n");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Transparent icon + logo PNGs
  await renderSvgPng(page, ICON, 512, 512, path.join(brandDir, "icon.png"));
  await renderSvgPng(page, LOGO, 1120, 256, path.join(brandDir, "logo.png"));

  // Profile 1080x1080: mark inset so a circle crop keeps the crate readable
  const profileSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <rect width="1080" height="1080" fill="#0B4F5C"/>
  <g transform="translate(210 210) scale(10.3125)">
    <rect x="10" y="28" width="44" height="26" rx="4" fill="#1B8A99"/>
    <path d="M8 22c0-2.2 1.8-4 4-4h40c2.2 0 4 1.8 4 4v8H8v-8z" fill="#2FB3C1"/>
    <rect x="8" y="28" width="48" height="4" fill="#0E6B78"/>
    <rect x="28" y="14" width="8" height="40" rx="1" fill="#F5B942"/>
    <rect x="24" y="34" width="16" height="12" rx="2" fill="#FBBF24"/>
    <rect x="28" y="38" width="8" height="4" rx="1" fill="#0B4F5C"/>
  </g>
</svg>`;
  await renderSvgPng(page, profileSvg, 1080, 1080, path.join(brandDir, "profile-1080.png"), { transparent: false, bg: "#0B4F5C" });

  // Social banner 1500x500
  const bannerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500">
  <rect width="1500" height="500" fill="#0B4F5C"/>
  <circle cx="1280" cy="80" r="220" fill="#1B8A99" opacity="0.35"/>
  <circle cx="200" cy="460" r="180" fill="#2FB3C1" opacity="0.18"/>
  <g transform="translate(120 118) scale(4.1)">
    <rect width="64" height="64" rx="14" fill="#0E6B78"/>
    <rect x="10" y="28" width="44" height="26" rx="4" fill="#1B8A99"/>
    <path d="M8 22c0-2.2 1.8-4 4-4h40c2.2 0 4 1.8 4 4v8H8v-8z" fill="#2FB3C1"/>
    <rect x="8" y="28" width="48" height="4" fill="#0B4F5C"/>
    <rect x="28" y="14" width="8" height="40" rx="1" fill="#F5B942"/>
    <rect x="24" y="34" width="16" height="12" rx="2" fill="#FBBF24"/>
    <rect x="28" y="38" width="8" height="4" rx="1" fill="#0B4F5C"/>
  </g>
  <g font-family="Outfit, Arial Black, Helvetica Neue, Arial, sans-serif" font-weight="800" letter-spacing="-0.04em">
    <text x="430" y="250" font-size="120" fill="#FFFFFF">Loot</text>
    <text x="700" y="250" font-size="120" fill="#F5B942">Box</text>
    <text x="430" y="320" font-size="28" font-weight="600" letter-spacing="0.08em" fill="#9FD8DF">PLAY · DISCOVER · COLLECT</text>
  </g>
</svg>`;
  await renderSvgPng(page, bannerSvg, 1500, 500, path.join(brandDir, "banner-1500x500.png"), { transparent: false, bg: "#0B4F5C" });

  // Ad / share 1200x628
  const shareSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628" width="1200" height="628">
  <rect width="1200" height="628" fill="#FAF9F7"/>
  <rect x="0" y="0" width="1200" height="12" fill="#F5B942"/>
  <circle cx="980" cy="140" r="260" fill="#E6F4F6"/>
  <g transform="translate(120 170) scale(4.5)">
    <rect width="64" height="64" rx="14" fill="#0B4F5C"/>
    <rect x="10" y="28" width="44" height="26" rx="4" fill="#1B8A99"/>
    <path d="M8 22c0-2.2 1.8-4 4-4h40c2.2 0 4 1.8 4 4v8H8v-8z" fill="#2FB3C1"/>
    <rect x="8" y="28" width="48" height="4" fill="#0E6B78"/>
    <rect x="28" y="14" width="8" height="40" rx="1" fill="#F5B942"/>
    <rect x="24" y="34" width="16" height="12" rx="2" fill="#FBBF24"/>
    <rect x="28" y="38" width="8" height="4" rx="1" fill="#0B4F5C"/>
  </g>
  <g font-family="Outfit, Arial Black, Helvetica Neue, Arial, sans-serif" font-weight="800" letter-spacing="-0.04em">
    <text x="460" y="290" font-size="96" fill="#0B4F5C">Loot</text>
    <text x="680" y="290" font-size="96" fill="#1B8A99">Box</text>
  </g>
  <text x="460" y="360" font-family="Outfit, Arial, sans-serif" font-size="28" font-weight="600" fill="#4B6470">Open the box. Cross the islands. Claim the prize.</text>
</svg>`;
  await renderSvgPng(page, shareSvg, 1200, 628, path.join(brandDir, "share-1200x628.png"), { transparent: false, bg: "#FAF9F7" });

  await browser.close();

  // Apple touch icon + favicon.ico from the mark
  const iconPng = path.join(brandDir, "icon.png");
  await sharp(iconPng).resize(180, 180).png().toFile(path.join(appDir, "apple-icon.png"));
  const ico16 = await sharp(iconPng).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(iconPng).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(iconPng).resize(48, 48).png().toBuffer();
  // Minimal multi-size ICO (PNG-compressed entries)
  await writeFile(path.join(appDir, "favicon.ico"), encodeIco([
    { size: 16, png: ico16 },
    { size: 32, png: ico32 },
    { size: 48, png: ico48 },
  ]));

  // Copy share image as opengraph static file for metadata
  await sharp(path.join(brandDir, "share-1200x628.png")).toFile(path.join(brandDir, "og.png"));

  console.log("Brand assets written to public/brand and app icons updated.");
}

/** Build a simple ICO file containing PNG images. */
function encodeIco(images) {
  const count = images.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const img of images) {
    entries.push({ width: img.size >= 256 ? 0 : img.size, height: img.size >= 256 ? 0 : img.size, size: img.png.length, offset, png: img.png });
    offset += img.png.length;
  }
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let entryAt = 6;
  for (const e of entries) {
    buf.writeUInt8(e.width, entryAt);
    buf.writeUInt8(e.height, entryAt + 1);
    buf.writeUInt8(0, entryAt + 2);
    buf.writeUInt8(0, entryAt + 3);
    buf.writeUInt16LE(1, entryAt + 4);
    buf.writeUInt16LE(32, entryAt + 6);
    buf.writeUInt32LE(e.size, entryAt + 8);
    buf.writeUInt32LE(e.offset, entryAt + 12);
    e.png.copy(buf, e.offset);
    entryAt += 16;
  }
  return buf;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
