// Helpers shared by all platform adapters.
import { guessMime } from '../util.js';

export function blobSource(blob) {
  return { read: (offset, len) => blob.slice(offset, offset + len).arrayBuffer() };
}

export function pickWithInput({ multiple = true, directory = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (directory) input.webkitdirectory = true;
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(input);
    let settled = false;
    const finish = (files) => { if (settled) return; settled = true; setTimeout(() => input.remove(), 0); resolve(files); };
    input.addEventListener('change', () => finish(Array.from(input.files || [])));
    input.addEventListener('cancel', () => finish([]));
    input.click();
  });
}

export function itemsFromFiles(files) {
  return files.map((f) => ({
    path: f.webkitRelativePath || f.name,
    name: f.name,
    size: f.size,
    type: f.type || guessMime(f.name),
    source: blobSource(f),
    blob: f,
  }));
}

// Walk dropped items (files and directories) using the FileSystem entry API.
export async function itemsFromDataTransfer(dt) {
  const entries = [];
  for (const item of dt.items || []) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (!entries.length) {
    return { items: itemsFromFiles(Array.from(dt.files || [])), rootDirs: [] };
  }
  const items = [];
  const rootDirs = [];
  const walk = (entry, prefix) => new Promise((resolve, reject) => {
    if (entry.isFile) {
      entry.file((f) => {
        items.push({ path: prefix + f.name, name: f.name, size: f.size, type: f.type || guessMime(f.name), source: blobSource(f), blob: f });
        resolve();
      }, reject);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const readMore = () => reader.readEntries(async (batch) => {
        if (!batch.length) {
          try { for (const e of all) await walk(e, prefix + entry.name + '/'); resolve(); } catch (e) { reject(e); }
          return;
        }
        all.push(...batch);
        readMore();
      }, reject);
      readMore();
    } else resolve();
  });
  for (const e of entries) {
    if (e.isDirectory) rootDirs.push(e.name);
    await walk(e, '');
  }
  return { items, rootDirs };
}

export function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}
