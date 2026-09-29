// Peer-to-peer networking: signalling via a PeerJS server, data over WebRTC data channels.
// Every message and every file byte travels directly between the two devices (DTLS encrypted).
import { Peer } from 'peerjs';
import { uid } from './util.js';

const PROTO = 1;
const CHUNK = 64 * 1024;          // one data-channel message
const READ = 512 * 1024;          // one read from the file source
const HIGH_WATER = 2 * 1024 * 1024;
const LOW_WATER = 512 * 1024;
const CONNECT_TIMEOUT = 25000;
const ACCEPT_TIMEOUT = 90000;
const POLL_INTERVAL = 15000;
const HB_INTERVAL = 8000;      // ping cadence
const HB_TIMEOUT = 30000;      // drop the link if nothing was heard for this long
const ICE_GRACE = 10000;
const CALL_RING_TIMEOUT = 45000;       // time an ICE 'disconnected' state may last before we give up

function waitBufferLow(dc) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; dc.removeEventListener('bufferedamountlow', finish); clearInterval(iv); resolve(); };
    dc.addEventListener('bufferedamountlow', finish);
    const iv = setInterval(() => { if (dc.bufferedAmount <= LOW_WATER || dc.readyState !== 'open') finish(); }, 100);
  });
}

export class Network extends EventTarget {
  constructor({ identity, settings, platform, getContactIds, isTrusted, isBlocked }) {
    super();
    this.identity = identity;
    this.settings = settings;
    this.platform = platform;
    this.getContactIds = getContactIds;
    this.isTrusted = isTrusted;
    this.isBlocked = isBlocked;
    this.links = new Map();       // peerId -> link
    this.transfers = new Map();   // transferId -> transfer
    this.status = 'connecting';
    this._reconnectDelay = 1000;
    this._destroyed = false;
  }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  start() {
    this._createPeer();
    this._pollTimer = setInterval(() => this._pollContacts(), POLL_INTERVAL);
    window.addEventListener('online', () => setTimeout(() => this._ensurePeer(), 500));
  }

  destroy() {
    this._destroyed = true;
    if (this.call) this.hangUp();
    clearInterval(this._pollTimer);
    clearTimeout(this._reconnectTimer);
    try { this.peer?.destroy(); } catch {}
  }

  _peerOptions() {
    const s = this.settings;
    const opts = { debug: 1, pingInterval: 5000, config: { iceServers: s.iceServers || [], iceCandidatePoolSize: 2 } };
    if (s.peerHost) {
      opts.host = s.peerHost;
      opts.port = Number(s.peerPort) || 443;
      opts.path = s.peerPath || '/';
      opts.secure = s.peerSecure !== false;
    }
    return opts;
  }

