// Pigeon - UI layer. Talks to Network (P2P) + Store (local persistence) + platform adapter.
import { Store } from './store.js';
import { Network } from './net.js';
import { createPlatform } from './platform/index.js';
import { itemsFromDataTransfer, blobSource } from './platform/common.js';
import { uid, esc, fmtBytes, fmtTime, fmtDuration, mimeKind, fileIcon, normalizeId, isNarrow, makeThumbnail, guessMime } from './util.js';

const state = {
  identity: null, settings: null, blocked: [],
  contacts: new Map(), activeId: null, messages: [],
  presence: new Map(), peerNames: new Map(), typing: new Map(),
  transferMsg: new Map(), // transferId -> message
  netStatus: 'connecting', rec: null, modal: null, dragDepth: 0,
};
let store, net, platform;
const $app = document.getElementById('app');
const $ = (sel, el = document) => el.querySelector(sel);
const blobUrls = new Map();

// ------------------------------------------------------------------ boot
async function main() {
  platform = createPlatform();
  document.body.dataset.platform = platform.name;
  store = new Store();
  await store.init();
  state.settings = store.getSettings();
  state.identity = store.getIdentity() || store.createIdentity('');
  state.blocked = store.getBlocked();
  for (const c of await store.getContacts()) state.contacts.set(c.id, c);
  try { await platform.init?.({ onBack: handleBack }); } catch (e) { console.warn('platform init', e); }
  renderShell();
  startNetwork();
  setupGlobalHandlers();
  if (!state.identity.name) showNameDialog(true);
  platform.keepAlive?.(true);
}

function startNetwork() {
  net = new Network({
    identity: state.identity,
    settings: state.settings,
    platform,
    getContactIds: () => Array.from(state.contacts.keys()),
    isTrusted: (id) => state.contacts.has(id),
    isBlocked: (id) => state.blocked.includes(id),
  });
  net.addEventListener('status', (e) => { state.netStatus = e.detail; renderStatus(); });
  net.addEventListener('presence', (e) => onPresence(e.detail));
  net.addEventListener('open', (e) => flushPending(e.detail.peerId));
  net.addEventListener('hello', (e) => onHello(e.detail));
  net.addEventListener('request', (e) => onRequest(e.detail));
  net.addEventListener('message', (e) => onIncomingText(e.detail));
  net.addEventListener('ack', (e) => onAck(e.detail));
  net.addEventListener('typing', (e) => onTyping(e.detail));
  net.addEventListener('transfer', (e) => onTransfer(e.detail.transfer));
  net.addEventListener('offer', (e) => onOffer(e.detail.transfer));
  net.addEventListener('call', (e) => onCallUpdate(e.detail.call));
  net.addEventListener('call-ended', (e) => onCallEnded(e.detail));
  net.addEventListener('call-log', (e) => onCallLog(e.detail));
  net.addEventListener('id-taken', () => showIdTakenDialog());
  net.addEventListener('error', (e) => toast(`Network error: ${e.detail.message || e.detail.type}`, 'error'));
  net.start();
}

// ------------------------------------------------------------------ helpers
function contactName(id) {
  const c = state.contacts.get(id);
  return (c && (c.name || c.peerName)) || state.peerNames.get(id) || id;
}
function activeContact() { return state.contacts.get(state.activeId); }
function isOnline(id) { return !!state.presence.get(id); }

async function saveContact(c) { state.contacts.set(c.id, c); await store.putContact(c); }

function toast(msg, type = 'info', ms = 3500) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('.toasts').appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

