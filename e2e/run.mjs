// Raahi end-to-end screenshot smoke run.
//
// Drives the mobile web build (Vite preview or `pnpm dev:mobile`) with Playwright
// and saves a screenshot of every public screen into ./shots. It needs a running
// mobile UI and API, so it is opt-in: set E2E_BASE_URL (mobile UI) and optionally
// E2E_API_URL (server, default http://localhost:3000). Without E2E_BASE_URL the
// run is skipped so `pnpm -r test` stays green in CI.
//
//   E2E_BASE_URL=http://localhost:4173 pnpm --filter @raahi/e2e test
//
// Browsers: `pnpm --filter @raahi/e2e exec playwright install chromium`.
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.E2E_BASE_URL;
if (!baseUrl) {
  console.log("e2e: E2E_BASE_URL not set — skipping browser run (set it to the mobile UI URL to capture screenshots).");
  process.exit(0);
}
const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3000";
const outDir = path.resolve(process.cwd(), "shots");

const screens = [
  ["01-welcome", "/welcome"],
  ["02-login", "/auth/login?role=customer"],
  ["03-signup-customer", "/auth/signup/customer"],
  ["04-signup-driver", "/auth/signup/driver"],
  ["09-server-settings", "/settings/server"],
];

const { chromium } = await import("playwright");
await mkdir(outDir, { recursive: true });

const health = await fetch(`${apiUrl}/api/health`).then((r) => r.json()).catch(() => null);
if (!health?.ok) {
  console.error(`e2e: API at ${apiUrl} is not healthy:`, health);
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
// Point the app at the API under test: @capacitor/preferences on the web stores
// keys in localStorage under the CapacitorStorage.* prefix (see apps/mobile/src/lib/config.ts).
await page.addInitScript((url) => {
  window.localStorage.setItem("CapacitorStorage.raahi.apiBaseUrl", url);
}, apiUrl);

let failures = 0;
for (const [name, route] of screens) {
  try {
    await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
    await page.waitForTimeout(600); // let entrance springs settle
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    console.log(`e2e: ${name} ok`);
  } catch (err) {
    failures++;
    console.error(`e2e: ${name} failed`, err);
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
