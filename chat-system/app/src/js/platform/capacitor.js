import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { pickWithInput, itemsFromFiles, concatChunks } from './common.js';
import { u8ToBase64, base64ToU8, guessMime, sanitizeName, sanitizeRelPath } from '../util.js';

const FolderPicker = registerPlugin('FolderPicker');
const KeepAlive = registerPlugin('KeepAlive');
const ROOT = 'Pigeon';
const FLUSH_AT = 1024 * 1024;

function uriSource(uri) {
  return {
    async read(offset, length) {
      const r = await FolderPicker.readChunk({ uri, offset, length });
      return base64ToU8(r.data || '').buffer;
    },
  };
}

async function exists(path) {
  try { await Filesystem.stat({ path, directory: Directory.Documents }); return true; } catch { return false; }
}

async function uniquePath(path) {
  if (!(await exists(path))) return path;
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  const hasExt = dot > slash + 1;
  const base = hasExt ? path.slice(0, dot) : path;
  const ext = hasExt ? path.slice(dot) : '';
  for (let n = 1; n < 10000; n++) {
    const c = `${base} (${n})${ext}`;
    if (!(await exists(c))) return c;
  }
  return `${base}-${Date.now()}${ext}`;
}

async function flush(h) {
  if (!h.pendingLen) return;
  const u8 = concatChunks(h.chunks, h.pendingLen);
  h.chunks = [];
  h.pendingLen = 0;
  await Filesystem.appendFile({ path: h.path, data: u8ToBase64(u8), directory: Directory.Documents });
}

export function create() {
  return {
    name: 'android',
    supportsFolders: true,
    supportsShowInFolder: false,
    async init({ onBack }) {
      try { await Filesystem.requestPermissions(); } catch {}
      try { await KeepAlive.requestPermissions(); } catch {}
      App.addListener('backButton', () => { if (!onBack()) App.exitApp(); });
    },
    async pickFiles() {
      const files = await pickWithInput({ multiple: true });
      return itemsFromFiles(files);
    },
    async pickFolder() {
      let res;
      try { res = await FolderPicker.pick(); } catch { return null; }
      if (!res || !res.files || !res.files.length) return res && res.name ? { name: res.name, items: [] } : null;
      const items = res.files.map((f) => ({
        path: `${res.name}/${f.relPath}`,
        name: f.name,
        size: Number(f.size) || 0,
        type: f.mime || guessMime(f.name),
        source: uriSource(f.uri),
      }));
      return { name: res.name, items };
    },
    async saveBegin({ contactName, contactId, relPath }) {
      const dir = `${ROOT}/${sanitizeName(contactName || contactId)}`;
      const path = await uniquePath(`${dir}/${sanitizeRelPath(relPath)}`);
      await Filesystem.writeFile({ path, data: '', directory: Directory.Documents, recursive: true });
      return { path, chunks: [], pendingLen: 0 };
    },
    async saveChunk(h, u8) {
      h.chunks.push(u8);
      h.pendingLen += u8.length;
      if (h.pendingLen >= FLUSH_AT) await flush(h);
    },
    async saveEnd(h) {
      await flush(h);
      const { uri } = await Filesystem.getUri({ path: h.path, directory: Directory.Documents });
      return { path: uri, url: Capacitor.convertFileSrc(uri) };
    },
    async saveAbort(h) {
      try { await Filesystem.deleteFile({ path: h.path, directory: Directory.Documents }); } catch {}
    },
    openFile: (p) => FolderPicker.openFile({ path: p }),
    showInFolder: null,
    fileUrl: (p) => Capacitor.convertFileSrc(p),
    downloadsDir: async () => `Documents/${ROOT}`,
    notify(title, body) { KeepAlive.notify({ title, body }).catch(() => {}); },
    keepAlive(on) { (on ? KeepAlive.start() : KeepAlive.stop()).catch(() => {}); },
    async share(text) { try { await navigator.share({ text }); } catch {} },
  };
}