function showModal(html, { onMount, dismissible = true } = {}) {
  closeModal();
  const root = $('.modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog">${html}</div></div>`;
  root.classList.add('open');
  state.modal = { dismissible };
  if (dismissible) root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  onMount?.(root.querySelector('.modal'));
  return root.querySelector('.modal');
}
function closeModal() {
  const root = $('.modal-root');
  root.innerHTML = '';
  root.classList.remove('open');
  state.modal = null;
}

function handleBack() {
  if (state.modal) { if (state.modal.dismissible) closeModal(); return true; }
  if (net?.call && net.call.status === 'ringing' && net.call.dir === 'in') { net.declineCall(); return true; }
  if (state.rec) { stopRecording(false); return true; }
  if (state.activeId && isNarrow()) { selectContact(null); return true; }
  return false;
}

function blobUrl(key, blob) {
  if (!blobUrls.has(key)) blobUrls.set(key, URL.createObjectURL(blob));
  return blobUrls.get(key);
}

function linkify(escaped) {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

// ------------------------------------------------------------------ rendering
function renderShell() {
  $app.innerHTML = `
    <aside class="sidebar">
      <header class="side-head">
        <div class="brand"><span class="logo">🕊️</span><h1>Pigeon</h1></div>
        <div class="head-actions">
          <span class="status-dot" title="Connecting…"></span>
          <button class="icon-btn" data-action="settings" title="Settings">⚙️</button>
        </div>
      </header>
      <section class="me-card">
        <div class="label">Your ID <span class="me-name"></span></div>
        <div class="myid-row"><code class="myid"></code><button class="btn small" data-action="copy-id" title="Copy your ID">Copy</button>${typeof navigator.share === 'function' ? '<button class="btn small ghost" data-action="share-id">Share</button>' : ''}</div>
        <div class="hint">Give this ID to the person you want to chat with. They add it on their side, you add theirs, and you're connected.</div>
      </section>
      <form class="add-form" data-form="add">
        <input name="id" placeholder="Friend's ID (e.g. K7PQ2MWX)" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16">
        <button class="btn" type="submit">Add</button>
      </form>
      <ul class="contacts"></ul>
      <footer class="side-foot"><span class="net-text"></span></footer>
    </aside>
    <main class="chat"></main>
    <div class="call-root"></div>
    <div class="modal-root"></div>
    <div class="toasts"></div>`;
  renderMe();
  renderStatus();
  renderContacts();
  renderChat();
}

function renderMe() {
  $('.myid').textContent = state.identity.id;
  $('.me-name').textContent = state.identity.name ? `· ${state.identity.name}` : '';
}

function renderStatus() {
  const dot = $('.status-dot');
  const txt = $('.net-text');
  const map = { online: ['online', 'Connected to signalling server'], connecting: ['connecting', 'Connecting…'], offline: ['offline', 'Offline – reconnecting…'], error: ['error', 'ID conflict'] };
  const [cls, label] = map[state.netStatus] || map.connecting;
  dot.className = `status-dot ${cls}`;
  dot.title = label;
  txt.textContent = label;
}

function renderContacts() {
  const ul = $('.contacts');
  const list = Array.from(state.contacts.values()).sort((a, b) => (b.lastTs || b.addedAt || 0) - (a.lastTs || a.addedAt || 0));
  if (!list.length) {
    ul.innerHTML = `<li class="empty">No contacts yet.<br>Add a friend's ID above to start.</li>`;
    return;
  }
  ul.innerHTML = list.map((c) => `
    <li class="contact ${c.id === state.activeId ? 'active' : ''}" data-action="select" data-id="${c.id}">
      <div class="avatar">${esc(contactName(c.id).slice(0, 1).toUpperCase())}<span class="presence ${isOnline(c.id) ? 'on' : ''}"></span></div>
      <div class="c-body">
        <div class="c-top"><span class="c-name">${esc(contactName(c.id))}</span>${c.lastTs ? `<span class="c-time">${fmtTime(c.lastTs)}</span>` : ''}</div>
        <div class="c-bottom"><span class="c-last">${esc(c.lastText || c.id)}</span>${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
      </div>
    </li>`).join('');
}

function renderChat() {
  const main = $('.chat');
  $app.classList.toggle('in-chat', !!state.activeId);
  const c = activeContact();
  if (!c) {
    main.innerHTML = `
      <div class="empty-chat">
        <div class="big">🕊️</div>
        <h2>Direct, private, serverless</h2>
        <p>Messages and files go straight from your device to your friend's device over an encrypted peer-to-peer link. Nothing is stored on any server.</p>
        <p class="muted">Both of you need to be online at the same time to exchange messages.</p>
      </div>`;
    return;
  }
  main.innerHTML = `
    <header class="chat-head">
      <button class="icon-btn back" data-action="back" title="Back">←</button>
      <div class="avatar sm">${esc(contactName(c.id).slice(0, 1).toUpperCase())}<span class="presence ${isOnline(c.id) ? 'on' : ''}"></span></div>
      <div class="chat-title">
        <div class="name">${esc(contactName(c.id))}</div>
        <div class="sub"><code>${c.id}</code> · <span class="pstate">${isOnline(c.id) ? 'online' : 'offline'}</span></div>
      </div>
      <div class="head-actions">
        <button class="icon-btn call-btn" data-action="call-audio" title="Voice call" ${isOnline(c.id) ? '' : 'disabled'}>📞</button>
        <button class="icon-btn call-btn" data-action="call-video" title="Video call" ${isOnline(c.id) ? '' : 'disabled'}>🎥</button>
        <button class="icon-btn" data-action="rename" title="Rename contact">✏️</button>
        <button class="icon-btn" data-action="delete-contact" title="Delete contact">🗑️</button>
      </div>
    </header>
    <div class="messages"></div>
    <div class="typing-line"></div>
    <div class="drop-overlay"><div>Drop files or folders to send</div></div>
    <footer class="composer">
      <button class="icon-btn" data-action="attach-file" title="Send files">📎</button>
      ${platform.supportsFolders ? '<button class="icon-btn" data-action="attach-folder" title="Send a folder">📁</button>' : ''}
      <textarea class="input" rows="1" placeholder="Message…"></textarea>
      <button class="icon-btn mic" data-action="mic" title="Record voice note">🎤</button>
      <button class="icon-btn send" data-action="send" title="Send">➤</button>
    </footer>
    <div class="rec-bar"><span class="rec-dot"></span><span class="rec-time">0:00</span><span class="rec-hint">Recording… tap ✔ to send</span><button class="btn small ghost" data-action="rec-cancel">✕</button><button class="btn small" data-action="rec-stop">✔</button></div>`;
  renderMessages();
  const ta = $('.composer .input');
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isNarrow()) { e.preventDefault(); sendCurrentText(); }
  });
  ta.addEventListener('input', () => { autoGrow(ta); sendTypingThrottled(); });
  if (!isNarrow()) ta.focus();
}

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
}

function renderMessages() {
  const box = $('.messages');
  if (!box) return;
  if (!state.messages.length) {
    box.innerHTML = `<div class="messages-empty">Say hello 👋<br><span class="muted">Text, photos, voice notes, files and whole folders are all sent directly to ${esc(contactName(state.activeId))}.</span></div>`;
    return;
  }
  let html = '';
  let lastDay = '';
  for (const m of state.messages) {
    const day = new Date(m.ts).toDateString();
    if (day !== lastDay) { html += `<div class="day-sep"><span>${esc(new Date(m.ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }))}</span></div>`; lastDay = day; }
    html += renderMessage(m);
  }
  box.innerHTML = html;
  scrollToBottom(true);
}

function scrollToBottom(force = false) {
  const box = $('.messages');
  if (!box) return;
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  if (force || nearBottom) box.scrollTop = box.scrollHeight;
}

function statusIcon(m) {
  if (m.dir !== 'out') return '';
  const map = { pending: ['🕓', 'Waiting for contact to come online'], sent: ['✓', 'Sent'], delivered: ['✓✓', 'Delivered'], done: ['✓', 'Sent'], failed: ['!', 'Failed'], cancelled: ['✕', 'Cancelled'], transferring: ['…', 'Sending'] };
  const [icon, title] = map[m.status] || ['', ''];
  return `<span class="st ${m.status}" title="${title}">${icon}</span>`;
}

function callLabel(m) {
  const dur = m.duration ? ` · ${fmtDuration(m.duration)}` : '';
  const kind = m.video ? 'video call' : 'call';
  if (m.outcome === 'completed') return `${m.dir === 'out' ? 'Outgoing' : 'Incoming'} ${kind}${dur}`;
  if (m.dir === 'in') return m.outcome === 'declined' ? `Declined ${kind}` : `Missed ${kind}`;
  return { declined: `${kind} declined`, busy: `${kind} · busy`, cancelled: `${kind} cancelled`, 'no-answer': `${kind} · no answer` }[m.outcome] || `${kind} failed`;
}

