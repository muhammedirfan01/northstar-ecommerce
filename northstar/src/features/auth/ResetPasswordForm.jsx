import PasswordInput from "../../components/ui/PasswordInput.jsx";
import { useEffect, useState } from "react";
import API from "../../api/API.js";
export default function ResetPasswordForm({
  recovery,
  busy,
  setBusy,
  onComplete,
  onRestart,
  onLogin,
}) {
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const expired = Date.parse(recovery.resetExpiresAt) <= now;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function resetPassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    const confirmPassword = form.get("confirmPassword");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await API.post("/auth/reset-password", {
        challengeId: recovery.challengeId,
        resetToken: recovery.resetToken,
        password,
        confirmPassword,
      });
      onComplete();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="auth-form" onSubmit={resetPassword} aria-busy={busy}>
        <div className="auth-field">
          <label htmlFor="reset-password">
            New Password (at least 8 characters)
          </label>
          <PasswordInput
            id="reset-password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy || expired}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="reset-confirm-password">Confirm Password</label>
          <PasswordInput
            id="reset-confirm-password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy || expired}
          />
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {expired && (
          <p className="auth-error" role="alert">
            Recovery expired.{" "}
            <button
              className="auth-text-button"
              type="button"
              disabled={busy}
              onClick={onRestart}
            >
              Request a new code
            </button>
          </p>
        )}
        <button
          className="auth-submit"
          type="submit"
          disabled={busy || expired}
        >
          {busy ? "SAVING…" : "SAVE NEW PASSWORD"}
        </button>
      </form>
      <p className="auth-switch">
        <button
          className="auth-text-button"
          type="button"
          disabled={busy}
          onClick={onLogin}
        >
          Back to Sign In
        </button>
      </p>
    </>
  );
}
