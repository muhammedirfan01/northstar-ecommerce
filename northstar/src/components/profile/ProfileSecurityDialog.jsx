import PasswordInput from "../PasswordInput.jsx";
import { useEffect, useRef, useState } from "react";
import { profileApi } from "../../api/profile.js";

export default function ProfileSecurityDialog({ kind, user, onUpdated, onClose }) {
  const dialogRef = useRef(null);
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const emailChange = kind === "email";
  const expiresIn = challenge ? Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000)) : 0;
  const resendIn = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0;
  let title = emailChange ? "Update email address" : "Change password";
  if (challenge) title = "Verify Your OTP";

  useEffect(() => { dialogRef.current.showModal(); }, []);
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  function receivedCode(result) {
    setChallenge({ ...result, resendAt: Date.now() + result.resendAfter * 1000 });
    setNow(Date.now());
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!challenge && !emailChange && form.get("newPassword") !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let result;
      if (!challenge) {
        if (emailChange) {
          const body = { newEmail: form.get("newEmail") };
          if (user.hasPassword) body.currentPassword = form.get("currentPassword");
          result = await profileApi.requestEmail(body);
        } else {
          result = await profileApi.requestPasswordCode({ newPassword: form.get("newPassword"), confirmPassword: form.get("confirmPassword") });
        }
        receivedCode(result);
      } else {
        if (emailChange) {
          result = await profileApi.verifyEmail({ challengeId: challenge.challengeId, currentCode: form.get("currentCode"), newCode: form.get("newCode") });
        } else {
          result = await profileApi.changePassword({ challengeId: challenge.challengeId, code: form.get("code") });
        }
        onUpdated(result.user, emailChange ? "Your email has been updated." : "Your password has been updated.");
        onClose();
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setError("");
    try {
      receivedCode(await profileApi.resend(challenge.challengeId));
    } catch (error) {
      if (error.data?.resendAfter) setChallenge({ ...challenge, resendAt: Date.now() + error.data.resendAfter * 1000 });
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog className="account-security-dialog" ref={dialogRef} aria-labelledby="security-title" onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
      <form key={challenge?.expiresAt || kind} onSubmit={submit} aria-busy={busy}>
        <button className="account-dialog-close" type="button" aria-label="Close settings" disabled={busy} onClick={onClose}>×</button>
        <h2 id="security-title">{title}</h2>
        {!challenge && <p>We’ll email verification codes before saving this change.</p>}
        <fieldset className="account-security-fields" disabled={busy}>
          {!challenge && emailChange && <>
            <label>Current email<input type="email" value={user.email} readOnly /></label>
            <label>New email<input type="email" name="newEmail" autoComplete="email" maxLength={254} required /></label>
            {user.hasPassword && <>
              <label htmlFor="current-password">Current password</label>
              <PasswordInput id="current-password" name="currentPassword" autoComplete="current-password" maxLength={128} required />
            </>}
          </>}
          {!challenge && !emailChange && <>
            <label htmlFor="new-password">New password (at least 8 characters)</label><PasswordInput id="new-password" name="newPassword" autoComplete="new-password" minLength={8} maxLength={128} required />
            <label htmlFor="confirm-password">Confirm new password</label><PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" minLength={8} maxLength={128} required />
          </>}
          {challenge && emailChange && <>
            <label>Code from your current email<input name="currentCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
            <label>Code from your new email<input name="newCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
          </>}
          {challenge && !emailChange && <label>Email verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>}
        </fieldset>
        {challenge && <p role="status">{expiresIn ? `Code expires in ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")}` : "Your code has expired. Request a new code."}</p>}
        {error && <p className="account-form-error" role="alert">{error}</p>}
        <button className="account-primary" type="submit" disabled={busy || Boolean(challenge && !expiresIn)}>{busy ? "Please wait…" : challenge ? "Verify & save" : "Send verification code"}</button>
        {challenge && <button className="account-dialog-cancel" type="button" onClick={resendCode} disabled={busy || resendIn > 0}>{resendIn ? `Resend in ${resendIn}s` : "Resend verification code"}</button>}
        <button className="account-dialog-cancel" type="button" disabled={busy} onClick={onClose}>Cancel</button>
      </form>
    </dialog>
  );
}