function renderMessage(m) {
  if (m.kind === 'call') {
    const missed = m.dir === 'in' && m.outcome !== 'completed';
    return `<div class="msg call ${m.dir}" data-mid="${m.id}"><div class="call-line ${missed ? 'missed' : ''}"><span>${m.video ? '🎥' : '📞'}</span> ${esc(callLabel(m))} <span class="time">${fmtTime(m.ts)}</span></div></div>`;
  }
  const out = m.dir === 'out';
  const t = m.transferId ? net.transfers.get(m.transferId) : null;
  const body = m.kind === 'text' ? `<div class="text">${linkify(esc(m.text))}</div>` : renderFileBody(m, t);
  return `<div class="msg ${out ? 'out' : 'in'} ${m.kind}" data-mid="${m.id}"><div class="bubble">${body}<div class="meta"><span class="time">${fmtTime(m.ts)}</span>${statusIcon(m)}</div></div></div>`;
}

function renderFileBody(m, t) {
  const live = t && ['queued', 'offered', 'active'].includes(t.status);
  const files = m.files || [];
  const out = m.dir === 'out';
  const totalLabel = fmtBytes(m.total || files.reduce((a, f) => a + f.size, 0));
  const kindLabel = m.kind === 'folder' ? `📁 ${esc(m.name || 'Folder')}` : m.kind === 'voice' ? '🎤 Voice note' : files.length > 1 ? `${files.length} files` : esc(files[0]?.path?.split('/').pop() || 'File');

  if (live || m.status === 'transferring') {
    const done = t ? t.done : 0;
    const total = t ? t.total : (m.total || 1);
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const elapsed = t?.startedAt ? (Date.now() - t.startedAt) / 1000 : 0;
    const speed = elapsed > 0.5 ? fmtBytes(done / elapsed) + '/s' : '';
    const stage = !t ? 'Waiting…' : t.status === 'queued' ? 'Queued…' : t.status === 'offered' ? (out ? 'Waiting for accept…' : 'Incoming…') : (out ? 'Sending' : 'Receiving');
    const cur = t && t.fileIdx >= 0 && files.length > 1 ? `<div class="cur-file">${esc(files[t.fileIdx]?.path || '')}</div>` : '';
    return `<div class="file-head">${kindLabel} <span class="muted">· ${totalLabel}</span></div>
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
      <div class="prog-line"><span>${stage} ${pct}%${speed ? ' · ' + speed : ''}</span><button class="link" data-action="cancel-transfer" data-tid="${m.transferId}">Cancel</button></div>${cur}`;
  }
  if (m.status === 'failed' || m.status === 'cancelled') {
    return `<div class="file-head">${kindLabel} <span class="muted">· ${totalLabel}</span></div><div class="err">${m.status === 'failed' ? '⚠️ Failed' : '✕ Cancelled'}${m.error ? ' – ' + esc(m.error) : ''}</div>`;
  }
  if (m.kind === 'folder') {
    const first = files[0];
    const folderPath = first?.savedPath ? dirOf(first.savedPath, first.path) : '';
    const list = files.slice(0, 6).map((f) => `<li>${esc(f.path.split('/').slice(1).join('/') || f.path)} <span class="muted">${fmtBytes(f.size)}</span></li>`).join('');
    const more = files.length > 6 ? `<li class="muted">… and ${files.length - 6} more</li>` : '';
    const actions = !out && folderPath && platform.showInFolder ? `<div class="actions"><button class="btn small ghost" data-action="show" data-path="${esc(folderPath)}">Open folder</button></div>`
      : !out && first?.savedPath && !platform.showInFolder ? `<div class="actions"><span class="muted small">Saved to Documents/Pigeon/${esc(contactName(m.contactId))}/${esc(m.name || '')}</span></div>` : '';
    return `<div class="file-head">📁 ${esc(m.name || 'Folder')} <span class="muted">· ${files.length} files · ${totalLabel}</span></div><ul class="file-list">${list}${more}</ul>${actions}`;
  }
  return files.map((f, i) => renderFileItem(m, f, i)).join('');
}

function dirOf(savedPath, relPath) {
  // savedPath ends with relPath (sanitised); return the folder that holds the transferred root folder
  const depth = relPath.split('/').length - 1;
  const parts = savedPath.replace(/\\/g, '/').split('/');
  parts.splice(parts.length - depth - 1, depth + 1);
  return parts.join('/') + '/' + relPath.split('/')[0];
}

function renderFileItem(m, f, i) {
  const out = m.dir === 'out';
  const kind = m.kind === 'voice' ? 'audio' : mimeKind(f.type, f.path);
  const name = f.path.split('/').pop();
  let url = '';
  if (f.url) url = f.url;
  else if (f.savedPath) url = platform.fileUrl(f.savedPath);
  else if (f.blob) url = blobUrl(`${m.id}:${i}`, f.blob);
  const openBtn = f.savedPath ? `<button class="btn small ghost" data-action="open" data-path="${esc(f.savedPath)}">Open</button>` : '';
  const showBtn = f.savedPath && platform.showInFolder ? `<button class="btn small ghost" data-action="show" data-path="${esc(f.savedPath)}">Show in folder</button>` : '';
  if (kind === 'image' && (url || f.thumb)) {
    return `<div class="media image" data-action="${f.savedPath ? 'open' : ''}" data-path="${esc(f.savedPath || '')}"><img src="${esc(f.thumb && !url ? f.thumb : url)}" alt="${esc(name)}" loading="lazy"><div class="media-cap">${esc(name)} <span class="muted">${fmtBytes(f.size)}</span></div></div>`;
  }
  if (kind === 'audio' && url) {
    return `<div class="media audio"><audio controls preload="metadata" src="${esc(url)}"></audio><div class="media-cap">${m.kind === 'voice' ? '🎤 Voice note' : esc(name)} <span class="muted">${fmtBytes(f.size)}</span></div>${openBtn ? `<div class="actions">${openBtn}${showBtn}</div>` : ''}</div>`;
  }
  if (kind === 'video' && url && f.size < 300 * 1024 * 1024) {
    return `<div class="media video"><video controls preload="metadata" src="${esc(url)}"></video><div class="media-cap">${esc(name)} <span class="muted">${fmtBytes(f.size)}</span></div>${openBtn ? `<div class="actions">${openBtn}${showBtn}</div>` : ''}</div>`;
  }
  return `<div class="file-card"><span class="ficon">${fileIcon(kind, name)}</span><div class="fmeta"><div class="fname">${esc(name)}</div><div class="muted small">${fmtBytes(f.size)}${out ? ' · sent' : ''}</div></div>${openBtn || showBtn ? `<div class="actions">${openBtn}${showBtn}</div>` : ''}</div>`;
}

