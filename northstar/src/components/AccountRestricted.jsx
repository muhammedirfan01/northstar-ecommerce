import { useState } from "react";
import { ShieldX } from "lucide-react";
import "./account-restricted.css";

export default function AccountRestricted({ restriction, onCheck, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(callback) {
    setBusy(true);
    setMessage("");
    try { setMessage(await callback() || ""); }
    catch (error) { setMessage(error.message || "Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  const deleted = restriction.code === "ACCOUNT_DELETED";
  return (
    <main className="account-restricted">
      <div className="account-restricted-card">
        <p className="account-restricted-brand">NORTHSTAR</p>
        <span className="account-restricted-icon"><ShieldX size={32} aria-hidden="true" /></span>
        <h1>{deleted ? "This account has been removed" : "Your account is blocked"}</h1>
        <p>{deleted ? "Your account is no longer available." : "Access to your Northstar account has been temporarily restricted."} Please contact Northstar support if you believe this is a mistake.</p>
        <div className="account-restricted-actions">
          <button type="button" disabled={busy} onClick={() => act(onCheck)}>{busy ? "PLEASE WAIT…" : "CHECK AGAIN"}</button>
          <button type="button" disabled={busy} onClick={() => act(onSignOut)}>Use another account</button>
        </div>
        <p className="account-restricted-message" role="status">{message}</p>
      </div>
    </main>
  );
}
