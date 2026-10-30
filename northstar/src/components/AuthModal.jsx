import { useEffect, useRef, useState } from "react";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm.jsx";
import ForgotPasswordForm from "./ForgotPasswordForm.jsx";
import ResetPasswordForm from "./ResetPasswordForm.jsx";
import OTPForm from "./OTPForm.jsx";

const titles = {
  login: "Welcome Back", register: "Create Account", otp: "Verify Your OTP",
  forgot: "Reset Password", reset: "Set New Password",
  success: "Email Verified Successfully", resetSuccess: "Password Reset Successfully",
};

// This component only chooses which form to display.
export default function AuthModal({ onClose, onAuthenticated, initialView = "login" }) {
  const dialogRef = useRef(null);
  const [view, setView] = useState(initialView);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [purpose, setPurpose] = useState("registration");
  const [recovery, setRecovery] = useState(null);

  useEffect(() => { dialogRef.current.showModal(); }, []);

  function signedIn(user) {
    onClose();
    onAuthenticated(user);
  }

  function registrationStarted(result) {
    setChallenge(result);
    setPurpose("registration");
    setView("otp");
  }

  function recoveryStarted(result) {
    setChallenge(result);
    setPurpose("recovery");
    setRecovery(null);
    setView("otp");
  }

  function codeVerified(result) {
    if (purpose === "recovery") {
      setRecovery(result);
      setView("reset");
    } else {
      setView("success");
    }
  }

  return (
    <dialog className="auth-modal" ref={dialogRef} onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }} aria-labelledby="auth-title">
      <div className="auth-modal-content">
        <button className="auth-close" type="button" aria-label="Close authentication" disabled={busy} onClick={onClose}>×</button>
        <p className="auth-brand">NORTHSTAR</p>
        <h2 id="auth-title">{titles[view]}</h2>
        {view === "login" && <LoginForm busy={busy} setBusy={setBusy} onSuccess={signedIn} onRegister={() => setView("register")} onForgotPassword={() => setView("forgot")} />}
        {view === "register" && <RegisterForm busy={busy} setBusy={setBusy} onSuccess={signedIn} onCreated={registrationStarted} onLogin={() => setView("login")} />}
        {view === "forgot" && <ForgotPasswordForm busy={busy} setBusy={setBusy} onRequested={recoveryStarted} onLogin={() => setView("login")} />}
        {view === "otp" && <OTPForm key={challenge.challengeId} challenge={challenge} purpose={purpose} busy={busy} setBusy={setBusy} onVerified={codeVerified} onLogin={() => setView("login")} />}
        {view === "reset" && <ResetPasswordForm recovery={recovery} busy={busy} setBusy={setBusy} onComplete={() => setView("resetSuccess")} onRestart={() => setView("forgot")} onLogin={() => setView("login")} />}
        {view === "success" && <p role="status">Your account is ready. Sign in to continue.</p>}
        {view === "resetSuccess" && <p role="status">Your password has been updated. Sign in with your new password.</p>}
        {(view === "success" || view === "resetSuccess") && <button className="auth-submit" type="button" onClick={() => setView("login")}>CONTINUE TO SIGN IN →</button>}
      </div>
    </dialog>
  );
}
