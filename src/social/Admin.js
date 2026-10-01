import React, { useEffect, useState } from "react";
import {
  getReels,
  addReel,
  deleteReel,
  getUsers,
  getLogs,
  clearLogs,
  DB_CONNECTION,
} from "./storage";

// Simple demo gate. Replace with real admin auth on your server.
const ADMIN_PASSCODE = "admin123";

function Gate({ onOk }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    if (pass === ADMIN_PASSCODE) onOk();
    else setError("Incorrect admin passcode.");
  }
  return (
    <div className="dj-screen">
      <div className="dj-auth-wrap">
        <div className="dj-auth-card">
          <div className="dj-brand">
            <div className="dj-logo">daily_jobs</div>
            <div className="dj-tagline">Admin console</div>
          </div>
          {error && <div className="dj-error">{error}</div>}
          <form onSubmit={submit}>
            <input
              className="dj-field"
              type="password"
              autoFocus
              placeholder="Admin passcode"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <button className="dj-btn dj-btn-primary" type="submit">
              Enter console
            </button>
          </form>
          <p className="dj-note">
            Demo passcode: <b>{ADMIN_PASSCODE}</b>. Change this and move admin
            auth to your server before going live.
          </p>
        </div>
      </div>
    </div>
  );
}

function UploadReel({ onAdded }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    posterUrl: "",
    music: "",
  });
  const [lastUrl, setLastUrl] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const reel = addReel(form);
    setLastUrl(reel.url);
    setForm({ title: "", description: "", videoUrl: "", posterUrl: "", music: "" });
    onAdded();
  }

  return (
    <div className="dj-panel">
      <h2>Upload a reel</h2>
      <p style={{ color: "var(--dj-muted)", marginTop: 0, fontSize: 14 }}>
        Posts as <b>daily_jobs</b> (verified). A long share URL is generated
        automatically, and you can add as many reels as you like.
      </p>
      {lastUrl && (
        <div className="dj-success">
          Reel published. Share URL:
          <div className="dj-mono" style={{ marginTop: 6 }}>{lastUrl}</div>
        </div>
      )}
      <form onSubmit={submit} className="dj-form-grid">
        <div className="dj-full">
          <label className="dj-label">Title *</label>
          <input
            className="dj-field"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. 3 remote jobs this week"
          />
        </div>
        <div className="dj-full">
          <label className="dj-label">Caption / description</label>
          <textarea
            className="dj-field"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="#jobs #hiring #remote"
          />
        </div>
        <div>
          <label className="dj-label">Video URL (mp4/webm)</label>
          <input
            className="dj-field"
            value={form.videoUrl}
            onChange={(e) => set("videoUrl", e.target.value)}
            placeholder="https://…/clip.mp4"
          />
        </div>
        <div>
          <label className="dj-label">Poster / thumbnail URL</label>
          <input
            className="dj-field"
            value={form.posterUrl}
            onChange={(e) => set("posterUrl", e.target.value)}
            placeholder="https://…/cover.jpg"
          />
        </div>
        <div className="dj-full">
          <label className="dj-label">Audio label</label>
          <input
            className="dj-field"
            value={form.music}
            onChange={(e) => set("music", e.target.value)}
            placeholder="Original audio · daily_jobs"
          />
        </div>
        <div className="dj-full">
          <button className="dj-btn dj-btn-primary" type="submit">
            Publish reel
          </button>
        </div>
      </form>
    </div>
  );
}

function ReelList({ reels, onChanged }) {
  return (
    <div className="dj-panel">
      <h2>Reels ({reels.length})</h2>
      {reels.length === 0 && (
        <p style={{ color: "var(--dj-muted)" }}>No reels yet.</p>
      )}
      {reels.map((r) => (
        <div className="dj-admin-reel" key={r.id}>
          <div className="thumb">
            {r.posterUrl ? (
              <img
                src={r.posterUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
              />
            ) : (
              "▶"
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>{r.title}</div>
            <div style={{ fontSize: 13, color: "var(--dj-muted)" }}>
              {r.description}
            </div>
            <div className="dj-mono" style={{ marginTop: 4 }}>{r.url}</div>
            <div style={{ fontSize: 12, color: "var(--dj-muted)", marginTop: 4 }}>
              {new Date(r.createdAt).toLocaleString()} · ♥ {r.likes} · 💬{" "}
              {r.comments} · ↗ {r.shares}
            </div>
          </div>
          <button
            className="dj-del"
            onClick={() => {
              deleteReel(r.id);
              onChanged();
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function Users({ users }) {
  return (
    <div className="dj-panel">
      <h2>Users ({users.length})</h2>
      <div className="dj-banner">
        For your users' safety, passwords are shown only as a one-way salted
        hash — never in plain text. A real sign-in system can verify a password
        against its hash but can never read it back, and neither can you. That's
        the correct, secure design.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="dj-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Sign-in method</th>
              <th>Password (hashed)</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--dj-muted)" }}>
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email || "—"}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  <span className={"dj-pill " + (u.provider === "google" ? "info" : "ok")}>
                    {u.provider === "google" ? "Google" : "Password"}
                  </span>
                </td>
                <td className="dj-mono">
                  {u.passwordHash ? u.passwordHash.slice(0, 24) + "…" : "— (OAuth)"}
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Logs({ logs, onCleared }) {
  return (
    <div className="dj-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Security log ({logs.length})</h2>
        <button className="dj-del" onClick={onCleared}>
          Clear log
        </button>
      </div>
      <div className="dj-banner">
        Every sign-in, reset and sign-up attempt is recorded in plain language —
        who, when, from what browser, and whether it worked — so you can watch
        for anything suspicious. The password typed is deliberately never
        recorded.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="dj-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Event</th>
              <th>Account (email/phone)</th>
              <th>Result</th>
              <th>Note</th>
              <th>Browser</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--dj-muted)" }}>
                  Nothing logged yet.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  {new Date(l.time).toLocaleString()}
                </td>
                <td>{l.event}</td>
                <td>{l.identifier || "—"}</td>
                <td>
                  <span className={"dj-pill " + (l.outcome === "success" ? "ok" : "bad")}>
                    {l.outcome}
                  </span>
                </td>
                <td>{l.detail}</td>
                <td style={{ fontSize: 11, color: "var(--dj-muted)", maxWidth: 220 }}>
                  {l.userAgent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("upload");
  const [reels, setReels] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);

  function refresh() {
    setReels(getReels());
    setUsers(getUsers());
    setLogs(getLogs());
  }

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  if (!authed) return <Gate onOk={() => setAuthed(true)} />;

  return (
    <div className="dj-screen">
      <div className="dj-admin-shell">
        <div className="dj-admin-head">
          <h1>daily_jobs · Admin</h1>
          <a className="dj-link" href="/reels">
            View reels →
          </a>
        </div>

        {!DB_CONNECTION.configured && (
          <div className="dj-banner">
            <b>Database not connected yet.</b> {DB_CONNECTION.note} All data
            below currently lives in this browser (localStorage). Send me your
            connection string when ready and I'll wire the API to it.
          </div>
        )}

        <div className="dj-tabs">
          {[
            ["upload", "Upload reel"],
            ["reels", "Reels"],
            ["users", "Users"],
            ["logs", "Security log"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={"dj-tab " + (tab === key ? "active" : "")}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "upload" && <UploadReel onAdded={refresh} />}
        {tab === "reels" && <ReelList reels={reels} onChanged={refresh} />}
        {tab === "users" && <Users users={users} />}
        {tab === "logs" && (
          <Logs
            logs={logs}
            onCleared={() => {
              clearLogs();
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
