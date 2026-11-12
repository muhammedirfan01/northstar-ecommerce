import { otpTiming } from "./otpTiming.js";
import { useEffect, useState } from "react";
import API from "../../api/API.js";
function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function OTPForm({
  challenge,
  purpose,
  busy,
  setBusy,
  onVerified,
  onLogin,
}) {
  const [timing, setTiming] = useState(() => otpTiming(challenge));
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const expiresIn = Math.max(0, Math.ceil((timing.expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((timing.resendAt - now) / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function verifyCode(event) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    setBusy(true);
    setError("");
    try {
      const body = {
        challengeId: challenge.challengeId,
        code,
      };
      let result;
      if (purpose === "recovery") {
        const response = await API.post(
          "/auth/forgot-password/verify-otp",
          body,
        );
        result = response.data.data;
      } else {
        const response = await API.post("/auth/register/verify-otp", body);
        result = response.data.data;
      }
      onVerified(result);
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  async function resendCode() {
    setBusy(true);
    setError("");
    try {
      const body = {
        challengeId: challenge.challengeId,
      };
      let result;
      if (purpose === "recovery") {
        const response = await API.post(
          "/auth/forgot-password/resend-otp",
          body,
        );
        result = response.data.data;
      } else {
        const response = await API.post("/auth/register/resend-otp", body);
        result = response.data.data;
      }
      setTiming(otpTiming(result));
      setNow(Date.now());
    } catch (error) {
      if (error.response?.data?.data?.resendAfter) {
        setTiming({
          ...timing,
          resendAt: Date.now() + error.response?.data?.data.resendAfter * 1000,
        });
      }
      setError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        key={timing.expiresAt}
        className="auth-form"
        onSubmit={verifyCode}
        aria-busy={busy}
      >
        <div className="auth-field">
          <label htmlFor="otp-code">Email verification code</label>
          <input
            id="otp-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            placeholder="6-digit code"
            autoFocus
            required
            disabled={busy || !expiresIn}
          />
        </div>
        <p className="otp-timer" role="status">
          {expiresIn
            ? `Code expires in ${formatTime(expiresIn)}`
            : "Your code has expired. Request a new code."}
        </p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="auth-submit"
          type="submit"
          disabled={busy || !expiresIn}
        >
          {busy ? "PLEASE WAIT…" : "VERIFY & CONTINUE"}
        </button>
      </form>
      <p className="otp-resend">
        <button
          className="auth-text-button"
          type="button"
          disabled={busy || resendIn > 0}
          onClick={resendCode}
        >
          {resendIn ? `Resend in ${resendIn}s` : "Resend OTP"}
        </button>
      </p>
      <button
        className="auth-text-button otp-back"
        type="button"
        disabled={busy}
        onClick={onLogin}
      >
        Back to Sign In
      </button>
    </>
  );
}
