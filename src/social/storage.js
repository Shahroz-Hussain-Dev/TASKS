// ---------------------------------------------------------------------------
// storage.js
// Temporary in-browser data layer for the daily_jobs social demo.
//
// Everything here lives in localStorage so the UI works with no backend yet.
// When you are ready to connect your real database, replace the read/write
// helpers below with API calls to your server (see the DB_CONNECTION note).
//
// SECURITY NOTE (important):
//   - Passwords are NEVER stored in plain text and are NEVER written to the
//     security log. We store a salted SHA-256 hash only. On a real server you
//     should upgrade this to bcrypt/argon2 (the project already ships bcryptjs).
//   - The security log records WHO tried to sign in, WHEN, from where, and
//     whether it SUCCEEDED or FAILED -- but never the password they typed.
//     Logging real passwords (even wrong ones) is how credential-harvesting
//     works and is unsafe for your users, so this demo deliberately does not.
// ---------------------------------------------------------------------------

const USERS_KEY = "dj_users";
const REELS_KEY = "dj_reels";
const LOGS_KEY = "dj_security_logs";
const SESSION_KEY = "dj_session";

// Where your real database will eventually live. Paste your connection string
// into your server's environment (NOT here in client code) and point these
// helpers at your API instead of localStorage.
export const DB_CONNECTION = {
  configured: false,
  note:
    "Add your database connection string on the server side (e.g. server/.env " +
    "as MONGODB_URI / DATABASE_URL). Never ship a real DB URL in frontend code.",
};

// --- small helpers ---------------------------------------------------------

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function uid(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

// Salted SHA-256 hash of a password. Demo-grade only -- use bcrypt on the server.
export async function hashPassword(password, salt) {
  const useSalt = salt || uid("salt");
  const data = new TextEncoder().encode(useSalt + ":" + password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { salt: useSalt, hash: hex };
}

// --- users -----------------------------------------------------------------

export function getUsers() {
  return read(USERS_KEY, []);
}

export function findUser(identifier) {
  const id = (identifier || "").trim().toLowerCase();
  return getUsers().find(
    (u) => u.email.toLowerCase() === id || u.phone === identifier.trim()
  );
}

export async function createUser({ name, email, phone, password, provider }) {
  const users = getUsers();
  if (findUser(email) || (phone && findUser(phone))) {
    throw new Error("An account with that email or phone already exists.");
  }
  const { salt, hash } = password
    ? await hashPassword(password)
    : { salt: null, hash: null };
  const user = {
    id: uid("user"),
    name: name || (email ? email.split("@")[0] : "New user"),
    email: (email || "").trim(),
    phone: (phone || "").trim(),
    provider: provider || "password", // "password" | "google"
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  write(USERS_KEY, users);
  return user;
}

export async function verifyPassword(user, password) {
  if (!user || !user.passwordHash) return false;
  const { hash } = await hashPassword(password, user.passwordSalt);
  return hash === user.passwordHash;
}

export async function setPassword(identifier, newPassword) {
  const users = getUsers();
  const u = users.find(
    (x) =>
      x.email.toLowerCase() === identifier.trim().toLowerCase() ||
      x.phone === identifier.trim()
  );
  if (!u) throw new Error("No account found for that email or phone.");
  const { salt, hash } = await hashPassword(newPassword);
  u.passwordSalt = salt;
  u.passwordHash = hash;
  write(USERS_KEY, users);
  return u;
}

// --- session ---------------------------------------------------------------

export function getSession() {
  return read(SESSION_KEY, null);
}

export function setSession(user) {
  write(SESSION_KEY, {
    userId: user.id,
    name: user.name,
    email: user.email,
    at: new Date().toISOString(),
  });
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// --- security log ----------------------------------------------------------
// Records attempts WITHOUT the password value. "event" is a short phrase so
// the admin can read what happened in plain language.

export function getLogs() {
  return read(LOGS_KEY, []);
}

export function addLog({ event, identifier, outcome, detail }) {
  const logs = getLogs();
  logs.unshift({
    id: uid("log"),
    time: new Date().toISOString(),
    event, // e.g. "Login attempt", "Password reset", "Account created"
    identifier: identifier || "", // email/phone typed (NOT the password)
    outcome: outcome || "", // "success" | "failed"
    detail: detail || "", // plain-language note, e.g. "wrong password"
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  });
  // keep the log from growing without bound in the demo
  write(LOGS_KEY, logs.slice(0, 500));
}

export function clearLogs() {
  write(LOGS_KEY, []);
}

// --- reels -----------------------------------------------------------------

const CHANNEL = {
  handle: "daily_jobs",
  name: "daily_jobs",
  verified: true,
};

export function getChannel() {
  return CHANNEL;
}

// Build a long, share-style URL like the big platforms use.
export function buildReelUrl(reelId) {
  const token =
    uid("v").replace(/_/g, "") + Math.random().toString(36).slice(2, 10);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://daily-jobs.app";
  return `${origin}/reels/${CHANNEL.handle}/video/${reelId}?share=${token}&source=feed`;
}

export function getReels() {
  return read(REELS_KEY, []);
}

export function addReel({ title, description, videoUrl, posterUrl, music }) {
  const reels = getReels();
  const id = uid("reel");
  const reel = {
    id,
    channel: CHANNEL,
    title: title || "Untitled reel",
    description: description || "",
    videoUrl: videoUrl || "",
    posterUrl: posterUrl || "",
    music: music || "Original audio · daily_jobs",
    url: buildReelUrl(id),
    likes: 0,
    comments: 0,
    shares: 0,
    createdAt: new Date().toISOString(),
  };
  reels.unshift(reel);
  write(REELS_KEY, reels);
  return reel;
}

export function deleteReel(id) {
  write(
    REELS_KEY,
    getReels().filter((r) => r.id !== id)
  );
}

// Seed one demo reel so the feed isn't empty on first load.
export function ensureSeed() {
  if (getReels().length === 0) {
    addReel({
      title: "We're hiring! 3 remote roles this week",
      description:
        "New openings posted every day. Follow daily_jobs for fresh roles. #jobs #hiring #remote",
      videoUrl: "",
      posterUrl: "",
      music: "Original audio · daily_jobs",
    });
  }
}
