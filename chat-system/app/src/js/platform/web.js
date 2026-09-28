// Plain-browser fallback (used for development/testing). Received files are downloaded via the browser.
import { pickWithInput, itemsFromFiles, concatChunks } from './common.js';

export function create() {
  return {
    name: 'web',
    supportsFolders: true,
    supportsShowInFolder: false,
    async init() {
      if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
    },
    async pickFiles() { return itemsFromFiles(await pickWithInput({ multiple: true })); },
    async pickFolder() {
      const files = await pickWithInput({ directory: true });
      if (!files.length) return null;
      const name = (files[0].webkitRelativePath || '').split('/')[0] || 'Folder';
      return { name, items: itemsFromFiles(files) };
    },
    async saveBegin({ relPath, type }) { return { relPath, type, chunks: [], len: 0 }; },
    async saveChunk(h, u8) { h.chunks.push(u8); h.len += u8.length; },
    async saveEnd(h) {
      const blob = new Blob([concatChunks(h.chunks, h.len)], { type: h.type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = h.relPath.split('/').pop();
      document.body.appendChild(a); a.click(); a.remove();
      window.__pigeonReceived = (window.__pigeonReceived || []).concat([{ relPath: h.relPath, size: h.len, blob }]);
      return { path: h.relPath, url };
    },
    async saveAbort() {},
    openFile: (p) => { if (/^(blob|http)/.test(p)) window.open(p, '_blank'); },
    showInFolder: null,
    fileUrl: (p) => p,
    downloadsDir: async () => 'your browser downloads folder',
    notify(title, body) { try { if (Notification.permission === 'granted') new Notification(title, { body }); } catch {} },
    keepAlive() {},
  };
}