function updateMessageEl(m) {
  const el = $(`.messages [data-mid="${CSS.escape(m.id)}"]`);
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = renderMessage(m);
  el.replaceWith(tmp.firstElementChild);
  scrollToBottom();
}

function appendMessageEl(m) {
  const box = $('.messages');
  if (!box) return;
  if ($('.messages-empty', box)) box.innerHTML = '';
  box.insertAdjacentHTML('beforeend', renderMessage(m));
  scrollToBottom(m.dir === 'out');
}

// ------------------------------------------------------------------ contacts
async function addContact(rawId) {
  const id = normalizeId(rawId);
  if (id.length < 4) return toast('Please enter a valid ID', 'error');
  if (id === state.identity.id) return toast("That's your own ID 🙂", 'error');
  if (!state.contacts.has(id)) {
    await saveContact({ id, name: '', peerName: '', addedAt: Date.now(), lastTs: 0, lastText: '', unread: 0 });
    state.blocked = state.blocked.filter((b) => b !== id);
    store.saveBlocked(state.blocked);
    renderContacts();
  }
  net.connect(id);
  selectContact(id);
}

async function selectContact(id) {
  state.activeId = id;
  if (id) {
    const c = state.contacts.get(id);
    if (c && c.unread) { c.unread = 0; await store.putContact(c); }
    state.messages = await store.getMessages(id);
    for (const m of state.messages) if (m.transferId) state.transferMsg.set(m.transferId, m);
    if (!isOnline(id)) net.connect(id);
  } else {
    state.messages = [];
  }
  renderContacts();
  renderChat();
}

async function renameContact() {
  const c = activeContact();
  if (!c) return;
  showModal(`<h3>Rename contact</h3><form data-form="rename"><input name="name" value="${esc(c.name || c.peerName || '')}" placeholder="Name" maxlength="40" autofocus><div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save</button></div></form>`,
    { onMount: (el) => el.querySelector('input').focus() });
}

async function deleteContact() {
  const c = activeContact();
  if (!c) return;
  showModal(`<h3>Delete ${esc(contactName(c.id))}?</h3><p class="muted">The chat history on this device will be removed. Files you already received stay on disk.</p><div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn danger" data-action="confirm-delete">Delete</button></div>`);
}

async function confirmDelete() {
  const c = activeContact();
  if (!c) return;
  closeModal();
  net.disconnectPeer(c.id);
  state.contacts.delete(c.id);
  state.presence.delete(c.id);
  await store.deleteContact(c.id);
  selectContact(null);
}

// ------------------------------------------------------------------ network events
function onPresence({ peerId, online, name }) {
  state.presence.set(peerId, online);
  if (name) state.peerNames.set(peerId, name);
  renderContacts();
  if (peerId === state.activeId) {
    const ps = $('.pstate');
    if (ps) ps.textContent = online ? 'online' : 'offline';
    const pr = $('.chat-head .presence');
    if (pr) pr.classList.toggle('on', online);
    document.querySelectorAll('.chat-head .call-btn').forEach((b) => { b.disabled = !online; });
  }
}

async function onHello({ peerId, name }) {
  state.peerNames.set(peerId, name);
  const c = state.contacts.get(peerId);
  if (c && name && c.peerName !== name) { c.peerName = name; await store.putContact(c); renderContacts(); if (peerId === state.activeId) renderChat(); }
}

function onRequest({ peerId, name }) {
  if (state.contacts.has(peerId) || state.blocked.includes(peerId)) return;
  if (name) state.peerNames.set(peerId, name);
  showModal(`<h3>New chat request</h3><p><strong>${esc(name || 'Someone')}</strong> <code>${esc(peerId)}</code> wants to chat with you.</p>
    <div class="modal-actions"><button class="btn ghost" data-action="decline-request" data-id="${esc(peerId)}">Decline</button><button class="btn" data-action="accept-request" data-id="${esc(peerId)}">Accept</button></div>`, { dismissible: false });
  platform.notify?.('Pigeon', `${name || peerId} wants to chat with you`);
}

async function acceptRequest(peerId) {
  closeModal();
  await saveContact({ id: peerId, name: '', peerName: state.peerNames.get(peerId) || '', addedAt: Date.now(), lastTs: Date.now(), lastText: '', unread: 0 });
  state.presence.set(peerId, net.isPeerOnline(peerId));
  renderContacts();
  await selectContact(peerId);
  net.releaseHeld(peerId);
  flushPending(peerId);
}

function declineRequest(peerId) {
  closeModal();
  state.blocked.push(peerId);
  store.saveBlocked(state.blocked);
  net.disconnectPeer(peerId);
}

async function onIncomingText({ peerId, id, text, ts }) {
  if (await store.getMessage(id)) return; // duplicate delivery
  const m = { id, contactId: peerId, dir: 'in', kind: 'text', text: String(text ?? ''), ts: Date.now(), status: 'received' };
  await store.putMessage(m);
  await bumpContact(peerId, m.text, peerId !== state.activeId || document.hidden);
  if (peerId === state.activeId) { state.messages.push(m); appendMessageEl(m); }
  maybeNotify(peerId, m.text);
}

async function bumpContact(peerId, lastText, unread) {
  const c = state.contacts.get(peerId);
  if (!c) return;
  c.lastTs = Date.now();
  c.lastText = (lastText || '').slice(0, 80);
  if (unread) c.unread = (c.unread || 0) + 1;
  await store.putContact(c);
  renderContacts();
}

function maybeNotify(peerId, text) {
  if (state.settings.notifications === false) return;
  if (document.hidden || !document.hasFocus() || peerId !== state.activeId) platform.notify?.(contactName(peerId), text);
}

async function onAck({ id }) {
  const m = state.messages.find((x) => x.id === id) || (await store.getMessage(id));
  if (!m || m.status === 'delivered') return;
  m.status = 'delivered';
  await store.putMessage(m);
  updateMessageEl(m);
}

function onTyping({ peerId }) {
  if (peerId !== state.activeId) return;
  const line = $('.typing-line');
  if (!line) return;
  line.textContent = `${contactName(peerId)} is typing…`;
  clearTimeout(state.typing.get(peerId));
  state.typing.set(peerId, setTimeout(() => { line.textContent = ''; }, 3000));
}

