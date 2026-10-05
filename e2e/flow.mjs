// Raahi — complete marketplace flow, driven through the real UI.
//
//   node /home/user/TASKS/e2e/flow.mjs
//
// Three browser contexts: a customer phone, a driver phone and an admin desktop.
// Screenshots land in ./shots/flow/NN-name.png (admin-*.png for the panel).
// State is asserted through the API with the tokens the app stored itself.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "/home/user/TASKS/e2e/node_modules/playwright/index.mjs";
import { renderFixtures } from "./fixtures.mjs";

const ROOT = "/home/user/TASKS/e2e";
const OUT = path.join(ROOT, "shots", "flow");
const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const APP = process.env.E2E_BASE_URL ?? "http://localhost:4173";
const EXECUTABLE = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const PASSWORD = "Passw0rd!";
const ADMIN = { email: "admin@raahi.pk", password: "Admin12345!" };

/* ----------------------------- run identity ----------------------------- */
const stamp = String(Date.now()).slice(-9); // unique per run
const customer = { fullName: "Ayesha Siddiqui", phone: `03${stamp}`, email: `ayesha.${stamp}@example.com` };
const driver = {
  fullName: "Bilal Ahmed Khan",
  phone: `03${String(Number(stamp) + 1).padStart(9, "0")}`,
  cnic: `35202${stamp.slice(0, 7)}1`,
  licenseNumber: `LHR-${stamp.slice(0, 7)}`,
  plate: `LEB ${stamp.slice(-4)}`,
  year: "2019",
  color: "Silver",
  txRef: `TX${stamp}`,
};
driver.cnicFormatted = `${driver.cnic.slice(0, 5)}-${driver.cnic.slice(5, 12)}-${driver.cnic.slice(12)}`;

/* -------------------------------- helpers ------------------------------- */
let shotIndex = 0;
const pad = (n) => String(n).padStart(2, "0");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function shot(page, name, { settle = 1200, admin = false, fullPage = false } = {}) {
  await page.waitForTimeout(settle);
  const file = admin ? `admin-${name}.png` : `${pad(++shotIndex)}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage });
  log("shot", file);
}

function expect(cond, message, extra) {
  if (!cond) {
    const err = new Error(`ASSERTION FAILED: ${message}`);
    if (extra !== undefined) err.extra = extra;
    throw err;
  }
  log("ok  ", message);
}

async function apiFetch(pathname, { token, method, body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${API}${pathname}`, { method: method ?? (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new Error(`${method ?? "GET"} ${pathname} → ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

/** Access token the app stored for this page (Capacitor Preferences → localStorage). */
async function tokenOf(page) {
  const raw = await page.evaluate(() => localStorage.getItem("CapacitorStorage.raahi.tokens"));
  expect(raw, "app stored a session token");
  return JSON.parse(raw).accessToken;
}

async function pollUntil(fn, { timeout = 20_000, interval = 1000, label = "condition" } = {}) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Timed out after ${timeout} ms waiting for ${label}`);
}

/** Click a control that opens the web file picker and feed it an image. */
async function uploadVia(page, locator, file) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 15_000 }), locator.click()]);
  await chooser.setFiles(file);
}

const phoneContext = (browser) =>
  browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    geolocation: { latitude: 31.515, longitude: 74.35 },
    permissions: ["geolocation"],
    locale: "en-PK",
    timezoneId: "Asia/Karachi",
  });

