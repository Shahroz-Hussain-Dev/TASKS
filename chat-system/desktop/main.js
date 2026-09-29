// Electron main process for Pigeon.
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { once } = require('node:events');
const { pathToFileURL } = require('node:url');

const APP_ID = 'dev.shahroz.pigeon';
const ROOT_DIR_NAME = 'Pigeon';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); }
  });
}

app.setAppUserModelId(APP_ID);

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 720, minWidth: 420, minHeight: 520,
    backgroundColor: '#0f1115',
    title: 'Pigeon',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  // Allow microphone use for voice notes.
  win.webContents.session.setPermissionRequestHandler((wc, permission, cb) => {
    cb(['media', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission));
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---------------------------------------------------------------- file saving
const saves = new Map(); // token -> { stream, path }
let tokenSeq = 1;

function sanitizeSegment(seg) {
  return seg.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim() || '_';
}
function sanitizeRel(rel) {
  return String(rel || 'file').replace(/\\/g, '/').split('/').filter((s) => s && s !== '.' && s !== '..').map(sanitizeSegment).join(path.sep) || 'file';
}
function downloadsRoot() {
  return path.join(app.getPath('downloads'), ROOT_DIR_NAME);
}
async function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const ext = path.extname(p);
  const base = p.slice(0, p.length - ext.length);
  for (let n = 1; n < 10000; n++) {
    const c = `${base} (${n})${ext}`;
    if (!fs.existsSync(c)) return c;
  }
  return `${base}-${Date.now()}${ext}`;
}

ipcMain.handle('save:begin', async (e, { contactName, contactId, relPath }) => {
  const dir = path.join(downloadsRoot(), sanitizeSegment(String(contactName || contactId || 'unknown').slice(0, 60)));
  const target = await uniquePath(path.join(dir, sanitizeRel(relPath)));
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const stream = fs.createWriteStream(target);
  const token = tokenSeq++;
  saves.set(token, { stream, path: target });
  return { token, path: target };
});
ipcMain.handle('save:chunk', async (e, token, chunk) => {
  const s = saves.get(token);
  if (!s) throw new Error('Unknown save token');
  const buf = Buffer.from(chunk.buffer ? chunk.buffer : chunk, chunk.byteOffset || 0, chunk.byteLength);
  if (!s.stream.write(buf)) await once(s.stream, 'drain');
});
ipcMain.handle('save:end', async (e, token) => {
  const s = saves.get(token);
  if (!s) throw new Error('Unknown save token');
  saves.delete(token);
  await new Promise((resolve, reject) => { s.stream.on('error', reject); s.stream.end(resolve); });
  return { path: s.path, url: pathToFileURL(s.path).href };
});
ipcMain.handle('save:abort', async (e, token) => {
  const s = saves.get(token);
  if (!s) return;
  saves.delete(token);
  await new Promise((resolve) => s.stream.destroy(undefined, resolve));
  try { await fsp.unlink(s.path); } catch {}
});

// ---------------------------------------------------------------- misc
ipcMain.handle('open-path', async (e, p) => shell.openPath(p));
ipcMain.handle('show-in-folder', async (e, p) => {
  try { const st = await fsp.stat(p); if (st.isDirectory()) return shell.openPath(p); } catch {}
  shell.showItemInFolder(p);
});
ipcMain.handle('downloads-dir', () => downloadsRoot());
ipcMain.handle('flash', () => { if (win && !win.isFocused()) win.flashFrame(true); });
ipcMain.handle('set-badge', (e, n) => { try { app.setBadgeCount(Number(n) || 0); } catch {} });
