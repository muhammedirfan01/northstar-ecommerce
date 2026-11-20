import { Link } from "react-router";
import PasswordInput from "../../components/ui/PasswordInput.jsx";
import { useState } from "react";
import API from "../../api/API.js";
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
    setBusy(true);
    setError("");
    try {
      const response = await API.post("/auth/register", {
        name: form.get("name").trim(),
        email: form.get("email").trim(),
        password: form.get("password"),
        confirmPassword: form.get("confirmPassword"),
        acceptedTerms: form.get("terms") === "on",
      });
      const result = response.data.data;
      onCreated(result);
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <GoogleSignInButton busy={busy} setBusy={setBusy} onSuccess={onSuccess} />
      <div className="auth-divider">OR CONTINUE WITH EMAIL</div>
      <form className="auth-form" onSubmit={register} aria-busy={busy} noValidate>
        <div className="auth-field">
          <label htmlFor="register-name">Full Name</label>
          <input
            id="register-name"
            name="name"
            autoComplete="name"
            placeholder="e.g. Asha Devi"
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
            placeholder="you@example.com"
            required
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">
            Password (at least 8 characters)
          </label>
          <PasswordInput
            id="register-password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
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
            placeholder="Re-enter your password"
            required
            disabled={busy}
          />
        </div>
        <label className="auth-terms">
          <input
            name="terms"
            type="checkbox"
            required
            disabled={busy}
          />
          <span>I agree to the <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link> &amp; <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</span>
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
