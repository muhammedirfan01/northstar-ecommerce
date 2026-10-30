import { useEffect, useRef, useState } from "react";
import { Package, RotateCcw, Wallet, X } from "lucide-react";
import { adminApi } from "../api/admin.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";

export default function CustomerDetails({ customer, onClose }) {
  const dialogRef = useRef(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const account = details || customer;

  // Open the browser's modal dialog when this component appears.
  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDetails() {
      try {
        const result = await adminApi.customer(customer.id, controller.signal);
        if (!controller.signal.aborted) setDetails(result.customer);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadDetails();
    return () => controller.abort();
  }, [customer.id, reload]);

  function tryAgain() {
    setLoading(true);
    setError("");
    setReload(value => value + 1);
  }

  return (
    <dialog className="cm-dialog cm-customer-details" ref={dialogRef} aria-labelledby="customer-details-title" aria-busy={loading} onClose={onClose}>
      <button className="cm-icon-button cm-dialog-close" type="button" aria-label="Close dialog" onClick={() => dialogRef.current.close()}><X size={18} /></button>
      <h2 id="customer-details-title">Customer details</h2>

      <div className="cm-dialog-person">
        <span className="cm-avatar"><ProfileAvatar user={account} /></span>
        <div><strong>{account.name}</strong><span>{account.email}</span></div>
        <span className={`cm-status ${account.isBlocked ? "is-blocked" : "is-active"}`}>{account.isBlocked ? "Blocked" : "Active"}</span>
      </div>

      {loading && <p role="status">Loading customer details…</p>}
      {error && <div className="cm-detail-error" role="alert"><p className="cm-error">{error}</p><button className="cm-button" type="button" onClick={tryAgain}>Try again</button></div>}

      {!loading && !error && details && (
        <>
          <div className="cm-customer-stats">
            <div><Package size={18} aria-hidden="true" /><span>Total orders</span><strong>{details.totalOrders}</strong></div>
            <div><RotateCcw size={18} aria-hidden="true" /><span>Returned orders</span><strong>{details.returnedOrders}</strong></div>
            <div className="cm-wallet-stat"><Wallet size={18} aria-hidden="true" /><span>Wallet balance</span><strong>{((details.walletBalancePaise || 0) / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" })}</strong></div>
          </div>

          <h3 className="cm-section-title">Profile information</h3>
          <dl className="cm-details">
            <div><dt>Customer ID</dt><dd>{details.id}</dd></div>
            <div><dt>Full name</dt><dd>{details.name}</dd></div>
            <div><dt>Email address</dt><dd>{details.email}</dd></div>
            <div><dt>Phone number</dt><dd>{details.phone || "Not provided"}</dd></div>
            <div><dt>Joined date</dt><dd>{new Date(details.createdAt).toLocaleDateString("en-IN", { timeZone: "UTC" })}</dd></div>
            <div><dt>Email verified</dt><dd>{details.isEmailVerified ? "Yes" : "No"}</dd></div>
          </dl>

          <h3 className="cm-section-title">Saved addresses</h3>
          {details.addresses.length === 0 && <p className="cm-address-empty">No saved addresses yet.</p>}
          <div className="cm-addresses">
            {details.addresses.map(address => (
              <article className="cm-address-card" key={address.id}>
                <div className="cm-address-heading"><strong>{address.label || "Address"}</strong>{address.isDefault && <span>Default</span>}</div>
                <address>
                  <strong>{address.fullName}</strong>
                  <span>{address.addressLine1}</span>
                  {address.addressLine2 && <span>{address.addressLine2}</span>}
                  <span>{address.city}, {address.state} {address.postalCode}</span>
                  <span>{address.country === "IN" ? "India" : address.country}</span>
                </address>
                <p>{address.phoneNumber}</p>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="cm-dialog-actions"><button className="cm-button" type="button" onClick={() => dialogRef.current.close()}>Close</button></div>
    </dialog>
  );
}