let lastTypingSent = 0;
function sendTypingThrottled() {
  const now = Date.now();
  if (now - lastTypingSent < 2000 || !state.activeId) return;
  lastTypingSent = now;
  net.sendTyping(state.activeId);
}

async function flushPending(peerId) {
  const pending = await store.getPending(peerId);
  for (const m of pending) {
    if (m.kind !== 'text') continue;
    if (net.sendText(peerId, m)) {
      m.status = 'sent';
      await store.putMessage(m);
      const live = state.messages.find((x) => x.id === m.id);
      if (live) { live.status = 'sent'; updateMessageEl(live); }
    }
  }
}

function onOffer(t) {
  const name = contactName(t.peerId);
  const label = t.kind === 'folder' ? `folder “${t.name}” (${t.files.length} files, ${fmtBytes(t.total)})` : t.files.length === 1 ? `“${t.files[0].path.split('/').pop()}” (${fmtBytes(t.total)})` : `${t.files.length} files (${fmtBytes(t.total)})`;
  showModal(`<h3>Incoming ${t.kind === 'folder' ? 'folder' : 'files'}</h3><p><strong>${esc(name)}</strong> wants to send you ${esc(label)}.</p>
    <div class="modal-actions"><button class="btn ghost" data-action="reject-offer" data-tid="${t.id}">Decline</button><button class="btn" data-action="accept-offer" data-tid="${t.id}">Accept</button></div>`, { dismissible: false });
}

async function onTransfer(t) {
  let m = state.transferMsg.get(t.id);
  if (!m) {
    if (t.dir === 'out') return; // outgoing messages are created by the sender flow
    m = {
      id: uid(), contactId: t.peerId, dir: 'in', kind: t.kind === 'folder' ? 'folder' : (t.files.length === 1 && /^voice-.*\.(webm|ogg|m4a|mp4)$/i.test(t.files[0].path) ? 'voice' : 'files'),
      name: t.name, files: t.files.map((f) => ({ path: f.path, size: f.size, type: f.type })), total: t.total, ts: Date.now(), status: 'transferring', transferId: t.id,
    };
    state.transferMsg.set(t.id, m);
    await store.putMessage(m);
    await bumpContact(t.peerId, t.kind === 'folder' ? `📁 ${t.name}` : m.kind === 'voice' ? '🎤 Voice note' : `📎 ${t.files.length === 1 ? t.files[0].path.split('/').pop() : t.files.length + ' files'}`, t.peerId !== state.activeId || document.hidden);
    if (t.peerId === state.activeId) { state.messages.push(m); appendMessageEl(m); }
  }
  const finished = ['done', 'delivered', 'failed', 'cancelled'].includes(t.status);
  if (finished) {
    if (t.dir === 'in' && t.status === 'done') {
      m.files.forEach((f, i) => { const r = t.results[i]; if (r) { f.savedPath = r.path; f.url = r.url; } });
      m.status = 'done';
      const label = m.kind === 'folder' ? `Folder “${m.name}” received` : m.kind === 'voice' ? 'Voice note' : m.files.length === 1 ? m.files[0].path.split('/').pop() : `${m.files.length} files received`;
      maybeNotify(t.peerId, label);
    } else {
      m.status = t.status === 'delivered' ? 'delivered' : t.status;
      m.error = t.error || '';
    }
    await store.putMessage(m);
    if (m.contactId === state.activeId) updateMessageEl(m);
    if (t.status === 'failed') toast(`Transfer failed: ${t.error || 'unknown error'}`, 'error');
    net.transfers.delete(t.id);
    state.transferMsg.delete(t.id);
    return;
  }
  if (m.contactId === state.activeId) updateMessageEl(m);
}

// ------------------------------------------------------------------ sending
async function sendCurrentText() {
  const ta = $('.composer .input');
  const text = (ta?.value || '').trim();
  if (!text || !state.activeId) return;
  ta.value = '';
  autoGrow(ta);
  const peerId = state.activeId;
  const m = { id: uid(), contactId: peerId, dir: 'out', kind: 'text', text, ts: Date.now(), status: 'pending' };
  if (net.sendText(peerId, m)) m.status = 'sent';
  await store.putMessage(m);
  state.messages.push(m);
  appendMessageEl(m);
  await bumpContact(peerId, text, false);
  if (m.status === 'pending') toast(`${contactName(peerId)} is offline – message will be sent when they come online`, 'info');
  if (!isNarrow()) ta.focus();
}

async function sendItems(items, { kind = 'files', name = '' } = {}) {
  const peerId = state.activeId;
  if (!peerId) return;
  if (!items.length) return toast('Nothing to send', 'error');
  if (!isOnline(peerId)) return toast(`${contactName(peerId)} is offline. Files can only be sent while you're both online.`, 'error', 5000);
  const t = net.sendFiles(peerId, { kind, name, items });
  if (!t) return toast('Could not start transfer', 'error');
  const files = items.map((f) => ({ path: f.path, size: f.size, type: f.type }));
  const m = { id: uid(), contactId: peerId, dir: 'out', kind, name, files, total: t.total, ts: Date.now(), status: 'transferring', transferId: t.id };
  if (kind === 'voice' && items[0].blob) m.files[0].blob = items[0].blob;
  state.transferMsg.set(t.id, m);
  await store.putMessage(m);
  state.messages.push(m);
  appendMessageEl(m);
  await bumpContact(peerId, kind === 'folder' ? `📁 ${name}` : kind === 'voice' ? '🎤 Voice note' : `📎 ${files.length === 1 ? files[0].path.split('/').pop() : files.length + ' files'}`, false);
  // thumbnails for outgoing images (persisted so previews survive restarts)
  for (let i = 0; i < items.length && i < 12; i++) {
    const it = items[i];
    if (it.blob && mimeKind(it.type, it.path) === 'image') {
      const thumb = await makeThumbnail(it.blob);
      if (thumb) { m.files[i].thumb = thumb; await store.putMessage(m); updateMessageEl(m); }
    }
  }
}

async function attachFiles() {
  const items = await platform.pickFiles();
  if (!items.length) return;
  await sendItems(items, { kind: 'files' });
}

