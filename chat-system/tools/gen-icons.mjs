// Renders the Pigeon icon (SVG) to every PNG size the desktop and Android builds need.
// Usage: node tools/gen-icons.mjs   (requires playwright-core + a Chromium; see README)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PW_REQUIRE_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GLYPH = `
  <g fill="#fff">
    <path d="M232 540 L790 300 L640 780 L560 620 Z"/>
    <path d="M560 620 L790 300 L470 560 Z" fill="#dbe7ff"/>
    <path d="M232 540 L470 560 L560 620 L520 690 Z" fill="#c3d5ff"/>
  </g>`;

function svg({ size, shape = 'rounded', glyphScale = 0.78, bg = true }) {
  const r = shape === 'circle' ? 512 : shape === 'rounded' ? 200 : 0;
  const bgEl = !bg ? '' : shape === 'circle'
    ? `<circle cx="512" cy="512" r="512" fill="url(#g)"/>`
    : `<rect width="1024" height="1024" rx="${r}" fill="url(#g)"/>`;
  const s = glyphScale;
  const t = (1 - s) * 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#8a5cff"/></linearGradient></defs>
    ${bgEl}<g transform="translate(${t} ${t}) scale(${s})">${GLYPH}</g></svg>`;
}

async function main() {
  const exe = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  async function render(opts, outFile) {
    const size = opts.size;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opts)}</body></html>`);
    const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, buf);
    console.log('wrote', path.relative(root, outFile));
  }
  // Shared + desktop
  await render({ size: 512 }, path.join(root, 'app/src/icon.png'));
  await render({ size: 1024 }, path.join(root, 'desktop/build/icon.png'));
  // Android launcher icons
  const res = path.join(root, 'mobile/android/app/src/main/res');
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    await render({ size: Math.round(48 * m), shape: 'rounded' }, path.join(res, `mipmap-${d}/ic_launcher.png`));
    await render({ size: Math.round(48 * m), shape: 'circle' }, path.join(res, `mipmap-${d}/ic_launcher_round.png`));
    await render({ size: Math.round(108 * m), bg: false, glyphScale: 0.5 }, path.join(res, `mipmap-${d}/ic_launcher_foreground.png`));
  }
  // Splash logo (centered on solid background via drawable/splash.xml)
  await render({ size: 512, shape: 'rounded' }, path.join(res, 'drawable/splash_logo.png'));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
