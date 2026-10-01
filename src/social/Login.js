import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  findUser,
  verifyPassword,
  createUser,
  setSession,
  addLog,
} from "./storage";
import GoogleG from "./GoogleG";

// Two-step sign in: (1) enter email/phone, (2) enter password.
// A "Continue with Google" button does OAuth-style sign in -- it never asks
// for or stores a Google password (that is the whole point of OAuth).
export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState("identifier"); // identifier | password | signup
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // sign-up fields
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suPass, setSuPass] = useState("");

  function goToPassword(e) {
    e.preventDefault();
    setError("");
    const value = identifier.trim();
    if (!value) return setError("Enter your email or phone number.");
    const user = findUser(value);
    if (!user) {
      addLog({
        event: "Login attempt",
        identifier: value,
        outcome: "failed",
        detail: "no account found for this email/phone",
      });
      return setError(
        "No account found. Check the email/phone or create a new account."
      );
    }
    setStep("password");
  }

  async function submitPassword(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = findUser(identifier.trim());
      const ok = user && (await verifyPassword(user, password));
      if (!ok) {
        // We log that a sign-in FAILED and for which account -- never the
        // password that was typed.
        addLog({
          event: "Login attempt",
          identifier: identifier.trim(),
          outcome: "failed",
          detail: "wrong password",
        });
        setBusy(false);
        return setError("Wrong password. Try again or reset it.");
      }
      addLog({
        event: "Login attempt",
        identifier: identifier.trim(),
        outcome: "success",
        detail: "signed in with password",
      });
      setSession(user);
      navigate("/reels");
    } catch (err) {
      setBusy(false);
      setError(err.message || "Something went wrong.");
    }
  }

  async function handleGoogle() {
    // In production this would redirect to Google's real OAuth consent screen
    // (accounts.google.com). Google returns a verified profile to us -- it
    // never shares the user's Google password with this app. For the demo we
    // simulate that successful round-trip.
    setError("");
    setBusy(true);
    try {
      const email =
        window.prompt(
          "Google OAuth (demo): which Google account should sign in?\n\n" +
            "In the real app Google shows its own secure screen and sends us " +
            "back only a verified profile -- never your Google password."
        ) || "";
      if (!email.trim()) {
        setBusy(false);
        return;
      }
      let user = findUser(email.trim());
      if (!user) {
        user = await createUser({
          email: email.trim(),
          provider: "google",
          name: email.split("@")[0],
        });
      }
      addLog({
        event: "Login attempt",
        identifier: email.trim(),
        outcome: "success",
        detail: "signed in with Google (OAuth)",
      });
      setSession(user);
      navigate("/reels");
    } catch (err) {
      setBusy(false);
      setError(err.message || "Google sign-in failed.");
    }
  }

  async function submitSignup(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!suEmail.trim() && !suPhone.trim())
        throw new Error("Enter an email or phone number.");
      if (!suPass || suPass.length < 6)
        throw new Error("Choose a password of at least 6 characters.");
      const user = await createUser({
        name: suName,
        email: suEmail,
        phone: suPhone,
        password: suPass,
      });
      addLog({
        event: "Account created",
        identifier: suEmail.trim() || suPhone.trim(),
        outcome: "success",
        detail: "new account registered",
      });
      setSession(user);
      navigate("/reels");
    } catch (err) {
      setBusy(false);
      setError(err.message || "Could not create account.");
    }
  }

  const avatarLetter = (identifier.trim()[0] || "?").toUpperCase();

  return (
    <div className="dj-screen">
      <div className="dj-auth-wrap">
        <div className="dj-auth-card">
          <div className="dj-brand">
            <div className="dj-logo">daily_jobs</div>
            <div className="dj-tagline">Reels &amp; shorts for job seekers</div>
          </div>

          {error && <div className="dj-error">{error}</div>}

          {/* STEP 1 — identifier */}
          {step === "identifier" && (
            <form onSubmit={goToPassword}>
              <div className="dj-auth-title">Sign in</div>
              <div className="dj-auth-sub">
                Use your email or phone to continue
              </div>
              <input
                className="dj-field"
                type="text"
                autoFocus
                placeholder="Email or phone number"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <button className="dj-btn dj-btn-primary" type="submit">
                Next
              </button>

              <div className="dj-center">
                <Link className="dj-link" to="/forgot-password">
                  Forgotten password?
                </Link>
              </div>

              <div className="dj-divider">or</div>

              <button
                type="button"
                className="dj-google-btn"
                onClick={handleGoogle}
                disabled={busy}
              >
                <GoogleG className="dj-google-g" />
                Continue with Google
              </button>

              <div className="dj-center" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="dj-link"
                  onClick={() => {
                    setError("");
                    setStep("signup");
                  }}
                >
                  Create new account
                </button>
              </div>
            </form>
          )}

          {/* STEP 2 — password (branded as daily_jobs, not Google) */}
          {step === "password" && (
            <form onSubmit={submitPassword}>
              <div className="dj-auth-title">Welcome back</div>
              <div className="dj-auth-sub">Enter your password to continue</div>

              <div className="dj-identity">
                <span className="dj-avatar">{avatarLetter}</span>
                <span>{identifier.trim()}</span>
              </div>

              <input
                className="dj-field"
                type="password"
                autoFocus
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="dj-btn dj-btn-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>

              <div className="dj-center">
                <Link className="dj-link" to="/forgot-password">
                  Forgotten password?
                </Link>
              </div>
              <div className="dj-center" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="dj-link"
                  onClick={() => {
                    setPassword("");
                    setError("");
                    setStep("identifier");
                  }}
                >
                  ← Use a different account
                </button>
              </div>
            </form>
          )}

          {/* SIGN UP */}
          {step === "signup" && (
            <form onSubmit={submitSignup}>
              <div className="dj-auth-title">Create account</div>
              <div className="dj-auth-sub">
                It only takes a minute. Accounts are stored in your browser for
                this demo.
              </div>
              <input
                className="dj-field"
                placeholder="Full name"
                value={suName}
                onChange={(e) => setSuName(e.target.value)}
              />
              <input
                className="dj-field"
                placeholder="Email address"
                type="email"
                value={suEmail}
                onChange={(e) => setSuEmail(e.target.value)}
              />
              <input
                className="dj-field"
                placeholder="Phone number (optional)"
                value={suPhone}
                onChange={(e) => setSuPhone(e.target.value)}
              />
              <input
                className="dj-field"
                placeholder="Password (min 6 characters)"
                type="password"
                value={suPass}
                onChange={(e) => setSuPass(e.target.value)}
              />
              <button
                className="dj-btn dj-btn-green"
                type="submit"
                disabled={busy}
              >
                {busy ? "Creating…" : "Sign up"}
              </button>
              <div className="dj-center" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="dj-link"
                  onClick={() => {
                    setError("");
                    setStep("identifier");
                  }}
                >
                  ← Back to sign in
                </button>
              </div>
            </form>
          )}

          <p className="dj-note">
            Demo note: this is a UI prototype. Passwords are stored only as a
            salted hash in your browser, and sign-in attempts are logged without
            the password itself.
          </p>
        </div>
      </div>
    </div>
  );
}
