import PasswordInput from "../../components/ui/PasswordInput.jsx";
import { useState } from "react";
import API from "../../api/API.js";
import GoogleSignInButton from "./GoogleSignInButton.jsx";
export default function LoginForm({
  busy,
  setBusy,
  onSuccess,
  onRegister,
  onForgotPassword,
}) {
  const [error, setError] = useState("");
  async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await API.post("/auth/login", {
        email: form.get("email").trim(),
        password: form.get("password"),
      });
      const result = response.data.data;
      onSuccess(result.user);
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
      <form className="auth-form" onSubmit={login} aria-busy={busy} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            disabled={busy}
          />
        </div>
        <button
          className="auth-text-button"
          type="button"
          disabled={busy}
          onClick={onForgotPassword}
        >
          Forgot password?
        </button>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? "SIGNING IN…" : "SIGN IN"}
        </button>
      </form>
      <p className="auth-switch">
        Don’t have an account?{" "}
        <button
          className="auth-text-button"
          type="button"
          disabled={busy}
          onClick={onRegister}
        >
          Sign up
        </button>
      </p>
    </>
  );
}
