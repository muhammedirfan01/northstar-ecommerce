import { nameError } from "../utils/nameValidation.js";
import PasswordInput from "./PasswordInput.jsx";
import { useState } from "react";
import { authApi } from "../api/auth.js";
import GoogleSignInButton from "./GoogleSignInButton.jsx";

export default function RegisterForm({
  busy,
  setBusy,
  onCreated,
  onSuccess,
  onLogin,
}) {
  const [error, setError] = useState("");

  async function register(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    const invalidName = nameError(form.get("name"));
    if (invalidName) { setError(invalidName); return; }
    if (password !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authApi.register({
        name: form.get("name").trim(),
        email: form.get("email").trim(),
        password,
        acceptedTerms: form.get("terms") === "on",
      });
      onCreated(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <GoogleSignInButton busy={busy} setBusy={setBusy} onSuccess={onSuccess} />
      <div className="auth-divider">OR CONTINUE WITH EMAIL</div>
      <form className="auth-form" onSubmit={register} aria-busy={busy}>
        <div className="auth-field">
          <label htmlFor="register-name">Full Name</label>
          <input
            id="register-name"
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="register-email">Email Address</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">Password (at least 8 characters)</label>
          <PasswordInput
            id="register-password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="register-confirm-password">Confirm Password</label>
          <PasswordInput
            id="register-confirm-password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy}
          />
        </div>
        <label className="auth-terms">
          <input name="terms" type="checkbox" required disabled={busy} />
          <span>I agree to the Terms of Service &amp; Privacy Policy.</span>
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? "SENDING CODE…" : "CREATE ACCOUNT"}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account?{" "}
        <button
          className="auth-text-button"
          type="button"
          disabled={busy}
          onClick={onLogin}
        >
          Sign in
        </button>
      </p>
    </>
  );
}
