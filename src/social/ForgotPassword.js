import React, { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { findUser, setPassword, addLog } from "./storage";

// Reset flow: (1) enter email/phone, (2) type the OTP we "sent",
// (3) choose a new password. The OTP is generated client-side for the demo
// and shown on screen; in production your server emails/SMSes it instead.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("identifier"); // identifier | otp | reset | done
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sentOtp, setSentOtp] = useState("");
  const [newPass, setNewPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const boxes = useRef([]);

  function sendOtp(e) {
    e.preventDefault();
    setError("");
    const value = identifier.trim();
    if (!value) return setError("Enter your email or phone number.");
    if (!findUser(value)) {
      addLog({
        event: "Password reset",
        identifier: value,
        outcome: "failed",
        detail: "reset requested for unknown account",
      });
      return setError("No account found for that email or phone.");
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentOtp(code);
    addLog({
      event: "Password reset",
      identifier: value,
      outcome: "success",
      detail: "one-time code issued",
    });
    setStep("otp");
  }

  function handleOtpChange(i, v) {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5 && boxes.current[i + 1]) boxes.current[i + 1].focus();
  }

  function verifyOtp(e) {
    e.preventDefault();
    setError("");
    if (otp.join("") !== sentOtp)
      return setError("That code is not correct. Check and try again.");
    setStep("reset");
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    if (!newPass || newPass.length < 6)
      return setError("Choose a password of at least 6 characters.");
    setBusy(true);
    try {
      await setPassword(identifier.trim(), newPass);
      addLog({
        event: "Password reset",
        identifier: identifier.trim(),
        outcome: "success",
        detail: "password changed via reset",
      });
      setStep("done");
    } catch (err) {
      setError(err.message || "Could not reset password.");
    }
    setBusy(false);
  }

  return (
    <div className="dj-screen">
      <div className="dj-auth-wrap">
        <div className="dj-auth-card">
          <div className="dj-brand">
            <div className="dj-logo">daily_jobs</div>
          </div>

          {error && <div className="dj-error">{error}</div>}

          {step === "identifier" && (
            <form onSubmit={sendOtp}>
              <div className="dj-auth-title">Find your account</div>
              <div className="dj-auth-sub">
                Enter the email or phone linked to your account and we'll send a
                one-time code.
              </div>
              <input
                className="dj-field"
                autoFocus
                placeholder="Email or phone number"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <button className="dj-btn dj-btn-primary" type="submit">
                Send code
              </button>
              <div className="dj-center" style={{ marginTop: 14 }}>
                <Link className="dj-link" to="/login">
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp}>
              <div className="dj-auth-title">Enter the code</div>
              <div className="dj-auth-sub">
                We sent a 6-digit code to {identifier.trim()}.
              </div>
              <div className="dj-otp-row">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (boxes.current[i] = el)}
                    className="dj-otp-box"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    autoFocus={i === 0}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                  />
                ))}
              </div>
              <div className="dj-otp-demo">
                Demo code (normally sent by SMS/email): <b>{sentOtp}</b>
              </div>
              <button className="dj-btn dj-btn-primary" type="submit">
                Verify
              </button>
              <div className="dj-center" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="dj-link"
                  onClick={() => setStep("identifier")}
                >
                  ← Use a different account
                </button>
              </div>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={resetPassword}>
              <div className="dj-auth-title">Choose a new password</div>
              <div className="dj-auth-sub">
                Pick something you haven't used before.
              </div>
              <input
                className="dj-field"
                type="password"
                autoFocus
                placeholder="New password (min 6 characters)"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
              <button
                className="dj-btn dj-btn-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Saving…" : "Reset password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div>
              <div className="dj-success">
                Your password has been reset. You can sign in now.
              </div>
              <button
                className="dj-btn dj-btn-primary"
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