  _createPeer() {
    if (this._destroyed) return;
    this.status = 'connecting';
    this.emit('status', this.status);
    const peer = new Peer(this.identity.id, this._peerOptions());
    this.peer = peer;
    peer.on('open', () => {
      this._reconnectDelay = 1000;
      this.status = 'online';
      this.emit('status', this.status);
      this._pollContacts();
    });
    peer.on('connection', (conn) => this._attach(conn, false));
    peer.on('call', (mc) => this._onIncomingCall(mc));
    peer.on('disconnected', () => {
      if (peer !== this.peer) return;
      this.status = 'offline';
      this.emit('status', this.status);
      this._scheduleReconnect();
    });
    peer.on('close', () => {
      if (peer !== this.peer) return;
      this.status = 'offline';
      this.emit('status', this.status);
      this._scheduleReconnect();
    });
    peer.on('error', (err) => {
      if (peer !== this.peer) return;
      const type = err?.type || 'unknown';
      if (type === 'peer-unavailable') {
        const m = /peer\s+(\S+)/i.exec(err.message || '');
        if (m) this._dropLink(m[1], 'unavailable');
        return;
      }
      if (type === 'unavailable-id') {
        this.status = 'error';
        this.emit('status', this.status);
        this.emit('id-taken');
        return;
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(type)) {
        this.status = 'offline';
        this.emit('status', this.status);
        this._scheduleReconnect();
        return;
      }
      this.emit('error', { type, message: err.message });
    });
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectTimer) return;
    const delay = this._reconnectDelay;
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, 30000);
    this._reconnectTimer = setTimeout(() => { this._reconnectTimer = null; this._ensurePeer(); }, delay);
  }

  _ensurePeer() {
    if (this._destroyed || this.status === 'error') return;
    const p = this.peer;
    if (!p || p.destroyed) { this._createPeer(); return; }
    if (p.disconnected) {
      try { p.reconnect(); } catch { try { p.destroy(); } catch {} this._createPeer(); }
    }
  }

  // Called by the app after the identity/settings changed (new ID or server).
  restart() {
    for (const [id] of this.links) this._dropLink(id, 'restart');
    try { this.peer?.destroy(); } catch {}
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this.status = 'connecting';
    this._createPeer();
  }

  get online() { return this.status === 'online'; }

  isPeerOnline(peerId) { return !!this.links.get(peerId)?.open; }

  peerName(peerId) { return this.links.get(peerId)?.name || ''; }

  // ---------------- connection management ----------------

  _pollContacts() {
    if (!this.peer || this.peer.disconnected || this.peer.destroyed || this.status !== 'online') return;
    for (const id of this.getContactIds()) {
      const l = this.links.get(id);
      if (!l) this.connect(id);
    }
  }

  connect(peerId) {
    if (peerId === this.identity.id) return null;
    if (!this.peer || this.peer.disconnected || this.peer.destroyed) return null;
    const existing = this.links.get(peerId);
    if (existing) return existing;
    let conn;
    try {
      conn = this.peer.connect(peerId, {
        reliable: true,
        serialization: 'raw',
        metadata: { name: this.identity.name, proto: PROTO },
      });
    } catch (e) {
      return null;
    }
    return this._attach(conn, true);
  }

  _attach(conn, outgoing) {
    const peerId = conn.peer;
    if (this.isBlocked(peerId)) { try { conn.close(); } catch {} return null; }
    const link = {
      id: peerId, conn, outgoing, open: false, name: conn.metadata?.name || '',
      outQ: [], pumping: false, inc: null, incQ: Promise.resolve(), superseded: false,
    };
    link.timer = setTimeout(() => { if (!link.open) this._closeLink(link, 'timeout'); }, CONNECT_TIMEOUT);

    if (outgoing) {
      this.links.set(peerId, link);
    }

    conn.on('open', () => {
      clearTimeout(link.timer);
      link.open = true;
      const current = this.links.get(peerId);
      if (current && current !== link) {
        if (current.open) {
          // Both sides connected to each other at once. Keep the one initiated by the smaller ID.
          const keepOutgoing = this.identity.id < peerId;
          const keep = keepOutgoing ? (link.outgoing ? link : current) : (link.outgoing ? current : link);
          const drop = keep === link ? current : link;
          drop.superseded = true;
          this.links.set(peerId, keep);
          try { drop.conn.close(); } catch {}
          if (keep !== link) return; // this connection lost the tie-break
        } else {
          current.superseded = true;
          try { current.conn.close(); } catch {}
          this.links.set(peerId, link);
        }
      } else if (!current) {
        this.links.set(peerId, link);
      }
      link.lastSeen = Date.now();
      link.hb = setInterval(() => {
        if (!link.open) return;
        if (Date.now() - link.lastSeen > HB_TIMEOUT) { this._closeLink(link, 'heartbeat-timeout'); return; }
        this._sendJson(link.conn, { t: 'ping' });
      }, HB_INTERVAL);
      this._sendJson(link.conn, { t: 'hello', name: this.identity.name, proto: PROTO });
      if (!this.isTrusted(peerId)) {
        this.emit('request', { peerId, name: link.name });
      }
      this.emit('presence', { peerId, online: true, name: link.name });
      this.emit('open', { peerId });
    });
    conn.on('data', (data) => this._onData(link, data));
    conn.on('close', () => this._onClosed(link, 'closed'));
    conn.on('error', (err) => this._onClosed(link, err?.message || 'error'));
    conn.on('iceStateChanged', (state) => {
      link.iceState = state;
      if (state === 'failed' || state === 'closed') { this._closeLink(link, 'ice-' + state); return; }
      if (state === 'disconnected') {
        clearTimeout(link.iceTimer);
        link.iceTimer = setTimeout(() => { if (link.iceState === 'disconnected') this._closeLink(link, 'ice-disconnected'); }, ICE_GRACE);
      } else if (state === 'connected' || state === 'completed') {
        clearTimeout(link.iceTimer);
      }
    });
    return link;
  }

  _onClosed(link, reason) {
    clearTimeout(link.timer);
    clearTimeout(link.iceTimer);
    clearInterval(link.hb);
    if (link.superseded) return;
    const wasOpen = link.open;
    link.open = false;
    if (this.links.get(link.id) === link) this.links.delete(link.id);
    this._failTransfersFor(link, 'Connection lost');
    if (wasOpen) this.emit('presence', { peerId: link.id, online: false });
  }

  _closeLink(link, reason) {
    link.superseded = false;
    try { link.conn.close(); } catch {}
    this._onClosed(link, reason);
  }

  _dropLink(peerId, reason) {
    const link = this.links.get(peerId);
    if (link) this._closeLink(link, reason);
  }

  disconnectPeer(peerId) { this._dropLink(peerId, 'user'); }

  // Deliver messages that arrived before the user accepted this peer's chat request.
  releaseHeld(peerId) {
    const link = this.links.get(peerId);
    if (!link?.held?.length) return;
    const held = link.held;
    link.held = [];
    for (const m of held) {
      this.emit('message', { peerId, id: m.id, text: m.text, ts: m.ts || Date.now() });
      if (link.open) this._sendJson(link.conn, { t: 'ack', id: m.id });
    }
  }

  _sendJson(conn, obj) {
    try { conn.send(JSON.stringify(obj)); return true; } catch { return false; }
  }

  // ---------------- messages ----------------

  sendText(peerId, msg) {
    const link = this.links.get(peerId);
    if (!link?.open) return false;
    return this._sendJson(link.conn, { t: 'msg', id: msg.id, text: msg.text, ts: msg.ts });
  }

  sendTyping(peerId) {
    const link = this.links.get(peerId);
    if (link?.open) this._sendJson(link.conn, { t: 'typing' });
  }

  _onData(link, data) {
    link.lastSeen = Date.now();
    if (typeof data === 'string') {
      let m;
      try { m = JSON.parse(data); } catch { return; }
      this._onControl(link, m);
      return;
    }
    if (!link.inc) return;
    const buf = data instanceof ArrayBuffer ? data : (ArrayBuffer.isView(data) ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : null);
    if (!buf) return;
    const t = link.inc;
    link.incQ = link.incQ.then(() => this._onChunk(link, t, buf)).catch((e) => this._incomingFailed(link, t, e));
  }

  _onControl(link, m) {
    const peerId = link.id;
    switch (m.t) {
      case 'hello':
        link.name = m.name || link.name;
        this.emit('hello', { peerId, name: link.name });
        break;
      case 'msg':
        if (!this.isTrusted(peerId)) {
          // Hold messages from a peer whose chat request is still pending; released on accept.
          link.held = (link.held || []).slice(-99);
          link.held.push(m);
          return;
        }
        this.emit('message', { peerId, id: m.id, text: m.text, ts: m.ts || Date.now() });
        this._sendJson(link.conn, { t: 'ack', id: m.id });
        break;
      case 'ack':
        this.emit('ack', { peerId, id: m.id });
        break;
      case 'typing':
        this.emit('typing', { peerId });
        break;
      case 'ping':
        this._sendJson(link.conn, { t: 'pong' });
        break;
      case 'call-decline':
        if (this.call && this.call.peerId === peerId && this.call.id === m.id) this._finishCall('declined');
        break;
      case 'call-busy':
        if (this.call && this.call.peerId === peerId && this.call.id === m.id) this._finishCall('busy');
        break;
      case 'call-end':
        if (this.call && this.call.peerId === peerId && this.call.id === m.id) this._finishCall('remote-hangup');
        break;
      case 'pong':
        break;
      case 'offer':
        this._onOffer(link, m);
        break;
      case 'accept': {
        const t = this.transfers.get(m.id);
        if (t && t.dir === 'out' && t._resolveAccept) t._resolveAccept(true);
        break;
      }
      case 'reject': {
        const t = this.transfers.get(m.id);
        if (t && t.dir === 'out') { t.error = m.reason || 'Declined'; t._resolveAccept?.(false); }
        break;
      }
      case 'fstart': {
        const t = this.transfers.get(m.id);
        if (!t || t.dir !== 'in' || link.inc !== t) return;
        link.incQ = link.incQ.then(() => this._incFileStart(link, t, m.idx)).catch((e) => this._incomingFailed(link, t, e));
        break;
      }
      case 'fend': {
        const t = this.transfers.get(m.id);
        if (!t || t.dir !== 'in' || link.inc !== t) return;
        link.incQ = link.incQ.then(() => this._incFileEnd(link, t, m.idx)).catch((e) => this._incomingFailed(link, t, e));
        break;
      }
      case 'done': {
        const t = this.transfers.get(m.id);
        if (!t || t.dir !== 'in' || link.inc !== t) return;
        link.incQ = link.incQ.then(() => this._incDone(link, t)).catch((e) => this._incomingFailed(link, t, e));
        break;
      }
      case 'complete': {
        const t = this.transfers.get(m.id);
        if (t && t.dir === 'out' && t.status === 'done') { t.status = 'delivered'; this._progress(t, true); }
        break;
      }
      case 'cancel': {
        const t = this.transfers.get(m.id);
        if (!t) return;
        if (t.dir === 'out') {
          if (t.status === 'offered') t._resolveAccept?.(false);
          t.status = 'cancelled'; t.error = m.reason || 'Cancelled by receiver'; this._progress(t, true);
        } else {
          link.incQ = link.incQ.then(() => this._incomingFailed(link, t, new Error(m.reason || 'Cancelled by sender'), 'cancelled'));
        }
        break;
      }
      default:
        break;
    }
  }

  // ---------------- outgoing transfers ----------------

  // items: [{ path, size, type, source: { read(offset, len) -> Promise<ArrayBuffer> } }]
  sendFiles(peerId, { kind = 'files', name = '', items }) {
    const link = this.links.get(peerId);
    if (!link?.open) return null;
    const total = items.reduce((a, f) => a + f.size, 0);
    const t = {
      id: uid(), peerId, dir: 'out', kind, name, items,
      files: items.map((f) => ({ path: f.path, size: f.size, type: f.type || '' })),
      total, done: 0, fileIdx: -1, status: 'queued', error: '', results: [], ts: Date.now(),
    };
    this.transfers.set(t.id, t);
    link.outQ.push(t);
    this._progress(t, true);
    this._pumpOut(link);
    return t;
  }

  cancelTransfer(id, reason = 'Cancelled') {
    const t = this.transfers.get(id);
    if (!t) return;
    const link = this.links.get(t.peerId);
    if (t.dir === 'out') {
      if (['queued', 'offered', 'active'].includes(t.status)) {
        t.status = 'cancelled'; t.error = reason;
        t._resolveAccept?.(false);
        if (link?.open) this._sendJson(link.conn, { t: 'cancel', id, reason });
        this._progress(t, true);
      }
    } else if (['offered', 'active'].includes(t.status)) {
      if (link?.open) this._sendJson(link.conn, { t: 'cancel', id, reason });
      if (link) link.incQ = link.incQ.then(() => this._incomingFailed(link, t, new Error(reason), 'cancelled'));
    }
  }

  async _pumpOut(link) {
    if (link.pumping) return;
    link.pumping = true;
    try {
      while (link.outQ.length) {
        const t = link.outQ.shift();
        if (t.status !== 'queued') continue;
        if (!link.open) { t.status = 'failed'; t.error = 'Contact went offline'; this._progress(t, true); continue; }
        await this._runOut(link, t);
      }
    } finally {
      link.pumping = false;
    }
  }

  async _runOut(link, t) {
    const conn = link.conn;
    t.status = 'offered';
    this._progress(t, true);
    this._sendJson(conn, { t: 'offer', id: t.id, kind: t.kind, name: t.name, files: t.files, total: t.total });
    const accepted = await new Promise((resolve) => {
      t._resolveAccept = resolve;
      t._acceptTimer = setTimeout(() => resolve(false), ACCEPT_TIMEOUT);
    });
    clearTimeout(t._acceptTimer);
    t._resolveAccept = null;
    if (!accepted) {
      if (t.status !== 'cancelled') { t.status = 'failed'; t.error = t.error || 'Not accepted'; }
      this._progress(t, true);
      return;
    }
    t.status = 'active';
    t.startedAt = Date.now();
    this._progress(t, true);
    const dc = conn.dataChannel;
    try {
      if (dc) dc.bufferedAmountLowThreshold = LOW_WATER;
      const maxMsg = conn.peerConnection?.sctp?.maxMessageSize;
      const chunk = maxMsg && maxMsg > 0 ? Math.min(CHUNK, maxMsg) : CHUNK;
      for (let i = 0; i < t.items.length; i++) {
        if (t.status !== 'active') break;
        const f = t.items[i];
        t.fileIdx = i;
        this._sendJson(conn, { t: 'fstart', id: t.id, idx: i });
        let off = 0;
        while (off < f.size) {
          if (t.status !== 'active') break;
          if (!link.open || !dc || dc.readyState !== 'open') throw new Error('Connection lost');
          const want = Math.min(READ, f.size - off);
          const buf = await f.source.read(off, want);
          if (!buf || buf.byteLength === 0) throw new Error(`Could not read ${f.path}`);
          for (let p = 0; p < buf.byteLength; p += chunk) {
            if (t.status !== 'active') break;
            if (dc.bufferedAmount > HIGH_WATER) await waitBufferLow(dc);
            if (!link.open || dc.readyState !== 'open') throw new Error('Connection lost');
            const piece = buf.slice(p, Math.min(p + chunk, buf.byteLength));
            conn.send(piece);
            t.done += piece.byteLength;
            this._progress(t);
          }
          off += buf.byteLength;
        }
        if (t.status !== 'active') break;
        this._sendJson(conn, { t: 'fend', id: t.id, idx: i });
      }
      if (t.status === 'active') {
        this._sendJson(conn, { t: 'done', id: t.id });
        t.status = 'done';
      }
    } catch (e) {
      if (t.status === 'active') { t.status = 'failed'; t.error = e.message || String(e); }
      if (link.open) this._sendJson(conn, { t: 'cancel', id: t.id, reason: t.error });
    }
    t.finishedAt = Date.now();
    this._progress(t, true);
  }

  // ---------------- incoming transfers ----------------

  _onOffer(link, m) {
    const peerId = link.id;
    if (!this.isTrusted(peerId)) { this._sendJson(link.conn, { t: 'reject', id: m.id, reason: 'Not a contact' }); return; }
    if (link.inc) { this._sendJson(link.conn, { t: 'reject', id: m.id, reason: 'Busy with another transfer' }); return; }
    const files = Array.isArray(m.files) ? m.files.map((f) => ({ path: String(f.path || 'file'), size: Number(f.size) || 0, type: String(f.type || '') })) : [];
    if (!files.length) { this._sendJson(link.conn, { t: 'reject', id: m.id, reason: 'Empty' }); return; }
    const t = {
      id: String(m.id), peerId, dir: 'in', kind: m.kind === 'folder' ? 'folder' : 'files', name: String(m.name || ''),
      files, total: files.reduce((a, f) => a + f.size, 0), done: 0, fileIdx: -1, status: 'offered', error: '', results: [], ts: Date.now(),
      contactName: link.name,
    };
    this.transfers.set(t.id, t);
    link.inc = t;
    this._progress(t, true);
    if (this.settings.autoAcceptFiles !== false) this.acceptTransfer(t.id);
    else this.emit('offer', { transfer: t });
  }

  acceptTransfer(id) {
    const t = this.transfers.get(id);
    const link = this.links.get(t?.peerId);
    if (!t || t.dir !== 'in' || t.status !== 'offered' || !link?.open) return;
    t.status = 'active';
    t.startedAt = Date.now();
    this._sendJson(link.conn, { t: 'accept', id });
    this._progress(t, true);
  }

  rejectTransfer(id, reason = 'Declined') {
    const t = this.transfers.get(id);
    const link = this.links.get(t?.peerId);
    if (!t || t.dir !== 'in') return;
    if (link?.open) this._sendJson(link.conn, { t: 'reject', id, reason });
    if (link?.inc === t) link.inc = null;
    t.status = 'cancelled'; t.error = reason;
    this._progress(t, true);
  }

  async _incFileStart(link, t, idx) {
    if (t.status !== 'active') return;
    const f = t.files[idx];
    if (!f) throw new Error('Bad file index');
    t.fileIdx = idx;
    t.fileDone = 0;
    t.handle = await this.platform.saveBegin({
      transferId: t.id, contactId: t.peerId, contactName: this.peerName(t.peerId) || t.contactName || t.peerId,
      relPath: f.path, size: f.size, type: f.type, kind: t.kind, folderName: t.name,
    });
  }

  async _onChunk(link, t, buf) {
    if (t.status !== 'active' || !t.handle) return;
    await this.platform.saveChunk(t.handle, new Uint8Array(buf));
    t.done += buf.byteLength;
    t.fileDone += buf.byteLength;
    this._progress(t);
  }

  async _incFileEnd(link, t, idx) {
    if (t.status !== 'active' || !t.handle) return;
    const res = await this.platform.saveEnd(t.handle);
    t.handle = null;
    t.results[idx] = res; // { path, url }
  }

  async _incDone(link, t) {
    if (t.status !== 'active') return;
    t.status = 'done';
    t.finishedAt = Date.now();
    if (link.inc === t) link.inc = null;
    this._sendJson(link.conn, { t: 'complete', id: t.id });
    this._progress(t, true);
  }

  async _incomingFailed(link, t, err, status = 'failed') {
    if (!['offered', 'active'].includes(t.status)) return;
    t.status = status;
    t.error = err?.message || String(err);
    t.finishedAt = Date.now();
    if (t.handle) { try { await this.platform.saveAbort(t.handle); } catch {} t.handle = null; }
    if (link.inc === t) link.inc = null;
    if (status === 'failed' && link.open) this._sendJson(link.conn, { t: 'cancel', id: t.id, reason: t.error });
    this._progress(t, true);
  }

  _failTransfersFor(link, reason) {
    if (this.call && this.call.peerId === link.id && this.call.status !== 'connected') this._finishCall('connection-lost');
    for (const t of this.transfers.values()) {
      if (t.peerId !== link.id) continue;
      if (t.dir === 'out' && ['queued', 'offered', 'active'].includes(t.status)) {
        t.status = 'failed'; t.error = reason; t._resolveAccept?.(false); this._progress(t, true);
      } else if (t.dir === 'in' && ['offered', 'active'].includes(t.status)) {
        link.incQ = link.incQ.then(() => this._incomingFailed(link, t, new Error(reason)));
      }
    }
    link.outQ = [];
  }

  // ---------------- voice / video calls ----------------
  // this.call = { id, peerId, dir, video, mc, local, remote, status: 'ringing'|'connecting'|'connected', ts, startedAt }

  async startCall(peerId, { video = false } = {}) {
    if (this.call) throw new Error('Already in a call');
    const link = this.links.get(peerId);
    if (!link?.open) throw new Error('Contact is offline');
    const local = await this._getMedia(video);
    const id = uid();
    const call = { id, peerId, dir: 'out', video, mc: null, local, remote: null, status: 'ringing', ts: Date.now(), startedAt: 0 };
    this.call = call;
    let mc;
    try {
      mc = this.peer.call(peerId, local, { metadata: { callId: id, video } });
    } catch (e) {
      this._finishCall('error', e.message);
      throw e;
    }
    call.mc = mc;
    this._wireCall(call);
    call.ringTimer = setTimeout(() => { if (this.call === call && call.status === 'ringing') this._finishCall('no-answer'); }, CALL_RING_TIMEOUT);
    this.emit('call', { call });
    return call;
  }

  _onIncomingCall(mc) {
    const peerId = mc.peer;
    const meta = mc.metadata || {};
    const id = String(meta.callId || uid());
    const link = this.links.get(peerId);
    if (!this.isTrusted(peerId) || !link?.open) { try { mc.close(); } catch {} return; }
    if (this.call) {
      this._sendJson(link.conn, { t: 'call-busy', id });
      try { mc.close(); } catch {}
      this.emit('call-log', { peerId, dir: 'in', video: !!meta.video, outcome: 'missed', duration: 0 });
      return;
    }
    const call = { id, peerId, dir: 'in', video: !!meta.video, mc, local: null, remote: null, status: 'ringing', ts: Date.now(), startedAt: 0 };
    this.call = call;
    this._wireCall(call);
    call.ringTimer = setTimeout(() => { if (this.call === call && call.status === 'ringing') this._finishCall('missed'); }, CALL_RING_TIMEOUT);
    this.emit('call', { call });
  }

  async acceptCall({ video } = {}) {
    const call = this.call;
    if (!call || call.dir !== 'in' || call.status !== 'ringing') return;
    const withVideo = video === undefined ? call.video : !!video;
    let local;
    try { local = await this._getMedia(withVideo); }
    catch (e) { this._finishCall('error', 'Microphone/camera unavailable'); throw e; }
    if (this.call !== call) { local.getTracks().forEach((t) => t.stop()); return; }
    call.local = local;
    call.video = withVideo || call.video;
    call.status = 'connecting';
    clearTimeout(call.ringTimer);
    call.mc.answer(local);
    this.emit('call', { call });
  }

  declineCall() {
    const call = this.call;
    if (!call) return;
    const link = this.links.get(call.peerId);
    if (link?.open) this._sendJson(link.conn, { t: 'call-decline', id: call.id });
    this._finishCall(call.dir === 'in' ? 'declined-local' : 'cancelled');
  }

  hangUp() {
    const call = this.call;
    if (!call) return;
    const link = this.links.get(call.peerId);
    if (link?.open) this._sendJson(link.conn, { t: 'call-end', id: call.id });
    this._finishCall(call.status === 'connected' ? 'hangup' : 'cancelled');
  }

  toggleMute() {
    const t = this.call?.local?.getAudioTracks() || [];
    if (!t.length) return false;
    const muted = t[0].enabled;
    t.forEach((x) => { x.enabled = !muted; });
    this.emit('call', { call: this.call });
    return muted; // returns new muted state
  }

  toggleCamera() {
    const t = this.call?.local?.getVideoTracks() || [];
    if (!t.length) return false;
    const off = t[0].enabled;
    t.forEach((x) => { x.enabled = !off; });
    this.emit('call', { call: this.call });
    return off;
  }

  async switchCamera() {
    const call = this.call;
    const cur = call?.local?.getVideoTracks()[0];
    if (!call || !cur) return;
    const facing = cur.getSettings().facingMode === 'environment' ? 'user' : 'environment';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } } });
    const next = stream.getVideoTracks()[0];
    const sender = call.mc.peerConnection?.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(next);
    call.local.removeTrack(cur); cur.stop();
    call.local.addTrack(next);
    this.emit('call', { call });
  }

  async _getMedia(video) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Media devices not available');
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: video ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    };
    try { return await navigator.mediaDevices.getUserMedia(constraints); }
    catch (e) {
      if (video) return navigator.mediaDevices.getUserMedia({ audio: constraints.audio }); // no camera: fall back to voice
      throw e;
    }
  }

  _wireCall(call) {
    const mc = call.mc;
    mc.on('stream', (remote) => {
      if (this.call !== call || call.remote) return;
      call.remote = remote;
      call.status = 'connected';
      call.startedAt = Date.now();
      clearTimeout(call.ringTimer);
      this.emit('call', { call });
    });
    mc.on('close', () => { if (this.call === call) this._finishCall(call.status === 'connected' ? 'remote-hangup' : 'closed'); });
    mc.on('error', (e) => { if (this.call === call) this._finishCall('error', e?.message); });
    mc.on('iceStateChanged', (state) => {
      if (this.call !== call) return;
      if (state === 'failed' || state === 'closed') this._finishCall('connection-lost');
    });
  }

  _finishCall(reason, error = '') {
    const call = this.call;
    if (!call) return;
    this.call = null;
    clearTimeout(call.ringTimer);
    try { call.mc?.close(); } catch {}
    call.local?.getTracks().forEach((t) => t.stop());
    const duration = call.startedAt ? Math.round((Date.now() - call.startedAt) / 1000) : 0;
    let outcome;
    if (call.startedAt) outcome = 'completed';
    else if (call.dir === 'in') outcome = reason === 'declined-local' ? 'declined' : 'missed';
    else outcome = reason === 'declined' ? 'declined' : reason === 'busy' ? 'busy' : reason === 'cancelled' ? 'cancelled' : reason === 'no-answer' ? 'no-answer' : 'failed';
    this.emit('call-ended', { call, reason, error, duration, outcome });
    this.emit('call-log', { peerId: call.peerId, dir: call.dir, video: call.video, outcome, duration, error });
  }

  _progress(t, force = false) {
    const now = Date.now();
    if (!force && t._lastEmit && now - t._lastEmit < 120) return;
    t._lastEmit = now;
    this.emit('transfer', { transfer: t });
  }
}
