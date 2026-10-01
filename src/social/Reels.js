import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getReels,
  ensureSeed,
  getSession,
  clearSession,
} from "./storage";

// Blue verified tick (badge) like the big platforms use.
function Verified() {
  return (
    <svg className="dj-verified" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified">
      <path d="M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.5l.9-2.9L3 10.7l2.6-1.5 1-2.8 3 .3L12 2zm-1.2 13.2l5-5-1.4-1.4-3.6 3.6-1.8-1.8L7.6 12l3.2 3.2z" />
    </svg>
  );
}

function ReelCard({ reel, onCount }) {
  const ch = reel.channel;
  function share() {
    // Copy the long share-style URL, like tapping "Copy link".
    try {
      navigator.clipboard.writeText(reel.url);
      alert("Link copied:\n\n" + reel.url);
    } catch {
      window.prompt("Copy this reel link:", reel.url);
    }
    onCount(reel.id, "shares");
  }

  return (
    <div className="dj-reel">
      <div className="dj-reel-media">
        {reel.videoUrl ? (
          <video
            src={reel.videoUrl}
            poster={reel.posterUrl || undefined}
            controls
            loop
            playsInline
          />
        ) : reel.posterUrl ? (
          <img src={reel.posterUrl} alt={reel.title} />
        ) : (
          <div className="dj-reel-placeholder">
            <div className="dj-play">▶</div>
            <div>{reel.title}</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              (Admin can attach a video URL to play it here)
            </div>
          </div>
        )}

        <div className="dj-reel-actions">
          <button className="dj-action" onClick={() => onCount(reel.id, "likes")}>
            <span className="dj-icon">♥</span>
            <span className="dj-count">{reel.likes}</span>
          </button>
          <button
            className="dj-action"
            onClick={() => onCount(reel.id, "comments")}
          >
            <span className="dj-icon">💬</span>
            <span className="dj-count">{reel.comments}</span>
          </button>
          <button className="dj-action" onClick={share}>
            <span className="dj-icon">↗</span>
            <span className="dj-count">{reel.shares}</span>
          </button>
          <button className="dj-action">
            <span className="dj-icon">⋯</span>
          </button>
        </div>

        <div className="dj-reel-info">
          <div className="dj-channel">
            <span className="dj-ch-avatar">d</span>
            <span className="dj-ch-name">
              {ch.name}
              {ch.verified && <Verified />}
            </span>
            <button className="dj-follow-btn">Follow</button>
          </div>
          {reel.description && (
            <div className="dj-reel-caption">{reel.description}</div>
          )}
          <div className="dj-reel-music">🎵 {reel.music}</div>
        </div>
      </div>
    </div>
  );
}

export default function Reels() {
  const navigate = useNavigate();
  const [reels, setReels] = useState([]);
  const session = getSession();

  useEffect(() => {
    ensureSeed();
    setReels(getReels());
  }, []);

  // Optimistic local counters (not persisted -- engagement is per view here).
  function bump(id, field) {
    setReels((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: r[field] + 1 } : r))
    );
  }

  function logout() {
    clearSession();
    navigate("/login");
  }

  return (
    <div className="dj-reels-screen">
      <div className="dj-reels-top">
        <div className="dj-logo">Reels</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>
            {session ? session.name || session.email : ""}
          </span>
          <button className="dj-follow-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      <div className="dj-reels-feed">
        {reels.length === 0 ? (
          <div className="dj-reel">
            <div className="dj-reel-placeholder">
              No reels yet. Ask the admin to upload some.
            </div>
          </div>
        ) : (
          reels.map((r) => <ReelCard key={r.id} reel={r} onCount={bump} />)
        )}
      </div>
    </div>
  );
}