async function attachFolder() {
  const res = await platform.pickFolder();
  if (!res) return;
  if (!res.items.length) return toast('That folder is empty', 'error');
  await sendItems(res.items, { kind: 'folder', name: res.name });
}

async function handleDrop(dt) {
  if (!state.activeId) return;
  const { items, rootDirs } = await itemsFromDataTransfer(dt);
  if (!items.length) return;
  const onlyOneFolder = rootDirs.length === 1 && items.every((f) => f.path.startsWith(rootDirs[0] + '/'));
  if (onlyOneFolder) await sendItems(items, { kind: 'folder', name: rootDirs[0] });
  else await sendItems(items, { kind: 'files' });
}

// ------------------------------------------------------------------ voice notes
async function startRecording() {
  if (state.rec) return;
  if (!navigator.mediaDevices?.getUserMedia) return toast('Microphone not available', 'error');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Microphone permission denied', 'error'); }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const rec = { recorder, chunks, stream, start: Date.now(), mime: recorder.mimeType || mime || 'audio/webm' };
  rec.timer = setInterval(() => { const el = $('.rec-time'); if (el) el.textContent = fmtDuration((Date.now() - rec.start) / 1000); }, 250);
  state.rec = rec;
  recorder.start(250);
  $('.chat')?.classList.add('recording');
}

