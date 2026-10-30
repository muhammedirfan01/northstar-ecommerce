import { useEffect, useId, useRef, useState } from "react";
import { Check, LogOut, X } from "lucide-react";
import ProfileAvatar from "./ProfileAvatar.jsx";
import "./signout.css";

export default function SignOutDialog({ account, stage, onConfirm, onClose, onSignIn }) {
  const dialogRef = useRef(null);
  const continueRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const succeeded = stage === "success";
  const admin = account?.role === "admin";

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal();
  }, []);
  useEffect(() => {
    if (succeeded) continueRef.current?.focus();
  }, [succeeded]);

  function close() {
    if (!busy) dialogRef.current.close();
  }
  function signInAgain() {
    dialogRef.current.close();
    onSignIn();
  }
  async function confirm() {
    if (busy) return;
    setBusy(true); setError("");
    try { await onConfirm(); }
    catch (failure) { setError(failure.message || "Unable to sign out. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <dialog className="signout-dialog" ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
      <button className="signout-close" type="button" aria-label={succeeded ? "Close sign-out message" : "Close sign-out confirmation"} disabled={busy} onClick={close}><X size={19} /></button>
      <p className="signout-brand">NORTHSTAR</p>
      <span className={`signout-icon${succeeded ? " is-success" : ""}`}>{succeeded ? <Check size={29} aria-hidden="true" /> : <LogOut size={27} aria-hidden="true" />}</span>
      <h2 id={titleId}>{succeeded ? "You’re signed out" : admin ? "Sign out of the admin panel?" : "Sign out of Northstar?"}</h2>
      <p className="signout-description" id={descriptionId}>{succeeded ? "You are signed out on this browser. You can sign in again whenever you’re ready." : admin ? "You’ll need to sign in again to access your dashboard and manage the store." : "You’ll need to sign in again to access your profile and saved addresses."}</p>
      {!succeeded && <div className="signout-account"><ProfileAvatar user={account} /><div><strong>{account?.name}</strong><span>{admin ? "Administrator" : "Northstar account"}</span></div></div>}
      {error && <p className="signout-error" role="alert">{error}</p>}
      {succeeded ? <div className="signout-success-actions"><button className="signout-primary" type="button" ref={continueRef} onClick={close}>Continue to homepage</button><button className="signout-link" type="button" onClick={signInAgain}>Sign in again</button></div> : <div className="signout-actions"><button className="signout-secondary" type="button" disabled={busy} onClick={close} autoFocus>Stay signed in</button><button className="signout-primary" type="button" disabled={busy} onClick={confirm}>{busy ? "Signing out…" : error ? "Try signing out again" : "Sign out"}</button></div>}
    </dialog>
  );
}
