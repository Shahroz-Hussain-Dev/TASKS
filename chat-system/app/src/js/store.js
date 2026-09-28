// Persistence: IndexedDB for contacts + messages, localStorage for identity/settings.
import { genPeerId } from './util.js';

const DB_NAME = 'pigeon';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS = {
  peerHost: '',      // empty = PeerJS public cloud (0.peerjs.com)
  peerPort: 443,
  peerPath: '/',
  peerSecure: true,
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  autoAcceptFiles: true,
  notifications: true,
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('contacts')) db.createObjectStore('contacts', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('messages')) {
        const m = db.createObjectStore('messages', { keyPath: 'id' });
        m.createIndex('byContact', ['contactId', 'ts']);
        m.createIndex('byContactStatus', ['contactId', 'status']);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    try { result = fn(s); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result && typeof result === 'object' && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class Store {
  async init() {
    this.db = await openDb();
  }

  // ---- identity & settings (localStorage) ----
  getIdentity() {
    try {
      const raw = localStorage.getItem('pigeon.identity');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
  saveIdentity(identity) { localStorage.setItem('pigeon.identity', JSON.stringify(identity)); }
  createIdentity(name = '') {
    const identity = { id: genPeerId(8), name, createdAt: Date.now() };
    this.saveIdentity(identity);
    return identity;
  }
  getSettings() {
    try {
      const raw = localStorage.getItem('pigeon.settings');
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }
  saveSettings(s) { localStorage.setItem('pigeon.settings', JSON.stringify(s)); }
  getBlocked() {
    try { return JSON.parse(localStorage.getItem('pigeon.blocked') || '[]'); } catch { return []; }
  }
  saveBlocked(list) { localStorage.setItem('pigeon.blocked', JSON.stringify(list)); }

  // ---- contacts ----
  async getContacts() {
    const all = await tx(this.db, 'contacts', 'readonly', (s) => s.getAll());
    return all.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  }
  async putContact(c) { await tx(this.db, 'contacts', 'readwrite', (s) => s.put(c)); return c; }
  async deleteContact(id) {
    await tx(this.db, 'contacts', 'readwrite', (s) => s.delete(id));
    await this.deleteMessagesFor(id);
  }

  // ---- messages ----
  async getMessages(contactId, limit = 500) {
    const range = IDBKeyRange.bound([contactId, 0], [contactId, Number.MAX_SAFE_INTEGER]);
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('messages', 'readonly');
      const idx = t.objectStore('messages').index('byContact');
      const out = [];
      const req = idx.openCursor(range, 'prev');
      req.onsuccess = () => {
        const cur = req.result;
        if (cur && out.length < limit) { out.push(cur.value); cur.continue(); }
        else resolve(out.reverse());
      };
      req.onerror = () => reject(req.error);
    });
  }
  async putMessage(m) { await tx(this.db, 'messages', 'readwrite', (s) => s.put(m)); return m; }
  async getMessage(id) { return tx(this.db, 'messages', 'readonly', (s) => s.get(id)); }
  async getPending(contactId) {
    const range = IDBKeyRange.only([contactId, 'pending']);
    const t = this.db.transaction('messages', 'readonly');
    const all = await reqToPromise(t.objectStore('messages').index('byContactStatus').getAll(range));
    return all.sort((a, b) => a.ts - b.ts);
  }
  async deleteMessagesFor(contactId) {
    const range = IDBKeyRange.bound([contactId, 0], [contactId, Number.MAX_SAFE_INTEGER]);
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('messages', 'readwrite');
      const req = t.objectStore('messages').index('byContact').openCursor(range);
      req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } };
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
}