function stopRecording(send) {
  const rec = state.rec;
  if (!rec) return;
  state.rec = null;
  clearInterval(rec.timer);
  $('.chat')?.classList.remove('recording');
  const finish = async () => {
    rec.stream.getTracks().forEach((t) => t.stop());
    if (!send) return;
    const blob = new Blob(rec.chunks, { type: rec.mime });
    if (blob.size < 1000) return toast('Recording too short', 'error');
    const ext = rec.mime.includes('ogg') ? 'ogg' : rec.mime.includes('mp4') ? 'm4a' : 'webm';
    const name = `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
    await sendItems([{ path: name, name, size: blob.size, type: rec.mime, source: blobSource(blob), blob }], { kind: 'voice' });
  };
  rec.recorder.onstop = finish;
  if (rec.recorder.state !== 'inactive') rec.recorder.stop(); else finish();
}

// ------------------------------------------------------------------ calls
const callUi = { timer: null, tone: null, remoteEl: null, localEl: null, speaker: true };

async function startCall(video) {
  const peerId = state.activeId;
  if (!peerId) return;
  if (!isOnline(peerId)) return toast(`${contactName(peerId)} is offline`, 'error');
  if (net.call) return toast('You are already in a call', 'error');
  try {
    await net.startCall(peerId, { video });
    platform.callStarted?.(video);
  } catch (e) {
    toast(e.message.includes('Permission') || e.name === 'NotAllowedError' ? 'Microphone/camera permission denied' : `Could not start call: ${e.message}`, 'error');
  }
}

function onCallUpdate(call) {
  renderCall(call);
  if (call.status === 'ringing') startTone(call.dir === 'in' ? 'ring' : 'ringback');
  else stopTone();
  if (call.status === 'ringing' && call.dir === 'in') {
    platform.notify?.(contactName(call.peerId), `Incoming ${call.video ? 'video' : 'voice'} call`);
  }
}

function onCallEnded({ call, reason, error }) {
  stopTone();
  renderCall(null);
  platform.callEnded?.();
  const why = { 'no-answer': 'No answer', declined: 'Call declined', busy: 'Contact is busy', 'connection-lost': 'Connection lost', error: error || 'Call failed', missed: '' }[reason];
  if (why) toast(why, reason === 'error' || reason === 'connection-lost' ? 'error' : 'info');
}

async function onCallLog({ peerId, dir, video, outcome, duration }) {
  const m = { id: uid(), contactId: peerId, dir, kind: 'call', video, outcome, duration, ts: Date.now(), status: 'done' };
  await store.putMessage(m);
  const missed = dir === 'in' && outcome !== 'completed';
  await bumpContact(peerId, `${video ? '🎥' : '📞'} ${callLabel(m)}`, missed && (peerId !== state.activeId || document.hidden));
  if (peerId === state.activeId) { state.messages.push(m); appendMessageEl(m); }
  if (missed) maybeNotify(peerId, `Missed ${video ? 'video ' : ''}call`);
}

function renderCall(call) {
  const root = $('.call-root');
  if (!root) return;
  clearInterval(callUi.timer);
  callUi.timer = null;
  if (!call) {
    root.innerHTML = '';
    root.classList.remove('open');
    callUi.remoteEl = callUi.localEl = null;
    document.body.classList.remove('in-call');
    return;
  }
  const name = contactName(call.peerId);
  const initial = esc(name.slice(0, 1).toUpperCase());
  const muted = call.local ? !(call.local.getAudioTracks()[0]?.enabled ?? true) : false;
  const camOff = call.local ? !(call.local.getVideoTracks()[0]?.enabled ?? true) : false;
  const hasLocalVideo = !!call.local?.getVideoTracks().length;
  const hasRemoteVideo = !!call.remote?.getVideoTracks().length;
  let status = '';
  if (call.status === 'ringing') status = call.dir === 'in' ? `Incoming ${call.video ? 'video' : 'voice'} call` : 'Calling…';
  else if (call.status === 'connecting') status = 'Connecting…';
  else status = '<span class="call-timer">0:00</span>';
  let controls = '';
  if (call.status === 'ringing' && call.dir === 'in') {
    controls = `<button class="call-btn-round decline" data-action="call-decline" title="Decline">📵</button>
      <button class="call-btn-round accept" data-action="call-accept" title="Answer">📞</button>
      ${call.video ? '<button class="call-btn-round accept" data-action="call-accept-video" title="Answer with video">🎥</button>' : ''}`;
  } else {
    controls = `<button class="call-btn-round ${muted ? 'active' : ''}" data-action="call-mute" title="${muted ? 'Unmute' : 'Mute'}">${muted ? '🔇' : '🎙️'}</button>
      ${hasLocalVideo ? `<button class="call-btn-round ${camOff ? 'active' : ''}" data-action="call-camera" title="Camera on/off">${camOff ? '🚫' : '📷'}</button>` : ''}
      ${hasLocalVideo && platform.name === 'android' ? '<button class="call-btn-round" data-action="call-switch" title="Switch camera">🔄</button>' : ''}
      ${platform.setSpeaker ? `<button class="call-btn-round ${callUi.speaker ? 'active' : ''}" data-action="call-speaker" title="Speaker">🔊</button>` : ''}
      <button class="call-btn-round decline" data-action="call-hangup" title="Hang up">📵</button>`;
  }
  root.innerHTML = `<div class="call-panel ${hasRemoteVideo ? 'has-video' : ''}">
      <video class="remote-video" autoplay playsinline ${hasRemoteVideo ? '' : 'hidden'}></video>
      <div class="call-center" ${hasRemoteVideo ? 'hidden' : ''}><div class="avatar xl">${initial}</div><div class="call-name">${esc(name)}</div><div class="call-status">${status}</div></div>
      <div class="call-top" ${hasRemoteVideo ? '' : 'hidden'}><div class="call-name">${esc(name)}</div><div class="call-status">${status}</div></div>
      <video class="local-video" autoplay playsinline muted ${hasLocalVideo ? '' : 'hidden'}></video>
      <div class="call-controls">${controls}</div>
    </div>`;
  root.classList.add('open');
  document.body.classList.add('in-call');
  callUi.remoteEl = root.querySelector('.remote-video');
  callUi.localEl = root.querySelector('.local-video');
  if (call.remote) { callUi.remoteEl.srcObject = call.remote; callUi.remoteEl.play?.().catch(() => {}); }
  if (call.local) { callUi.localEl.srcObject = call.local; }
  if (call.status === 'connected') {
    const tick = () => { const txt = fmtDuration((Date.now() - call.startedAt) / 1000); root.querySelectorAll('.call-timer').forEach((el) => { el.textContent = txt; }); };
    tick();
    callUi.timer = setInterval(tick, 1000);
  }
}

function startTone(kind) {
  stopTone();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = kind === 'ring' ? 880 : 440;
    osc.connect(gain);
    osc.start();
    const pattern = kind === 'ring' ? [0.4, 0.2, 0.4, 1.4] : [1, 2];
    let i = 0; let on = true; let t = ctx.currentTime;
    const schedule = () => {
      for (let n = 0; n < 8; n++) {
        gain.gain.setValueAtTime(on ? 0.12 : 0.0001, t);
        t += pattern[i % pattern.length]; i++; on = !on;
      }
    };
    schedule();
    const iv = setInterval(schedule, 3000);
    callUi.tone = { ctx, osc, iv };
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {}
}

function stopTone() {
  const t = callUi.tone;
  if (!t) return;
  callUi.tone = null;
  clearInterval(t.iv);
  try { t.osc.stop(); } catch {}
  try { t.ctx.close(); } catch {}
}

// ------------------------------------------------------------------ dialogs
function showNameDialog(firstRun = false) {
  showModal(`<h3>${firstRun ? 'Welcome to Pigeon 🕊️' : 'Your name'}</h3>
    <p class="muted">${firstRun ? 'Pick a display name. Your friends will see it next to your ID.' : ''}</p>
    <form data-form="name"><input name="name" placeholder="Your name" maxlength="40" value="${esc(state.identity.name || '')}" autofocus>
    <div class="modal-actions">${firstRun ? '' : '<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>'}<button class="btn" type="submit">Continue</button></div></form>`,
    { dismissible: !firstRun, onMount: (el) => el.querySelector('input').focus() });
}

function showSettings() {
  const s = state.settings;
  showModal(`<h3>Settings</h3>
    <form data-form="settings" class="settings-form">
      <label>Display name<input name="name" value="${esc(state.identity.name)}" maxlength="40"></label>
      <label class="row"><input type="checkbox" name="autoAcceptFiles" ${s.autoAcceptFiles !== false ? 'checked' : ''}> Automatically accept files from contacts</label>
      <label class="row"><input type="checkbox" name="notifications" ${s.notifications !== false ? 'checked' : ''}> Show notifications</label>
      <details><summary>Advanced: signalling server &amp; ICE</summary>
        <p class="muted small">The signalling server only helps the two devices find each other; it never sees your messages or files. Leave the host empty to use the free public PeerJS cloud.</p>
        <label>PeerJS host<input name="peerHost" value="${esc(s.peerHost || '')}" placeholder="0.peerjs.com (default)"></label>
        <div class="grid2"><label>Port<input name="peerPort" value="${esc(s.peerPort || 443)}"></label><label>Path<input name="peerPath" value="${esc(s.peerPath || '/')}"></label></div>
        <label class="row"><input type="checkbox" name="peerSecure" ${s.peerSecure !== false ? 'checked' : ''}> Use TLS (wss)</label>
        <label>ICE servers (JSON)<textarea name="iceServers" rows="5">${esc(JSON.stringify(s.iceServers, null, 1))}</textarea></label>
      </details>
      <details><summary>Danger zone</summary>
        <p class="muted small">Your ID is <code>${esc(state.identity.id)}</code>. Generating a new one means your contacts must add the new ID.</p>
        <button type="button" class="btn danger small" data-action="regen-id">Generate a new ID</button>
      </details>
      <p class="muted small">Received files are saved under <span class="dl-dir">…</span></p>
      <div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn" type="submit">Save</button></div>
    </form>`, { onMount: async (el) => { try { el.querySelector('.dl-dir').textContent = await platform.downloadsDir(); } catch {} } });
}

async function saveSettingsForm(form) {
  const fd = new FormData(form);
  const next = { ...state.settings };
  next.autoAcceptFiles = fd.get('autoAcceptFiles') === 'on';
  next.notifications = fd.get('notifications') === 'on';
  next.peerHost = String(fd.get('peerHost') || '').trim();
  next.peerPort = Number(fd.get('peerPort')) || 443;
  next.peerPath = String(fd.get('peerPath') || '/').trim() || '/';
  next.peerSecure = fd.get('peerSecure') === 'on';
  try {
    const ice = JSON.parse(String(fd.get('iceServers') || '[]'));
    if (!Array.isArray(ice)) throw new Error('ICE servers must be an array');
    next.iceServers = ice;
  } catch (e) { return toast(`Invalid ICE servers JSON: ${e.message}`, 'error'); }
  const name = String(fd.get('name') || '').trim();
  const serverChanged = ['peerHost', 'peerPort', 'peerPath', 'peerSecure'].some((k) => next[k] !== state.settings[k]) || JSON.stringify(next.iceServers) !== JSON.stringify(state.settings.iceServers);
  state.settings = next;
  store.saveSettings(next);
  Object.assign(net.settings, next);
  if (name && name !== state.identity.name) { state.identity.name = name; store.saveIdentity(state.identity); renderMe(); }
  closeModal();
  if (serverChanged) { net.restart(); toast('Reconnecting with new settings…'); }
  else toast('Settings saved');
}

function showIdTakenDialog() {
  showModal(`<h3>Your ID is already in use</h3><p>Another device is currently online with the ID <code>${esc(state.identity.id)}</code> (maybe the app is open twice?). Close the other instance and retry, or generate a new ID.</p>
    <div class="modal-actions"><button class="btn ghost" data-action="retry-connect">Retry</button><button class="btn danger" data-action="regen-id">New ID</button></div>`, { dismissible: false });
}

function regenerateId() {
  const newId = store.createIdentity(state.identity.name).id;
  state.identity.id = newId;
  store.saveIdentity(state.identity);
  net.identity = state.identity;
  renderMe();
  closeModal();
  net.status = 'connecting';
  net.restart();
  toast(`Your new ID is ${newId}`);
}

// ------------------------------------------------------------------ global handlers
function setupGlobalHandlers() {
  $app.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href]');
    if (a && /^https?:/.test(a.href)) { if (platform.name === 'electron') return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (!action) return;
    switch (action) {
      case 'copy-id':
        try { await navigator.clipboard.writeText(state.identity.id); toast('ID copied to clipboard'); }
        catch { toast(`Your ID: ${state.identity.id}`); }
        break;
      case 'share-id': platform.share ? platform.share(`Chat with me on Pigeon. My ID is ${state.identity.id}`) : navigator.share?.({ text: `Chat with me on Pigeon. My ID is ${state.identity.id}` }).catch(() => {}); break;
      case 'settings': showSettings(); break;
      case 'select': selectContact(el.dataset.id); break;
      case 'back': selectContact(null); break;
      case 'rename': renameContact(); break;
      case 'delete-contact': deleteContact(); break;
      case 'confirm-delete': confirmDelete(); break;
      case 'close-modal': closeModal(); break;
      case 'accept-request': acceptRequest(el.dataset.id); break;
      case 'decline-request': declineRequest(el.dataset.id); break;
      case 'accept-offer': closeModal(); net.acceptTransfer(el.dataset.tid); break;
      case 'reject-offer': closeModal(); net.rejectTransfer(el.dataset.tid); break;
      case 'attach-file': attachFiles(); break;
      case 'attach-folder': attachFolder(); break;
      case 'send': sendCurrentText(); break;
      case 'mic': startRecording(); break;
      case 'rec-stop': stopRecording(true); break;
      case 'rec-cancel': stopRecording(false); break;
      case 'cancel-transfer': net.cancelTransfer(el.dataset.tid); break;
      case 'open': if (el.dataset.path) platform.openFile(el.dataset.path); break;
      case 'show': if (el.dataset.path) platform.showInFolder?.(el.dataset.path); break;
      case 'regen-id': regenerateId(); break;
      case 'call-audio': startCall(false); break;
      case 'call-video': startCall(true); break;
      case 'call-accept': net.acceptCall({ video: false }).then(() => platform.callStarted?.(false)).catch((e) => toast(e.message, 'error')); break;
      case 'call-accept-video': net.acceptCall({ video: true }).then(() => platform.callStarted?.(true)).catch((e) => toast(e.message, 'error')); break;
      case 'call-decline': net.declineCall(); break;
      case 'call-hangup': net.hangUp(); break;
      case 'call-mute': net.toggleMute(); break;
      case 'call-camera': net.toggleCamera(); break;
      case 'call-switch': net.switchCamera().catch(() => toast('Could not switch camera', 'error')); break;
      case 'call-speaker': callUi.speaker = !callUi.speaker; platform.setSpeaker?.(callUi.speaker); if (net.call) renderCall(net.call); break;
      case 'retry-connect': closeModal(); net.status = 'connecting'; net.restart(); break;
      default: break;
    }
  });

  $app.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const kind = form.dataset.form;
    if (kind === 'add') { const inp = form.querySelector('input'); await addContact(inp.value); inp.value = ''; }
    if (kind === 'name') {
      const name = String(new FormData(form).get('name') || '').trim();
      if (!name) return;
      state.identity.name = name; store.saveIdentity(state.identity); renderMe(); closeModal();
    }
    if (kind === 'rename') {
      const c = activeContact();
      if (c) { c.name = String(new FormData(form).get('name') || '').trim(); await store.putContact(c); renderContacts(); renderChat(); }
      closeModal();
    }
    if (kind === 'settings') await saveSettingsForm(form);
  });

  // drag & drop
  $app.addEventListener('dragenter', (e) => { if (!state.activeId) return; e.preventDefault(); state.dragDepth++; $('.chat')?.classList.add('dragging'); });
  $app.addEventListener('dragover', (e) => { if (state.activeId) e.preventDefault(); });
  $app.addEventListener('dragleave', () => { state.dragDepth = Math.max(0, state.dragDepth - 1); if (!state.dragDepth) $('.chat')?.classList.remove('dragging'); });
  $app.addEventListener('drop', (e) => { e.preventDefault(); state.dragDepth = 0; $('.chat')?.classList.remove('dragging'); handleDrop(e.dataTransfer); });

  // paste images
  document.addEventListener('paste', (e) => {
    if (!state.activeId) return;
    const files = Array.from(e.clipboardData?.files || []);
    if (!files.length) return;
    e.preventDefault();
    sendItems(files.map((f) => ({ path: f.name || `pasted-${Date.now()}.png`, name: f.name, size: f.size, type: f.type || guessMime(f.name), source: blobSource(f), blob: f })), { kind: 'files' });
  });

  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && state.activeId) {
      const c = activeContact();
      if (c && c.unread) { c.unread = 0; await store.putContact(c); renderContacts(); }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') handleBack(); });
  window.addEventListener('resize', () => $app.classList.toggle('in-chat', !!state.activeId));
}

// expose for debugging / tests
window.pigeon = { state, get net() { return net; }, get store() { return store; }, get platform() { return platform; }, addContact, selectContact, sendItems, startCall };

main().catch((e) => { console.error(e); document.body.innerHTML = `<pre style="color:#f66;padding:20px">Failed to start: ${esc(e.stack || e)}</pre>`; });
