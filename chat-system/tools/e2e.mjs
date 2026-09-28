// End-to-end test: two browser contexts chat and exchange files through a local PeerJS server.
// Usage: node tools/e2e.mjs  (needs playwright-core; starts `peerjs` on port 9000 and a static server for app/www)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PW_REQUIRE_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'app/www');
const PEER_PORT = 9000, WEB_PORT = 8123;
const shots = process.env.SHOTS_DIR || path.join(root, 'tools', 'shots');
mkdirSync(shots, { recursive: true });

function serveStatic() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = path.join(www, decodeURIComponent(req.url.split('?')[0]));
      if (p.endsWith('/')) p += 'index.html';
      if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
      res.end(readFileSync(p));
    }).listen(WEB_PORT, () => resolve(srv));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, { timeout = 30000, what = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await fn()) return; await sleep(200); }
  throw new Error(`Timed out waiting for ${what}`);
}

async function main() {
  const peerSrv = spawn(process.execPath, [path.join(root, 'tools/peer-server.mjs'), String(PEER_PORT)], { stdio: 'inherit', env: process.env });
  const web = await serveStatic();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const failures = [];
  try {
    await sleep(1500);
    const settings = JSON.stringify({ peerHost: '127.0.0.1', peerPort: PEER_PORT, peerPath: '/', peerSecure: false, iceServers: [], autoAcceptFiles: true, notifications: false });
    const mk = async (name, id) => {
      const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 }, permissions: ['notifications', 'microphone'] });
      await ctx.addInitScript(({ settings, name, id }) => {
        localStorage.setItem('pigeon.settings', settings);
        localStorage.setItem('pigeon.identity', JSON.stringify({ id, name, createdAt: Date.now() }));
      }, { settings, name, id });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => failures.push(`${name} pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name} console] ${m.text()}`); });
      await page.goto(`http://localhost:${WEB_PORT}/index.html`);
      return page;
    };
    const A = await mk('Alice', 'ALICE001');
    const B = await mk('Bob', 'BOB00001');
    await waitFor(async () => (await A.evaluate(() => window.pigeon?.net?.status)) === 'online' && (await B.evaluate(() => window.pigeon?.net?.status)) === 'online', { what: 'both online' });
    console.log('✓ both peers registered with signalling server');

    // Alice adds Bob -> Bob gets a request -> accepts
    await A.fill('.add-form input', 'bob00001');
    await A.press('.add-form input', 'Enter');
    await waitFor(() => B.$('[data-action="accept-request"]'), { what: 'request on Bob' });
    await B.screenshot({ path: path.join(shots, 'bob-request.png') });
    await B.click('[data-action="accept-request"]');
    await waitFor(() => A.evaluate(() => window.pigeon.state.presence.get('BOB00001') === true), { what: 'Alice sees Bob online' });
    await waitFor(() => B.evaluate(() => window.pigeon.state.presence.get('ALICE001') === true), { what: 'Bob sees Alice online' });
    console.log('✓ pairing + presence works');

    // text both ways
    await A.fill('.composer .input', 'Hello Bob! 👋');
    await A.press('.composer .input', 'Enter');
    await waitFor(() => B.evaluate(() => document.body.innerText.includes('Hello Bob!')), { what: 'Bob receives text' });
    await waitFor(() => A.evaluate(() => !!document.querySelector('.msg.out .st.delivered')), { what: 'delivery receipt' });
    await B.fill('.composer .input', 'Hi Alice, got it.');
    await B.press('.composer .input', 'Enter');
    await waitFor(() => A.evaluate(() => document.body.innerText.includes('Hi Alice, got it.')), { what: 'Alice receives text' });
    console.log('✓ text messages + delivery receipts');

    // files: 3 MB binary + an image, via the programmatic API (same path as picker/drop)
    await A.evaluate(async () => {
      const big = new Uint8Array(3 * 1024 * 1024); for (let i = 0; i < big.length; i++) big[i] = (i * 31) & 255;
      const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#4f8cff'; g.fillRect(0, 0, 200, 120); g.fillStyle = '#fff'; g.font = '30px sans-serif'; g.fillText('Pigeon', 40, 70);
      const png = await new Promise((r) => c.toBlob(r, 'image/png'));
      const bigBlob = new Blob([big]);
      const src = (b) => ({ read: (o, l) => b.slice(o, o + l).arrayBuffer() });
      await window.pigeon.sendItems([
        { path: 'data.bin', name: 'data.bin', size: bigBlob.size, type: 'application/octet-stream', source: src(bigBlob), blob: bigBlob },
        { path: 'pic.png', name: 'pic.png', size: png.size, type: 'image/png', source: src(png), blob: png },
      ], { kind: 'files' });
    });
    await waitFor(() => B.evaluate(() => (window.__pigeonReceived || []).length === 2), { timeout: 60000, what: 'Bob receives 2 files' });
    const ok = await B.evaluate(async () => {
      const r = window.__pigeonReceived; const bin = r.find((x) => x.relPath === 'data.bin'); const u8 = new Uint8Array(await bin.blob.arrayBuffer());
      let good = u8.length === 3 * 1024 * 1024; for (let i = 0; i < u8.length && good; i += 997) if (u8[i] !== ((i * 31) & 255)) good = false; return good;
    });
    if (!ok) failures.push('received data.bin content mismatch');
    await waitFor(() => A.evaluate(() => { const m = window.pigeon.state.messages.at(-1); return m && ['done', 'delivered'].includes(m.status); }), { what: 'sender marks transfer done' });
    console.log('✓ file transfer (3 MB + image) with integrity check');

    // folder with nested structure
    await B.evaluate(async () => {
      const src = (b) => ({ read: (o, l) => b.slice(o, o + l).arrayBuffer() });
      const mkf = (p, txt) => { const b = new Blob([txt]); return { path: p, name: p.split('/').pop(), size: b.size, type: 'text/plain', source: src(b), blob: b }; };
      await window.pigeon.sendItems([mkf('Photos/a.txt', 'aaa'), mkf('Photos/sub/b.txt', 'bbbb'), mkf('Photos/sub/deep/c.txt', 'c')], { kind: 'folder', name: 'Photos' });
    });
    await waitFor(() => A.evaluate(() => (window.__pigeonReceived || []).length === 3), { what: 'Alice receives folder' });
    const paths = await A.evaluate(() => window.__pigeonReceived.map((x) => x.relPath).sort());
    if (JSON.stringify(paths) !== JSON.stringify(['Photos/a.txt', 'Photos/sub/b.txt', 'Photos/sub/deep/c.txt'])) failures.push('folder paths wrong: ' + paths);
    console.log('✓ folder transfer keeps nested paths');

    // voice note via fake microphone
    await B.click('[data-action="mic"]');
    await sleep(1500);
    await B.click('[data-action="rec-stop"]');
    await waitFor(() => A.evaluate(() => (window.__pigeonReceived || []).some((x) => x.relPath.startsWith('voice-'))), { what: 'voice note received' });
    console.log('✓ voice note recorded and received');

    // offline queueing: Bob closes, Alice sends, Bob reopens and receives
    await A.screenshot({ path: path.join(shots, 'alice-chat.png') });
    await B.screenshot({ path: path.join(shots, 'bob-chat.png') });
    const bctx = B.context();
    await B.close();
    await waitFor(() => A.evaluate(() => window.pigeon.state.presence.get('BOB00001') === false), { timeout: 75000, what: 'Alice sees Bob offline' });
    await A.fill('.composer .input', 'Sent while you were offline');
    await A.press('.composer .input', 'Enter');
    await waitFor(() => A.evaluate(() => !!document.querySelector('.msg.out .st.pending')), { what: 'pending status' });
    const B2 = await bctx.newPage();
    B2.on('pageerror', (e) => failures.push(`Bob2 pageerror: ${e.message}`));
    await B2.goto(`http://localhost:${WEB_PORT}/index.html`);
    await waitFor(() => B2.evaluate(() => window.pigeon?.state?.presence?.get('ALICE001') === true), { what: 'Bob back online' });
    await B2.click('[data-action="select"][data-id="ALICE001"]');
    await waitFor(() => B2.evaluate(() => Array.from(document.querySelectorAll('.messages .msg .text')).some((el) => el.textContent.includes('Sent while you were offline'))), { what: 'queued message delivered' });
    const hist = await B2.evaluate(() => document.querySelectorAll('.messages .msg').length);
    if (hist < 6) failures.push(`expected full history restored from IndexedDB, got ${hist} messages`);
    console.log(`✓ offline queue + persistence (Bob restored ${hist} messages from IndexedDB)`);
    await B2.screenshot({ path: path.join(shots, 'bob-restored.png') });
    // narrow (phone) layout screenshot
    await B2.setViewportSize({ width: 390, height: 800 });
    await sleep(300);
    await B2.screenshot({ path: path.join(shots, 'bob-phone.png') });
  } catch (e) {
    failures.push(e.stack || String(e));
  } finally {
    await browser.close();
    web.close();
    peerSrv.kill();
  }
  if (failures.length) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
  console.log('\nALL E2E CHECKS PASSED');
}
main();
