// Launches the real Electron app (desktop/) under Playwright, checks it boots and that the
// native save pipeline (IPC -> disk) works. Run under xvfb on Linux: xvfb-run node tools/desktop-smoke.mjs
import { createRequire } from 'node:module';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PW_REQUIRE_FROM || import.meta.url);
const { _electron: electron } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(root, 'desktop');
const shots = process.env.SHOTS_DIR || path.join(root, 'tools', 'shots');
mkdirSync(shots, { recursive: true });

const exe = process.env.ELECTRON_PATH || path.join(desktop, 'node_modules', 'electron', 'dist', 'electron');
const packaged = !!process.env.ELECTRON_PATH; // a packaged binary already contains the app
const app = await electron.launch({ executablePath: exe, args: packaged ? ['--no-sandbox'] : [desktop, '--no-sandbox'], env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' } });
const failures = [];
try {
  const page = await app.firstWindow();
  page.on('pageerror', (e) => failures.push('pageerror: ' + e.message));
  await page.waitForFunction(() => window.pigeon && window.pigeon.state.identity && window.pigeon.platform, null, { timeout: 20000 });
  const info = await page.evaluate(() => ({ platform: window.pigeon.platform.name, id: window.pigeon.state.identity.id, status: window.pigeon.net.status, title: document.title }));
  console.log('booted:', info);
  if (info.platform !== 'electron') failures.push('platform adapter is ' + info.platform);
  if (!/^[A-Z2-9]{8}$/.test(info.id)) failures.push('bad identity id ' + info.id);

  // native save pipeline
  const saved = await page.evaluate(async () => {
    const p = window.pigeon.platform;
    const h = await p.saveBegin({ contactName: 'Smoke Test', contactId: 'X', relPath: 'nested/dir/hello.txt' });
    await p.saveChunk(h, new TextEncoder().encode('hello '));
    await p.saveChunk(h, new TextEncoder().encode('world'));
    const r = await p.saveEnd(h);
    const dir = await p.downloadsDir();
    return { ...r, dir };
  });
  console.log('saved:', saved);
  if (!existsSync(saved.path) || readFileSync(saved.path, 'utf8') !== 'hello world') failures.push('saved file missing or wrong content');
  if (!saved.path.startsWith(saved.dir)) failures.push('file saved outside downloads dir');
  // second save with same name must not overwrite
  const saved2 = await page.evaluate(async () => {
    const p = window.pigeon.platform;
    const h = await p.saveBegin({ contactName: 'Smoke Test', contactId: 'X', relPath: 'nested/dir/hello.txt' });
    await p.saveChunk(h, new TextEncoder().encode('again'));
    return p.saveEnd(h);
  });
  if (saved2.path === saved.path || !saved2.path.includes('(1)')) failures.push('duplicate name not uniquified: ' + saved2.path);

  // welcome dialog (first run) then main UI
  await page.screenshot({ path: path.join(shots, 'desktop-first-run.png') });
  const hasNameDialog = await page.$('form[data-form="name"] input');
  if (hasNameDialog) { await page.fill('form[data-form="name"] input', 'Laptop'); await page.press('form[data-form="name"] input', 'Enter'); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, 'desktop-main.png') });
  const myId = await page.textContent('.myid');
  console.log('UI shows ID', myId, '| net status:', await page.evaluate(() => window.pigeon.net.status));
} catch (e) {
  failures.push(e.stack || String(e));
} finally {
  await app.close();
}
if (failures.length) { console.error('SMOKE FAILURES:\n' + failures.join('\n')); process.exit(1); }
console.log('DESKTOP SMOKE PASSED');
