import { pickWithInput, itemsFromFiles } from './common.js';

export function create() {
  const d = window.pigeonDesktop;
  return {
    name: 'electron',
    supportsFolders: true,
    supportsShowInFolder: true,
    async init() {
      if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch {} }
    },
    async pickFiles() {
      const files = await pickWithInput({ multiple: true });
      return itemsFromFiles(files);
    },
    async pickFolder() {
      const files = await pickWithInput({ directory: true });
      if (!files.length) return null;
      const name = (files[0].webkitRelativePath || '').split('/')[0] || 'Folder';
      return { name, items: itemsFromFiles(files) };
    },
    saveBegin: (o) => d.saveBegin(o),
    saveChunk: (h, u8) => d.saveChunk(h.token, u8),
    saveEnd: (h) => d.saveEnd(h.token),
    saveAbort: (h) => d.saveAbort(h.token),
    openFile: (p) => d.openPath(p),
    showInFolder: (p) => d.showInFolder(p),
    fileUrl: (p) => d.fileUrl(p),
    downloadsDir: () => d.downloadsDir(),
    notify(title, body) {
      try { if (Notification.permission === 'granted') new Notification(title, { body }); } catch {}
      d.flash?.();
    },
    keepAlive() {},
    setBadge: (n) => d.setBadge?.(n),
  };
}
