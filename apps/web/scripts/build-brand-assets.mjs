// Standalone brand-asset generator.
// Generates icon.svg, favicon.png, apple-touch-icon.png, manifest icons, and og preview.
//
// Usage: node apps/web/scripts/build-brand-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public');

const MARK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B7285"/>
      <stop offset="1" stop-color="#1C5D99"/>
    </linearGradient>
    <radialGradient id="r" cx="0.35" cy="0.35" r="0.6">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)" rx="96"/>
  <circle cx="256" cy="256" r="170" fill="#FFFFFF" opacity="0.18"/>
  <circle cx="256" cy="256" r="118" fill="url(#r)"/>
  <path d="M60 360 Q256 460 452 360" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.9"/>
  <path d="M60 392 Q256 472 452 392" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.7"/>
  <text x="256" y="290" font-family="Ubuntu, sans-serif" font-size="72" font-weight="700" fill="#FFFFFF" text-anchor="middle">ReduCera</text>
</svg>
`.trim();

function makeBrandPng(size) {
  const png = new PNG({ width: size, height: size });
  const [r, g, b] = [0x0b, 0x72, 0x85];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const dx = (x - size / 2) / size;
      const dy = (y - size / 2) / size;
      const ring = Math.sqrt(dx * dx + dy * dy);
      const inRing = ring > 0.32 && ring < 0.42;
      png.data[i] = inRing ? 255 : r;
      png.data[i + 1] = inRing ? 255 : g;
      png.data[i + 2] = inRing ? 255 : b;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

function makeOgPng() {
  const w = 1200;
  const h = 630;
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const t = y / h;
      png.data[i] = Math.round(0x0b * (1 - t) + 0x1c * t);
      png.data[i + 1] = Math.round(0x72 * (1 - t) + 0x5d * t);
      png.data[i + 2] = Math.round(0x85 * (1 - t) + 0x99 * t);
      png.data[i + 3] = 255;
    }
  }
  return png;
}

function pngBuffer(png) {
  const chunks = [];
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return Buffer.concat([...chunks, PNG.sync.write(png)]);
}

async function main() {
  mkdirSync(resolve(OUT_DIR, 'images', 'seo'), { recursive: true });
  mkdirSync(resolve(OUT_DIR, 'icons'), { recursive: true });

  writeFileSync(resolve(OUT_DIR, 'icon.svg'), MARK_SVG);

  for (const size of [32, 96]) {
    writeFileSync(resolve(OUT_DIR, `favicon-${size}x${size}.png`), pngBuffer(makeBrandPng(size)));
  }
  writeFileSync(resolve(OUT_DIR, 'apple-touch-icon.png'), pngBuffer(makeBrandPng(180)));
  writeFileSync(resolve(OUT_DIR, 'icons/icon-192.png'), pngBuffer(makeBrandPng(192)));
  writeFileSync(resolve(OUT_DIR, 'icons/icon-512.png'), pngBuffer(makeBrandPng(512)));
  writeFileSync(resolve(OUT_DIR, 'images/seo/reducera-preview.png'), pngBuffer(makeOgPng()));

  console.log('Brand assets written to', OUT_DIR);
}

main().catch((err) => {
  console.error('build-brand-assets failed:', err);
  process.exit(1);
});
