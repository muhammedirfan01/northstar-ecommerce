import { useState } from "react";
import { API, useAdminData } from "../operations/data.js";
import { DirectoryHeader } from "../operations/shared.jsx";
import "./business.css";

function SettingsForm({ settings, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await API.patch("/admin/settings", {
        version: settings.version,
        storeName: form.get("storeName"),
        supportEmail: form.get("supportEmail"),
        supportPhone: form.get("supportPhone"),
        invoiceAddress: form.get("invoiceAddress"),
        shippingChargePaise: Math.round(Number(form.get("shipping")) * 100),
        freeShippingAbovePaise:
          form.get("threshold") === ""
            ? null
            : Math.round(Number(form.get("threshold")) * 100),
        taxBasisPoints: settings.taxBasisPoints,
        codEnabled: settings.codEnabled,
        onlineEnabled: settings.onlineEnabled,
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="business-settings">
      <fieldset className="catalog-fields" disabled={busy}>
        <section className="catalog-card business-card">
          <h2>Store information</h2>

          <div className="catalog-form-grid">
            <label>
              Store name
              <input
                name="storeName"
                required
                maxLength={100}
                defaultValue={settings.storeName}
              />
            </label>
            <label>
              Support email
              <input
                name="supportEmail"
                type="email"
                maxLength={200}
                defaultValue={settings.supportEmail}
              />
            </label>
            <label>
              Support phone
              <input
                name="supportPhone"
                maxLength={30}
                defaultValue={settings.supportPhone}
              />
            </label>
            <label className="catalog-wide">
              Store address
              <textarea
                name="invoiceAddress"
                maxLength={500}
                rows={2}
                defaultValue={settings.invoiceAddress}
              />
            </label>
          </div>
        </section>
        <section className="catalog-card business-card">
          <h2>Checkout & delivery</h2>
          <p>Set the delivery charge and optional free-delivery minimum.</p>
          <div className="catalog-form-grid">
            <label>
              Delivery charge (₹)
              <input
                name="shipping"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                defaultValue={settings.shippingChargePaise / 100}
              />
            </label>
            <label>
              Free delivery above (₹, optional)
              <input
                name="threshold"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                defaultValue={
                  settings.freeShippingAbovePaise === null
                    ? ""
                    : settings.freeShippingAbovePaise / 100
                }
              />
            </label>
          </div>
        </section>
        {error && (
          <p className="cm-notice cm-error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-save-row">
          <button className="catalog-primary" disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export default function Settings() {
  const { data, error, refresh } = useAdminData("/admin/settings", false);
  const [notice, setNotice] = useState("");
  return (
    <section className="cm-page catalog-page admin-settings">
      <DirectoryHeader
        title="Settings"
        description="Manage your store contact details and delivery charges."
      />
      {notice && (
        <p className="cm-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="cm-notice cm-error" role="alert">
          {error}
          <button onClick={refresh}>Retry</button>
        </p>
      )}
      {data ? (
        <SettingsForm
          key={data.settings.version}
          {...data}
          onSaved={() => {
            setNotice("Settings saved.");
            refresh();
          }}
        />
      ) : (
        !error && <p role="status">Loading settings…</p>
      )}
    </section>
  );
}
