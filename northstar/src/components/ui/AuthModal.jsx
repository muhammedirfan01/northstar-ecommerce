import { useEffect, useRef, useState } from "react";
import LoginForm from "../../features/auth/LoginForm.jsx";
import RegisterForm from "../../features/auth/RegisterForm.jsx";
import ForgotPasswordForm from "../../features/auth/ForgotPasswordForm.jsx";
import ResetPasswordForm from "../../features/auth/ResetPasswordForm.jsx";
import OTPForm from "../../features/auth/OTPForm.jsx";
const titles = {
  login: "Welcome Back",
  register: "Create Account",
  otp: "Verify Your OTP",
  forgot: "Reset Password",
  reset: "Set New Password",
};

// Controls the form shown inside the authentication popup.
export default function AuthModal({
  accountMessage,
  onClose,
  onAuthenticated,
  initialView = "login",
}) {
  const dialogRef = useRef(null);
  // view is the name of the form currently displayed.
  const [view, setView] = useState(initialView);
  // busy is true while a form is waiting for a server response.
  const [busy, setBusy] = useState(false);
  // Keep the information needed for OTP verification and password reset.
  const [challenge, setChallenge] = useState(null);
  const [purpose, setPurpose] = useState("registration");
  const [recovery, setRecovery] = useState(null);
  // Open the native dialog when this component appears.
  useEffect(() => {
    dialogRef.current.showModal();
  }, []);
  function showLogin() {
    setView("login");
  }

  function showRegister() {
    setView("register");
  }

  function showForgotPassword() {
    setView("forgot");
  }

  function handleCancel(event) {
    // Wait for the current request before allowing Escape to close the dialog.
    if (busy) {
      event.preventDefault();
    }
  }

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
      setView("login");
    }
  }
  return (
    <dialog
      className="auth-modal"
      ref={dialogRef}
      onClose={onClose}
      onCancel={handleCancel}
      aria-labelledby="auth-title"
    >
      <div className="auth-modal-content">
        <button
          className="auth-close"
          type="button"
          aria-label="Close authentication"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="auth-title">{titles[view]}</h2>
        {accountMessage && <p className="auth-error" role="alert">{accountMessage}</p>}
        {view === "login" && (
          <LoginForm
            busy={busy}
            setBusy={setBusy}
            onSuccess={signedIn}
            onRegister={showRegister}
            onForgotPassword={showForgotPassword}
          />
        )}
        {view === "register" && (
          <RegisterForm
            busy={busy}
            setBusy={setBusy}
            onSuccess={signedIn}
            onCreated={registrationStarted}
            onLogin={showLogin}
          />
        )}
        {view === "forgot" && (
          <ForgotPasswordForm
            busy={busy}
            setBusy={setBusy}
            onRequested={recoveryStarted}
            onLogin={showLogin}
          />
        )}
        {view === "otp" && (
          <OTPForm
            key={challenge.challengeId}
            challenge={challenge}
            purpose={purpose}
            busy={busy}
            setBusy={setBusy}
            onVerified={codeVerified}
            onLogin={showLogin}
          />
        )}
        {view === "reset" && (
          <ResetPasswordForm
            recovery={recovery}
            busy={busy}
            setBusy={setBusy}
            onComplete={showLogin}
            onRestart={showForgotPassword}
            onLogin={showLogin}
          />
        )}
      </div>
    </dialog>
  );
}
