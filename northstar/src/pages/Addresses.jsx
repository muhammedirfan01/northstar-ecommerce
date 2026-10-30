import { useContext, useEffect, useState } from "react";
import { Link } from "react-router";
import { AuthContext } from "../context/AuthContext.js";
import { addressApi } from "../api/addresses.js";
import AddressForm from "../components/profile/AddressForm.jsx";
import "./addresses.css";

export default function Addresses() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState({ addresses: [], version: 0, maxAddresses: 10 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (user.role !== "customer") return;
    const controller = new AbortController();
    async function loadAddresses() {
      try {
        const result = await addressApi.list(controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadAddresses();
    return () => controller.abort();
  }, [reload, user.role]);

  function reloadAddresses() {
    setLoading(true);
    setError("");
    setLoadError("");
    setEditing(null);
    setDeleting(null);
    setReload(value => value + 1);
  }

  function showError(error) {
    if (error.status === 409) {
      reloadAddresses();
      setMessage("Your addresses changed. We reloaded them. Choose Edit again before saving.");
    } else {
      setError(error.message);
    }
  }

  async function saveAddress(values) {
    setSaving(true);
    setError("");
    try {
      const body = { ...values, version: data.version };
      let result;
      if (editing) result = await addressApi.edit(editing.id, body);
      else result = await addressApi.add(body);
      setData(result);
      setEditing(null);
      setMessage("Your address has been saved.");
      return true;
    } catch (error) {
      showError(error);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(address) {
    setSaving(true);
    setError("");
    try {
      setData(await addressApi.setDefault(address.id, data.version));
      setMessage("Default address updated.");
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress() {
    setSaving(true);
    setError("");
    try {
      setData(await addressApi.remove(deleting.id, data.version));
      setDeleting(null);
      setMessage("Address removed. Any remaining address will keep a default selection.");
    } catch (error) {
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  if (user.role !== "customer") return <main className="addresses-page"><h1>Saved Addresses</h1><p>Saved addresses are available for customer accounts.</p><Link to="/admin">Back to dashboard</Link></main>;
  const full = data.addresses.length >= data.maxAddresses;
  const disabled = loading || saving || Boolean(deleting);

  return (
    <main className="addresses-page">
      <div className="addresses-heading"><div><h1>Saved Addresses</h1><p>Manage your delivery addresses in India.</p></div><Link to="/profile">Back to my profile</Link></div>
      {message && <p className="address-notice" role="status">{message}</p>}
      {loadError && <div className="address-notice address-error" role="alert"><span>{loadError}</span><button className="address-secondary" type="button" onClick={reloadAddresses}>Reload addresses</button></div>}
      {error && <div className="address-notice address-error" role="alert"><span>{error}</span><button className="address-secondary" type="button" disabled={saving} onClick={reloadAddresses}>Reload addresses</button></div>}
      {deleting && <div className="address-notice" role="alert"><span>Remove the {deleting.label} address for {deleting.fullName}?</span><button className="address-secondary" type="button" disabled={saving} autoFocus onClick={() => setDeleting(null)}>Keep address</button><button className="address-danger" type="button" disabled={saving} onClick={removeAddress}>Remove address</button></div>}
      <div className="addresses-grid">
        <section className="addresses-list" aria-labelledby="addresses-list-title" aria-busy={loading}>
          <div className="addresses-list-heading"><h2 id="addresses-list-title">SAVED ADDRESSES ({data.addresses.length})</h2>{editing && <button className="address-text-button" type="button" disabled={disabled || full} onClick={() => setEditing(null)}>Add new</button>}</div>
          {loading && <p className="address-empty" role="status">Loading your addresses…</p>}
          {!loading && !loadError && data.addresses.length === 0 && <div className="address-empty"><h3>No saved addresses yet</h3><p>Add your first address. It will become your default.</p></div>}
          {!loading && !loadError && data.addresses.map(address => (
            <article className="address-card" key={address.id}>
              <div className="address-card-heading"><strong>{address.fullName}</strong>{address.isDefault && <span className="address-default-badge">DEFAULT</span>}<span className="address-type">{address.label}</span></div>
              <address>{address.addressLine1}<br />{address.addressLine2 && <>{address.addressLine2}<br /></>}{address.city}, {address.state} {address.postalCode}<br />Mobile: {address.phoneNumber}</address>
              <div className="address-card-actions">
                {address.isDefault && <span className="address-default-note">Default address</span>}
                {!address.isDefault && <button className="address-text-button" type="button" disabled={disabled || Boolean(editing)} onClick={() => makeDefault(address)}>Set as default</button>}
                <div><button className="address-text-button" type="button" disabled={disabled} aria-label={`Edit ${address.label} address for ${address.fullName}`} onClick={() => setEditing(address)}>Edit</button><button className="address-text-button address-remove" type="button" disabled={disabled || Boolean(editing)} aria-label={`Remove ${address.label} address for ${address.fullName}`} onClick={() => setDeleting(address)}>Remove</button></div>
              </div>
            </article>
          ))}
          {full && <p className="address-help">You have saved 10 addresses. Remove one before adding another.</p>}
        </section>
        <AddressForm key={`${editing?.id || "new"}:${data.version}`} user={user} address={editing} hasAddresses={data.addresses.length > 0} disabled={disabled || Boolean(loadError) || (!editing && full)} onSave={saveAddress} onCancel={() => setEditing(null)} />
      </div>
    </main>
  );
}
