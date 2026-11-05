import { useEffect, useId, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import "./signout.css";

export default function AccountRestrictionDialog({ restriction, onContinue }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal();
  }, []);
  async function proceed(signIn) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onContinue(signIn);
    } catch {
      setError("Unable to continue right now. Please try again.");
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className="signout-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={(event) => event.preventDefault()}
    >
      <p className="signout-brand">NORTHSTAR</p>
      <span className="signout-icon"><ShieldAlert size={29} aria-hidden="true" /></span>
      <h2 id={titleId}>{restriction.title}</h2>
      <p className="signout-description" id={descriptionId}>{restriction.message}</p>
      {error && <p className="signout-error" role="alert">{error}</p>}
      <div className="signout-success-actions">
        <button className="signout-primary" type="button" disabled={busy} onClick={() => proceed(false)} autoFocus>
          {busy ? "Please wait…" : "Continue browsing"}
        </button>
        <button className="signout-link" type="button" disabled={busy} onClick={() => proceed(true)}>
          Sign in with another account
        </button>
      </div>
    </dialog>
  );
}
