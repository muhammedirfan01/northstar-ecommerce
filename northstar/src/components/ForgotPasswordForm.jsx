import { useState } from "react";
import { authApi } from "../api/auth.js";

export default function ForgotPasswordForm({ busy, setBusy, onRequested, onLogin }) {
  const [error, setError] = useState("");

  async function requestCode(event) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email").trim();
    setBusy(true);
    setError("");
    try {
      const result = await authApi.requestRecovery({ email });
      onRequested(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className="auth-form" onSubmit={requestCode} aria-busy={busy}>
      <div className="auth-field"><label htmlFor="recovery-email">Email Address</label><input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></div>
      <p className="auth-help">If your account is eligible, we’ll email a code. It expires in 5 minutes.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? "SENDING CODE…" : "SEND RECOVERY CODE"}</button>
    </form>
    <p className="auth-switch"><button className="auth-text-button" type="button" disabled={busy} onClick={onLogin}>Back to Sign In</button></p>
  </>;
}
