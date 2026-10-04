#!/usr/bin/env node
/**
 * Raahi asset pipeline.
 *
 * Renders public/icon.svg (the single source of truth for the logo) into every
 * raster asset the Android project, the mobile PWA manifest and the server's
 * public folder need:
 *
 *   - Android launcher icons (legacy, round and adaptive foreground) per density
 *   - Android splash screens (portrait, landscape and default) per density
 *   - Android notification small icon (white, alpha-only silhouette)
 *   - PWA icons for the mobile app and the server
 *   - apple-touch-icon and an Open Graph image for the server
 *
 * Run from apps/mobile:  node scripts/generate-assets.mjs
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, "..");
const serverRoot = resolve(mobileRoot, "../server");
const androidRes = resolve(mobileRoot, "android/app/src/main/res");

const BRAND_BG = "#0B0F1A";
const BRAND_BG_RGB = { r: 0x0b, g: 0x0f, b: 0x1a, alpha: 1 };

const logoSvg = await readFile(resolve(mobileRoot, "public/icon.svg"));

/** Densities and their scale factor relative to mdpi (1x). */
const densities = [
  { name: "mdpi", scale: 1 },
  { name: "hdpi", scale: 1.5 },
  { name: "xhdpi", scale: 2 },
  { name: "xxhdpi", scale: 3 },
  { name: "xxxhdpi", scale: 4 },
];

/** Splash canvas sizes per density (portrait w x h). Landscape swaps them. */
const splashPortrait = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920],
};

/**
 * Logo variants composed from the source SVG. The road + pin shapes are the
 * same paths as public/icon.svg so every variant stays visually identical.
 */
const ROAD_PATH = "M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38";

/** Logo artwork without the rounded background tile (for adaptive foreground / splash). */
const markOnlySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="road" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#6ee7b7"/>
      <stop offset="0.6" stop-color="#10b981"/>
      <stop offset="1" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <path d="${ROAD_PATH}" fill="none" stroke="url(#road)" stroke-width="14" stroke-linecap="round"/>
  <path d="${ROAD_PATH}" fill="none" stroke="#0b0f1a" stroke-width="2.5" stroke-dasharray="6 9" stroke-linecap="round" opacity="0.9"/>
  <circle cx="90" cy="30" r="15" fill="#34d399"/>
  <circle cx="90" cy="30" r="6.5" fill="#0b0f1a"/>
  <circle cx="30" cy="104" r="7" fill="#6ee7b7"/>
</svg>`;

/** Pure white silhouette of the road + pin for the status bar notification icon. */
const monochromeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <path d="${ROAD_PATH}" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  <circle cx="90" cy="30" r="15" fill="#ffffff"/>
  <circle cx="90" cy="30" r="6.5" fill="#000000"/>
  <circle cx="30" cy="104" r="7" fill="#ffffff"/>
</svg>`;

/** Open Graph artwork: dark gradient, soft brand glow, the logo tile and the tagline. */
function ogSvg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f2a24"/>
      <stop offset="0.55" stop-color="#0B0F1A"/>
      <stop offset="1" stop-color="#0B0F1A"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.2" r="0.6">
      <stop offset="0" stop-color="#10b981" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="amber" cx="0.15" cy="0.95" r="0.45">
      <stop offset="0" stop-color="#f59e0b" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect width="${width}" height="${height}" fill="url(#amber)"/>
  <text x="400" y="296" font-family="Sora, Manrope, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="112" font-weight="700" letter-spacing="-4" fill="#f8fafc">Raahi</text>
  <text x="404" y="372" font-family="Manrope, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="46" font-weight="500" letter-spacing="-0.5" fill="#a7f3d0">Your ride. Your price.</text>
  <text x="404" y="432" font-family="Manrope, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="26" font-weight="500" fill="#94a3b8">Fair-price ride hailing for Pakistan. Name your fare, pick your driver.</text>
