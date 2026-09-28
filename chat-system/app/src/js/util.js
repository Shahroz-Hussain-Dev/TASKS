// Small shared helpers used across the app.

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

export function genPeerId(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

export function normalizeId(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function mimeKind(type, name = '') {
  const t = (type || '').toLowerCase();
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'].includes(ext)) return 'image';
  if (t.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'flac', 'weba'].includes(ext)) return 'audio';
  if (t.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v'].includes(ext)) return 'video';
  return 'file';
}

export function guessMime(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/opus', flac: 'audio/flac', weba: 'audio/webm',
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', avi: 'video/x-msvideo',
    pdf: 'application/pdf', txt: 'text/plain', zip: 'application/zip', json: 'application/json', apk: 'application/vnd.android.package-archive',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] || 'application/octet-stream';
}

export function fileIcon(kind, name = '') {
  if (kind === 'image') return '🖼️';
  if (kind === 'audio') return '🎵';
  if (kind === 'video') return '🎬';
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
  if (['pdf'].includes(ext)) return '📕';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['apk', 'exe', 'msi', 'dmg', 'deb'].includes(ext)) return '📦';
  return '📄';
}

// Base64 helpers that work on large Uint8Arrays without blowing the call stack.
export function u8ToBase64(u8) {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
  return btoa(s);
}

export function base64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function sanitizeRelPath(p) {
  // Keep folder structure but strip anything that could escape the destination.
  return String(p || 'file')
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => seg.replace(/[<>:"|?*\x00-\x1f]/g, '_').trim() || '_')
    .join('/') || 'file';
}

export function sanitizeName(s) {
  return String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 60) || 'unknown';
}

export const isNarrow = () => window.matchMedia('(max-width: 760px)').matches;

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export async function makeThumbnail(blob, max = 360) {
  try {
    if (blob.size > 25 * 1024 * 1024) return null;
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch { return null; }
}