const wire = (page, tag) => {
  page.on("pageerror", (e) => log(`[${tag}] PAGEERROR`, e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("/api/")) log(`[${tag}] HTTP ${r.status()} ${r.request().method()} ${r.url().replace(API, "")}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|ERR_BLOCKED|net::ERR|404/.test(m.text())) log(`[${tag}] console.error`, m.text().slice(0, 200));
  });
  page.setDefaultTimeout(20_000);
  return page;
};

/* --------------------------------- main --------------------------------- */
await mkdir(OUT, { recursive: true });
const health = await apiFetch("/api/health");
expect(health?.ok && health?.db, "API healthy with database");

const fixtures = await renderFixtures(path.join(ROOT, "fixtures"), {
  fullName: driver.fullName,
  cnicFormatted: driver.cnicFormatted,
  licenseNumber: driver.licenseNumber,
  plate: driver.plate,
  year: driver.year,
  color: driver.color,
  stamp: stamp.slice(-6),
  phonePretty: `+92 ${driver.phone.slice(1, 4)} ${driver.phone.slice(4)}`,
  txRef: driver.txRef,
  date: new Date().toISOString().slice(0, 10),
});

const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox", "--ignore-certificate-errors"] });
const cCtx = await phoneContext(browser);
const dCtx = await phoneContext(browser);
const aCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-PK", timezoneId: "Asia/Karachi" });
const c = wire(await cCtx.newPage(), "customer");
const d = wire(await dCtx.newPage(), "driver");
const a = wire(await aCtx.newPage(), "admin");

const report = { run: stamp, customer: customer.phone, driver: driver.phone, steps: [] };
const mark = (s) => {
  report.steps.push(s);
  log("====", s);
};

try {
  /* ------------------------------------------------------------------ */
  /* 1. Customer signs up                                                */
  /* ------------------------------------------------------------------ */
  mark("1 customer signup");
  await c.goto(`${APP}/#/welcome`);
  await c.getByRole("button", { name: "I need a ride" }).waitFor();
  await shot(c, "welcome", { settle: 2500 });
  await c.getByRole("button", { name: "I need a ride" }).click();
  await c.waitForURL(/#\/auth\/login\?role=customer/);
  await shot(c, "login-customer");
  await c.getByRole("link", { name: "Create an account" }).first().click();
  await c.waitForURL(/#\/auth\/signup\/customer/);
  await c.getByLabel("Full name").fill(customer.fullName);
  await c.getByLabel("Mobile number").fill(customer.phone);
  await c.getByLabel("Email (optional)").fill(customer.email);
  await c.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await c.getByLabel("Confirm password").fill(PASSWORD);
  await shot(c, "signup-customer-filled");
  await c.getByRole("button", { name: "Create account" }).click();
  await c.waitForURL(/#\/c\/home/, { timeout: 30_000 });
  await c.getByRole("button", { name: /Where to\?/ }).waitFor();
  await shot(c, "customer-home", { settle: 4000 });
  const cToken = await tokenOf(c);
  const cMe = await apiFetch("/api/me", { token: cToken });
  expect(cMe.user.role === "customer" && cMe.user.fullName === customer.fullName, "customer account created via UI");

  /* ------------------------------------------------------------------ */
  /* 2. Driver signs up and completes onboarding                        */
  /* ------------------------------------------------------------------ */
  mark("2 driver signup + onboarding");
  await d.goto(`${APP}/#/welcome`);
  await d.getByRole("button", { name: "I want to drive" }).click();
  await d.waitForURL(/#\/auth\/login\?role=driver/);
  await d.getByRole("link", { name: "Create a driver account" }).first().click();
  await d.waitForURL(/#\/auth\/signup\/driver/);
  await d.getByLabel("Full name").fill(driver.fullName);
  await d.getByLabel("Mobile number").fill(driver.phone);
  await d.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await d.getByLabel("Confirm password").fill(PASSWORD);
  await shot(d, "signup-driver-filled");
  await d.getByRole("button", { name: "Continue to verification" }).click();
  await d.waitForURL(/#\/d\/onboarding\/details/, { timeout: 30_000 });

  // Step 1 — details
  await d.getByLabel("CNIC number").fill(driver.cnic);
  await d.getByRole("button", { name: "Lahore", exact: true }).click();
  await d.getByLabel("Driving license number").fill(driver.licenseNumber);
  await shot(d, "onboarding-details");
  await d.getByRole("button", { name: "Save & continue" }).click();
  await d.waitForURL(/#\/d\/onboarding\/vehicle/);

  // Step 2 — vehicle (Ride category is the default; pick Suzuki Cultus from the catalogue)
  await d.getByRole("button", { name: /^Ride\b/ }).first().click();
  await d.getByPlaceholder(/Search .* models/).fill("Cultus");
  await d.getByRole("button", { name: /Suzuki Cultus/ }).click();
  await d.getByLabel("Model year").fill(driver.year);
  await d.getByLabel("Number plate").fill(driver.plate);
  await d.getByRole("button", { name: driver.color, exact: true }).click();
  await shot(d, "onboarding-vehicle");
  await d.getByRole("button", { name: "Save & continue" }).click();
  await d.waitForURL(/#\/d\/onboarding\/documents/);

  // Step 3 — documents, each verified live by Gemini
  const DOCS = [
    ["selfie", "Live selfie"],
    ["cnic_front", "CNIC — front"],
    ["cnic_back", "CNIC — back"],
    ["driving_license", "Driving license"],
    ["route_permit", "Route permit"],
    ["vehicle_registration", "Vehicle documents"],
    ["vehicle_photo", "Vehicle photo"],
  ];
  await d.getByRole("button", { name: "Add Live selfie" }).waitFor();
  await shot(d, "onboarding-documents-empty");
  const verdicts = {};
  for (const [type, label] of DOCS) {
    await uploadVia(d, d.getByRole("button", { name: `Add ${label}` }), fixtures[type]);
    // Tile flips to "<label>: <status>. Tap for details" once the verdict is in.
    const tile = d.getByRole("button", { name: new RegExp(`^${label.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}: `) });
    await tile.waitFor({ timeout: 120_000 });
    const aria = await tile.getAttribute("aria-label");
    verdicts[type] = aria.replace(`${label}: `, "").replace(". Tap for details", "");
    log(`  ${label} → ${verdicts[type]}`);
    if (type === "selfie") await shot(d, "onboarding-document-verdict-selfie");
  }
  await shot(d, "onboarding-documents-verdicts");
  // Open one tile to capture the full AI verdict sheet.
  await d.getByRole("button", { name: /^CNIC — front: / }).click();
  await d.getByText("AI verification", { exact: true }).first().waitFor();
  await shot(d, "onboarding-document-sheet");
  await d.getByRole("button", { name: "Close" }).click();
  await d.getByRole("button", { name: "Continue" }).click();
  await d.waitForURL(/#\/d\/onboarding\/subscription/);

  // Step 4 — subscription. Test mode (the default) is a single "Pay now" tap;
  // with test mode off the receipt form is shown instead.
  await d.getByRole("button", { name: /^Pay PKR|^JazzCash$/ }).first().waitFor({ timeout: 30_000 });
  const payNow = d.getByRole("button", { name: /^Pay PKR/ });
  if (await payNow.isVisible().catch(() => false)) {
    await shot(d, "onboarding-subscription-filled");
    await payNow.click();
  } else {
    await d.getByRole("button", { name: "JazzCash" }).first().click();
    await d.getByLabel("Transaction ID (optional)").fill(driver.txRef);
    await uploadVia(d, d.getByRole("button", { name: /Add screenshot/ }), fixtures.receiptJpg);
    await d.getByText("Attached").waitFor({ timeout: 30_000 });
    await shot(d, "onboarding-subscription-filled");
    await d.getByRole("button", { name: "Submit receipt" }).click();
  }
  await d.getByText("Subscription active").first().waitFor({ timeout: 30_000 });
  await shot(d, "onboarding-subscription-active");
  await d.getByRole("button", { name: "Continue" }).click();
  await d.waitForURL(/#\/d\/onboarding\/review/);

  // Step 5 — review & submit
  await shot(d, "onboarding-review", { settle: 1500 });
  await d.getByRole("checkbox").click();
  await d.getByRole("button", { name: "Submit for approval" }).click();
  await d.waitForURL(/#\/d\/onboarding\/status/, { timeout: 30_000 });
  await d.waitForTimeout(1500);
  const dToken = await tokenOf(d);
  let dDriver = await apiFetch("/api/driver", { token: dToken });
  log("driver status after submit:", dDriver.status, "docs:", dDriver.documents.map((x) => `${x.type}=${x.status}`).join(" "));
  if (dDriver.status === "under_review") {
    await d.getByText("Documents under review").waitFor();
    await shot(d, "onboarding-status-under-review");
  } else {
    expect(dDriver.status === "approved", `driver status is under_review or approved (got ${dDriver.status})`);
    await shot(d, "onboarding-status-approved");
  }

  /* ------------------------------------------------------------------ */
  /* 3. Admin reviews and approves                                       */
  /* ------------------------------------------------------------------ */
  mark("3 admin review");
  await a.goto(`${API}/admin/login`);
  await a.getByLabel("Email").fill(ADMIN.email);
  await a.getByLabel("Password").fill(ADMIN.password);
  await shot(a, "login", { admin: true });
  await a.getByRole("button", { name: "Sign in" }).click();
  await a.waitForURL(/\/admin$/, { timeout: 30_000 });
  await a.getByRole("heading", { name: /Dashboard|Good/ }).first().waitFor().catch(() => {});
  await shot(a, "dashboard", { admin: true, settle: 3500 });

  // In test mode the driver is already approved, so look in the matching list.
  await a.goto(`${API}/admin/drivers?status=${dDriver.status}`);
  await a.getByText(driver.fullName).first().waitFor({ timeout: 30_000 });
  await shot(a, dDriver.status === "approved" ? "drivers-approved" : "drivers-under-review", { admin: true, settle: 2000 });
  await a.getByText(driver.fullName).first().click();
  await a.waitForURL(/\/admin\/drivers\/[0-9a-f-]+$/);
  await a.getByText(/Gemini verdict|test mode/i).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await shot(a, "driver-detail", { admin: true, settle: 2500 });
  await shot(a, "driver-detail-full", { admin: true, settle: 500, fullPage: true });
  const driverId = a.url().split("/").pop();
  expect(driverId === dDriver.id, "admin opened the right driver");

  // Open the document lightbox once for the gallery screenshot.
  await a.getByRole("button", { name: "Open CNIC — front" }).click();
  await a.waitForTimeout(800);
  await shot(a, "driver-document-lightbox", { admin: true, settle: 600 });
  await a.keyboard.press("Escape");

  // Verify every document through the UI (Verify → "Mark verified").
  for (const [, label] of DOCS) {
    const fresh = await apiFetch(`/api/admin/drivers/${driverId}`, { cookie: await adminCookie(aCtx) });
    if (fresh.status === "approved") break;
    const article = a.locator("article", { hasText: label }).first();
    const verify = article.getByRole("button", { name: "Verify", exact: true });
    if (!(await verify.count()) || (await verify.isDisabled())) continue;
    await verify.click();
    await a.getByRole("button", { name: "Mark verified" }).click();
    await a.getByRole("button", { name: "Mark verified" }).waitFor({ state: "detached", timeout: 20_000 });
    await a.waitForTimeout(500);
  }
  dDriver = await apiFetch(`/api/admin/drivers/${driverId}`, { cookie: await adminCookie(aCtx) });
  expect(dDriver.documents.every((x) => x.status === "verified"), "every document verified by the admin");
  if (dDriver.status !== "approved") {
    await a.reload();
    await a.getByRole("button", { name: "Approve", exact: true }).click();
    await a.getByRole("button", { name: "Approve driver" }).click();
    await a.getByText("Driver approved").waitFor({ timeout: 20_000 });
    dDriver = await apiFetch(`/api/admin/drivers/${driverId}`, { cookie: await adminCookie(aCtx) });
  }
  expect(dDriver.status === "approved", "driver approved");
  await shot(a, "driver-detail-approved", { admin: true, settle: 1500 });

  for (const [name, url] of [
    ["drivers", "/admin/drivers"],
    ["live-map", "/admin/live"],
    ["settings", "/admin/settings"],
    ["subscriptions", "/admin/subscriptions"],
    ["rides", "/admin/rides"],
    ["customers", "/admin/customers"],
  ]) {
    await a.goto(`${API}${url}`);
    await a.waitForLoadState("networkidle").catch(() => {});
    await shot(a, name, { admin: true, settle: 3000 });
  }

  /* ------------------------------------------------------------------ */
  /* 4. Driver goes online                                               */
  /* ------------------------------------------------------------------ */
  mark("4 driver online");
  await d.goto(`${APP}/#/d/home`);
  await d.reload();
  await d.getByRole("button", { name: /Go online/ }).waitFor({ timeout: 30_000 });
  await shot(d, "driver-home-offline", { settle: 3000 });
  await d.getByRole("button", { name: /Go online/ }).click();
  await d.getByText("You're online").first().waitFor({ timeout: 20_000 });
  await shot(d, "driver-online", { settle: 2500 });
  await pollUntil(async () => (await apiFetch("/api/driver", { token: dToken })).lastLocation, { label: "driver location ping", timeout: 20_000 });

  /* ------------------------------------------------------------------ */
  /* 5. Customer plans a ride                                            */
  /* ------------------------------------------------------------------ */
  mark("5 customer plans ride");
  await c.goto(`${APP}/#/c/home`);
  await c.getByRole("button", { name: /Where to\?/ }).click();
  await c.waitForURL(/#\/c\/plan/);
  await c.getByRole("button", { name: /Drop-off/ }).click();
  await c.getByPlaceholder("Search your destination").fill("Johar Town");
  const firstResult = c.getByRole("button", { name: /^Johar Town/ }).first();
  await firstResult.waitFor({ timeout: 30_000 });
  await shot(c, "plan-search-results");
  await firstResult.click();
  await c.getByText("Your offer").waitFor({ timeout: 40_000 });
  await c.getByRole("button", { name: /Find a driver for PKR/ }).waitFor({ timeout: 40_000 });
  await shot(c, "plan-quote", { settle: 2500 });
  const ctaText = await c.getByRole("button", { name: /Find a driver for PKR/ }).innerText();
  const offeredFare = Number(ctaText.replace(/[^\d]/g, ""));
  expect(offeredFare > 0, `recommended offer pre-filled (${offeredFare})`);
  await c.getByRole("button", { name: /Find a driver for PKR/ }).click();
  await c.waitForURL(/#\/c\/request\/[0-9a-f-]+/, { timeout: 30_000 });
  const requestId = c.url().split("/").pop();
  await c.getByText("Sending your offer to nearby drivers").waitFor();
  await shot(c, "bidding-radar", { settle: 2500 });

  /* ------------------------------------------------------------------ */
  /* 6. Driver sees the request and counter-offers +10%                  */
  /* ------------------------------------------------------------------ */
  mark("6 driver bids");
  // Newest request stacks on top; earlier runs may have left open requests behind.
  const card = d.getByRole("article", { name: `Request from ${customer.fullName}` }).first();
  await card.waitFor({ timeout: 20_000 });
  await shot(d, "driver-request-card", { settle: 1500 });
  await card.getByRole("button", { name: "Offer price" }).click();
  await d.waitForURL(new RegExp(`#/d/request/${requestId}`), { timeout: 10_000 });
  const plusTen = d.getByRole("button", { name: /^\+10% · / });
  await plusTen.waitFor();
  await shot(d, "driver-bid-composer", { settle: 2000 });
  await plusTen.click();
  const bidAmount = Number((await plusTen.innerText()).split("·").pop().replace(/[^\d]/g, ""));
  expect(bidAmount > offeredFare, `+10% chip raises the price (${offeredFare} → ${bidAmount})`);
  await shot(d, "driver-bid-composer-plus10");
  await d.getByRole("button", { name: /^Send offer/ }).click();
  await d.waitForURL(/#\/d\/home/);
  await d.getByText(/Offer sent/).first().waitFor({ timeout: 20_000 });
  await shot(d, "driver-offer-sent", { settle: 1500 });

  /* ------------------------------------------------------------------ */
  /* 7. Customer accepts and chats                                       */
  /* ------------------------------------------------------------------ */
  mark("7 customer accepts");
  const acceptBtn = c.getByRole("button", { name: /^Accept PKR/ });
  await acceptBtn.waitFor({ timeout: 20_000 });
  await shot(c, "bidding-bid-card", { settle: 1200 });
  const acceptText = await acceptBtn.innerText();
  expect(Number(acceptText.replace(/[^\d]/g, "")) === bidAmount, "bid card shows the driver's counter-offer");
  await acceptBtn.click();
  await c.waitForURL(/#\/c\/ride\/[0-9a-f-]+/, { timeout: 30_000 });
  const rideId = c.url().split("/").pop();
  await c.getByText(/is on the way|Driver is on the way/).waitFor({ timeout: 20_000 });
  await shot(c, "customer-ride-assigned", { settle: 3000 });
  await c.getByRole("button", { name: "Message driver" }).click();
  await c.waitForURL(new RegExp(`#/rides/${rideId}/chat`));
  await c.getByPlaceholder(/^Message/).fill("I'm at the gate");
  await c.getByRole("button", { name: "Send" }).click();
  await c.getByText("I'm at the gate").waitFor();
  await c.waitForTimeout(2500);
  await shot(c, "customer-chat");
  await c.getByRole("button", { name: "Back" }).click();
  await c.waitForURL(new RegExp(`#/c/ride/${rideId}`));

  /* ------------------------------------------------------------------ */
  /* 8. Driver drives the trip                                           */
  /* ------------------------------------------------------------------ */
  mark("8 driver trip");
  await d.waitForURL(new RegExp(`#/d/ride/${rideId}`), { timeout: 20_000 });
  await d.getByRole("button", { name: "I've arrived" }).waitFor({ timeout: 20_000 });
  await d.waitForTimeout(3000);
  await shot(d, "driver-ride-assigned", { settle: 1000 });
  await d.getByRole("button", { name: "I've arrived" }).click();
  await d.getByRole("button", { name: "Start trip" }).waitFor({ timeout: 20_000 });
  await shot(d, "driver-ride-arrived", { settle: 1500 });
  await c.getByText(/has arrived/).waitFor({ timeout: 15_000 });
  await shot(c, "customer-ride-arrived");
  await d.getByRole("button", { name: "Start trip" }).click();
  await d.getByRole("button", { name: "Complete trip" }).waitFor({ timeout: 20_000 });
  await shot(d, "driver-ride-in-progress", { settle: 1500 });
  await c.getByText("Heading to your destination").waitFor({ timeout: 15_000 });
  await shot(c, "customer-ride-in-progress");
  await d.getByRole("button", { name: "Complete trip" }).click();
  await d.getByRole("button", { name: /Cash collected/ }).waitFor({ timeout: 20_000 });
  await shot(d, "driver-ride-completed", { settle: 1500 });
  await d.getByRole("button", { name: /Cash collected/ }).click();
  await d.getByRole("button", { name: "5 stars" }).waitFor();
  await d.getByRole("button", { name: "5 stars" }).click();
  await d.getByRole("button", { name: "Paid promptly" }).click();
  await shot(d, "driver-rating-sheet");
  await d.getByRole("button", { name: "Submit rating" }).click();
  await d.waitForURL(/#\/d\/home/, { timeout: 20_000 });

  /* ------------------------------------------------------------------ */
  /* 9. Customer rates and reviews the history                           */
  /* ------------------------------------------------------------------ */
  mark("9 customer rates");
  await c.getByRole("button", { name: "5 stars" }).waitFor({ timeout: 20_000 });
  await shot(c, "customer-rating-sheet", { settle: 1500 });
  await c.getByRole("button", { name: "5 stars" }).click();
  await c.getByRole("button", { name: "Safe driving" }).click();
  await c.getByRole("button", { name: "Submit rating" }).click();
  await c.waitForURL(/#\/c\/home/, { timeout: 20_000 });
  await c.getByRole("button", { name: "Rides" }).click();
  await c.waitForURL(/#\/c\/rides/);
  await c.getByText(/Johar Town/).first().waitFor({ timeout: 20_000 });
  await shot(c, "customer-rides-history", { settle: 1500 });
  await c.getByText(/Johar Town/).first().click();
  await c.waitForURL(new RegExp(`#/rides/${rideId}`));
  await c.getByText("What the fare covers").waitFor({ timeout: 20_000 });
  await shot(c, "customer-ride-detail", { settle: 2500 });
  await shot(c, "customer-ride-detail-full", { settle: 300, fullPage: true });

  /* ------------------------------------------------------------------ */
  /* 10. Support chat with Gemini, then escalate to a human              */
  /* ------------------------------------------------------------------ */
  mark("10 support");
  await c.goto(`${APP}/#/support`);
  await c.getByText(/how can we help/).waitFor({ timeout: 20_000 });
  await c.getByPlaceholder("Ask anything about Raahi").fill("How is the fare calculated?");
  await c.getByRole("button", { name: "Send" }).click();
  await c.getByText("Raahi assistant").first().waitFor({ timeout: 90_000 });
  // Streaming done when the composer is enabled again and the ticket holds an assistant reply.
  const ticket = await pollUntil(
    async () => {
      const t = await apiFetch("/api/support/tickets", { token: cToken });
      return t.items.find((x) => x.messages.some((m) => m.sender === "assistant")) ?? null;
    },
    { label: "Gemini support reply", timeout: 120_000, interval: 2000 },
  );
  await c.getByPlaceholder(/Ask anything about Raahi|Message the Raahi team/).waitFor({ timeout: 60_000 });
  await c.waitForTimeout(2500);
  await shot(c, "support-gemini-reply");
  const reply = ticket.messages.find((m) => m.sender === "assistant").body;
  const assistantLive = !/couldn't reach the Raahi assistant/i.test(reply);
  log(`  assistant (${assistantLive ? "live Gemini" : "fallback — AI unavailable, auto-escalated"}):`, reply.slice(0, 160).replace(/\n/g, " "));
  report.supportAssistantLive = assistantLive;
  if (!ticket.escalated) {
    await c.getByRole("button", { name: "Human" }).click();
  }
  await c.getByText("Escalated to the Raahi team").waitFor({ timeout: 60_000 });
  const escalated = await apiFetch("/api/support/tickets", { token: cToken });
  expect(escalated.items.some((t) => t.id === ticket.id && t.escalated), "ticket escalated to a human");
  await shot(c, "support-escalated", { settle: 2000 });

  await a.goto(`${API}/admin/support`);
  await a.getByText(customer.fullName).first().waitFor({ timeout: 30_000 });
  await shot(a, "support", { admin: true, settle: 2000 });
  await a.getByText(customer.fullName).first().click();
  await a.getByText("How is the fare calculated?").first().waitFor({ timeout: 20_000 });
  await shot(a, "support-ticket", { admin: true, settle: 2000 });

  /* ------------------------------------------------------------------ */
  /* 11. Driver earnings                                                 */
  /* ------------------------------------------------------------------ */
  mark("11 driver earnings");
  await d.goto(`${APP}/#/d/earnings`);
  await d.getByText("Last 30 days").waitFor({ timeout: 30_000 });
  await d.waitForTimeout(2000);
  const earningsText = await d.locator("body").innerText();
  expect(earningsText.includes(bidAmount.toLocaleString("en-PK")), `earnings screen shows the fare PKR ${bidAmount}`);
  await shot(d, "driver-earnings", { settle: 1500 });
  await d.goto(`${APP}/#/d/rides`);
  await d.getByText(/Johar Town/).first().waitFor({ timeout: 20_000 });
  await shot(d, "driver-rides-history", { settle: 1500 });

  /* ------------------------------------------------------------------ */
  /* Final API assertions                                                */
  /* ------------------------------------------------------------------ */
  mark("assertions");
  const ride = await apiFetch(`/api/rides/${rideId}`, { token: cToken });
  expect(ride.status === "completed", "ride status is completed");
  expect(ride.farePkr === bidAmount, `ride fare PKR ${ride.farePkr} equals accepted bid PKR ${bidAmount}`);
  expect(ride.myRating?.stars === 5, "customer rating saved (5 stars)");
  expect(ride.theirRating?.stars === 5, "driver rating saved (5 stars)");
  const earnings = await apiFetch("/api/driver/earnings", { token: dToken });
  expect(earnings.totalPkr === bidAmount, `driver totalEarningsPkr ${earnings.totalPkr} equals fare`);
  const driverDto = await apiFetch("/api/driver", { token: dToken });
  expect(driverDto.totalEarningsPkr === bidAmount && driverDto.totalRides === 1, "driver DTO totals updated");
  const req = await apiFetch(`/api/requests/${requestId}`, { token: cToken });
  expect(req.status === "accepted" && req.rideId === rideId, "request linked to the ride");

  report.result = "PASS";
  report.rideId = rideId;
  report.farePkr = ride.farePkr;
  report.verdicts = verdicts;
  report.documentVerdicts = (await apiFetch("/api/driver", { token: dToken })).documents.map((x) => ({ type: x.type, status: x.status, model: x.aiVerdict?.model ?? null, summary: x.aiVerdict?.summary?.slice(0, 140) ?? null }));
  log("FLOW PASSED", JSON.stringify({ rideId, farePkr: ride.farePkr, offeredFare, verdicts }));
} catch (err) {
  report.result = "FAIL";
  report.error = err.message;
  console.error("FLOW FAILED:", err.message, err.extra ?? "");
  for (const [tag, page] of [["customer", c], ["driver", d], ["admin", a]]) {
    try {
      await page.screenshot({ path: path.join(OUT, `zz-failure-${tag}.png`) });
      log(`[${tag}] at ${page.url()}`);
    } catch {
      /* page gone */
    }
  }
  process.exitCode = 1;
} finally {
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

async function adminCookie(ctx) {
  const cookies = await ctx.cookies(API);
  return cookies.map((k) => `${k.name}=${k.value}`).join("; ");
}