</svg>`;
}

/** Ensure a directory exists, then write a buffer to `path`. */
async function write(path, buffer) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return path;
}

/** Render an SVG buffer/string to a square PNG of `size` px. */
function renderSvg(svg, size, { density = 384 } = {}) {
  const input = typeof svg === "string" ? Buffer.from(svg) : svg;
  return sharp(input, { density }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
}

/** Full-bleed launcher icon: the SVG already contains its rounded tile, so just rasterise. */
async function launcherIcon(size) {
  return renderSvg(logoSvg, size).toBuffer();
}

/** Circular launcher icon: tile rasterised and masked by a circle. */
async function roundIcon(size) {
  const square = await renderSvg(logoSvg, size).toBuffer();
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  return sharp(square)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Adaptive icon foreground: 108dp canvas with the mark inside the 66dp safe zone.
 * The background layer is the solid brand colour from values/ic_launcher_background.xml.
 */
async function adaptiveForeground(size) {
  const markSize = Math.round(size * 0.62);
  const mark = await renderSvg(markOnlySvg, markSize).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** Splash: solid brand background with the logo tile centred at ~28% of the short side. */
async function splash(width, height) {
  const short = Math.min(width, height);
  const logoSize = Math.round(short * 0.28);
  const logo = await renderSvg(logoSvg, logoSize).toBuffer();
  return sharp({ create: { width, height, channels: 4, background: BRAND_BG_RGB } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

/**
 * Notification small icon: Android renders only the alpha channel and tints it,
 * so we output white artwork on a fully transparent canvas with the inner pin
 * hole punched out.
 */
async function notificationIcon(size) {
  const inset = Math.round(size * 0.08);
  const inner = size - inset * 2;
  const rendered = await renderSvg(monochromeSvg, inner).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = rendered;
  // Convert the black "hole" pixels to transparent so the icon is a true silhouette.
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const luminance = (r + g + b) / 3;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = Math.round((a * luminance) / 255);
  }
  const silhouette = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: silhouette, gravity: "centre" }])
    .png()
    .toBuffer();
}

/**
 * Android 12+ system splash icon (windowSplashScreenAnimatedIcon): a 240dp canvas
 * whose centre 160dp circle is what the OS reveals. The 128dp logo tile fits that
 * circle with its rounded corners intact.
 */
async function splashIcon(scale) {
  const canvas = Math.round(240 * scale);
  const tile = Math.round(128 * scale);
  const logo = await renderSvg(logoSvg, tile).toBuffer();
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** Open Graph image: 1200x630 composed SVG + the logo tile on the left. */
async function ogImage() {
  const width = 1200;
  const height = 630;
  const base = await sharp(Buffer.from(ogSvg(width, height)), { density: 144 }).resize(width, height).png().toBuffer();
  const logo = await renderSvg(logoSvg, 240).toBuffer();
  return sharp(base)
    .composite([{ input: logo, left: 120, top: 195 }])
    .png()
    .toBuffer();
}

/** apple-touch-icon: 180px, opaque brand background (iOS does not support transparency here). */
async function appleTouchIcon() {
  const size = 180;
  const logo = await renderSvg(logoSvg, size).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BG_RGB } })
    .composite([{ input: logo }])
    .flatten({ background: BRAND_BG })
    .png()
    .toBuffer();
}

const written = [];

// --- Android launcher icons -------------------------------------------------
for (const { name, scale } of densities) {
  const legacy = Math.round(48 * scale);
  const adaptive = Math.round(108 * scale);
  const dir = resolve(androidRes, `mipmap-${name}`);
  written.push(await write(resolve(dir, "ic_launcher.png"), await launcherIcon(legacy)));
  written.push(await write(resolve(dir, "ic_launcher_round.png"), await roundIcon(legacy)));
  written.push(await write(resolve(dir, "ic_launcher_foreground.png"), await adaptiveForeground(adaptive)));
}

written.push(
  await write(
    resolve(androidRes, "values/ic_launcher_background.xml"),
    Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND_BG}</color>
</resources>
`),
  ),
);

for (const file of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  written.push(
    await write(
      resolve(androidRes, "mipmap-anydpi-v26", file),
      Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_stat_raahi"/>
</adaptive-icon>
`),
    ),
  );
}

// --- Android splash screens -------------------------------------------------
for (const { name } of densities) {
  const [w, h] = splashPortrait[name];
  written.push(await write(resolve(androidRes, `drawable-port-${name}`, "splash.png"), await splash(w, h)));
  written.push(await write(resolve(androidRes, `drawable-land-${name}`, "splash.png"), await splash(h, w)));
}
written.push(await write(resolve(androidRes, "drawable", "splash.png"), await splash(...splashPortrait.xhdpi)));

// --- Android 12+ system splash icon -------------------------------------------
for (const { name, scale } of densities) {
  written.push(await write(resolve(androidRes, `drawable-${name}`, "ic_splash_logo.png"), await splashIcon(scale)));
}

// --- Android notification icon ---------------------------------------------
for (const { name, scale } of densities) {
  const size = Math.round(24 * scale);
  written.push(await write(resolve(androidRes, `drawable-${name}`, "ic_stat_raahi.png"), await notificationIcon(size)));
}

// --- PWA / web icons ----------------------------------------------------------
for (const root of [resolve(mobileRoot, "public"), resolve(serverRoot, "public")]) {
  written.push(await write(resolve(root, "icon-192.png"), await launcherIcon(192)));
  written.push(await write(resolve(root, "icon-512.png"), await launcherIcon(512)));
}
written.push(await write(resolve(serverRoot, "public", "apple-touch-icon.png"), await appleTouchIcon()));
written.push(await write(resolve(serverRoot, "public", "og-image.png"), await ogImage()));

// --- Verify ---------------------------------------------------------------------
let failures = 0;
for (const path of written) {
  try {
    await access(path);
  } catch {
    failures += 1;
    console.error(`missing: ${path}`);
  }
}
if (failures > 0) {
  console.error(`${failures} asset(s) were not written.`);
  process.exit(1);
}
console.log(`Generated ${written.length} assets.`);
