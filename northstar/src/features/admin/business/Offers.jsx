import { useState } from "react";
import { Plus } from "lucide-react";
import {
  API,
  date,
  label,
  money,
  useAdminData,
  useDirectory,
} from "../operations/data.js";
import {
  DirectoryHeader,
  Stats,
  Pager,
  SearchBox,
  Modal,
} from "../operations/shared.jsx";
import "./business.css";
const localDate = (value) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
function OfferForm({ offer, close, saved }) {
  const [type, setType] = useState(offer?.discountType || "percentage"),
    [scope, setScope] = useState(offer?.scope || "all"),
    [targetId, setTargetId] = useState(offer?.targetId || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const { data: targets, error: targetError } = useAdminData(
    `/admin/offers/targets?scope=${scope}&search=${encodeURIComponent(search)}`,
  );
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      const body = {
        name: f.get("name"),
        description: f.get("description"),
        scope,
        targetId: scope === "all" ? null : f.get("targetId"),
        discountType: type,
        discountValue: Math.round(
          Number(f.get("value")) * (type === "fixed" ? 100 : 1),
        ),
        startDate: new Date(f.get("startDate")).toISOString(),
        expiryDate: new Date(f.get("expiryDate")).toISOString(),
        isActive: f.get("active") === "on",
      };
      if (offer)
        await API.patch(`/admin/offers/${offer.id}`, {
          ...body,
          version: offer.version,
        });
      else await API.post("/admin/offers", body);
      saved();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  const choices = targets?.targets || [];
  return (
    <Modal
      title={offer ? "Edit campaign" : "Add campaign"}
      subtitle="Automatic discounts on product pages, in the cart and at checkout."
      close={() => !busy && close()}
      wide
    >
      <form className="ops-modal-body" onSubmit={save}>
        <fieldset className="catalog-fields" disabled={busy}>
          <div className="catalog-form-grid">
            <label className="catalog-wide">
              Campaign name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={offer?.name || ""}
              />
            </label>
            <label className="catalog-wide">
              Description
              <textarea
                name="description"
                maxLength={500}
                defaultValue={offer?.description || ""}
              />
            </label>
            <label>
              Applies to
              <select
                aria-label="Applies to"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setTargetId("");
                  setSearch("");
                }}
              >
                <option value="all">All products</option>
                <option value="product">A product</option>
                <option value="category">A category and its children</option>
              </select>
            </label>
            {scope !== "all" && (
              <>
                <label>
                  Find {scope}
                  <input
                    aria-label="Find campaign target"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name"
                  />
                </label>
                <label className="catalog-wide">
                  Select {scope}
                  <select
                    key={scope}
                    aria-label="Campaign target"
                    name="targetId"
                    required
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    <option value="">Select a {scope}</option>
                    {targetId && !choices.some((t) => t.id === targetId) && (
                      <option key={targetId} value={targetId}>
                        {offer?.targetId === targetId
                          ? offer.targetName || "Saved target"
                          : "Selected target"}
                      </option>
                    )}
                    {choices.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Search to find targets beyond the first 50 results.
                  </small>
                </label>
              </>
            )}
            <label>
              Discount type
              <select
                aria-label="Discount type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount per unit</option>
              </select>
            </label>
            <label>
              {type === "fixed"
                ? "Discount per unit (₹)"
                : "Discount percentage"}
              <input
                key={type}
                name="value"
                required
                type="number"
                min={type === "fixed" ? 0.01 : 1}
                step={type === "fixed" ? 0.01 : 1}
                max={type === "fixed" ? 1000000 : 100}
                defaultValue={
                  offer?.discountType === type
                    ? offer.discountValue / (type === "fixed" ? 100 : 1)
                    : ""
                }
              />
            </label>
            <label>
              Starts at
              <input
                name="startDate"
                type="datetime-local"
                required
                defaultValue={localDate(offer?.startDate || new Date())}
              />
            </label>
            <label>
              Expires at
              <input
                name="expiryDate"
                type="datetime-local"
                required
                defaultValue={
                  offer?.expiryDate ? localDate(offer.expiryDate) : ""
                }
              />
            </label>
            <label className="business-check catalog-wide">
              <input
                name="active"
                type="checkbox"
                defaultChecked={offer?.isActive ?? true}
              />
              Enable campaign
            </label>
          </div>
          <p className="catalog-muted">
            Dates use your local timezone. Only the best offer per item applies.
            Coupons apply to the remaining merchandise amount.
          </p>
          {(error || targetError) && (
            <p role="alert" className="cm-notice cm-error">
              {error || targetError}
            </p>
          )}
          <div className="business-actions">
            <button type="button" className="cm-button" onClick={close}>
              Cancel
            </button>
            <button className="catalog-primary" disabled={busy}>
              {busy ? "Saving…" : "Save campaign"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export default function Offers() {
  const { values, change, clear, query } = useDirectory({
    status: "all",
    sort: "newest",
  });
  const { data, error, refresh } = useAdminData(`/admin/offers?${query}`);
  const [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState("");
  async function toggle(offer) {
    setBusy(true);
    setActionError("");
    try {
      await API.patch(`/admin/offers/${offer.id}/status`, {
        version: offer.version,
        isActive: !offer.isActive,
      });
      setNotice("Campaign updated.");
      refresh();
    } catch (e) {
      setActionError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cm-page catalog-page">
      <DirectoryHeader
        eyebrow="Sales and marketing / Offers and campaigns"
        summary={
          <Stats
            cards={[
              { name: "Total campaigns", value: data?.summary?.total },
              { name: "Active", value: data?.summary?.active },
              { name: "Inactive", value: data?.summary?.inactive },
            ]}
          />
        }
        title="Offers & Campaigns"
        description="Schedule automatic discounts for your existing catalog."
      >
        <button className="catalog-primary" onClick={() => setForm({})}>
          <Plus size={15} />
          Add campaign
        </button>
      </DirectoryHeader>

      {notice && (
        <p role="status" className="cm-notice">
          {notice}
        </p>
      )}
      {(error || actionError) && (
        <p className="cm-notice cm-error" role="alert">
          {error || actionError}
          <button onClick={refresh}>Retry</button>
        </p>
      )}
      <div className="cm-toolbar">
        <SearchBox
          value={values.search}
          onChange={(v) => change("search", v)}
          placeholder="Search campaigns…"
        />
        <label className="cm-filter">
          Status
          <select
            aria-label="Campaign status"
            value={values.status}
            onChange={(e) => change("status", e.target.value)}
          >
            {["all", "active", "scheduled", "expired", "inactive"].map((v) => (
              <option value={v} key={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-filter">
          Sort
          <select
            aria-label="Campaign sort"
            value={values.sort}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="name">Name: A to Z</option>
            <option value="expiry">Expires soonest</option>
          </select>
        </label>
        <button className="cm-clear" onClick={clear}>
          Clear filters
        </button>
        <span className="cm-result-count">
          {data?.pagination.total ?? "—"} campaigns
        </span>
      </div>
      <section className="cm-table-card">
        <div className="cm-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {[
                  "Campaign",
                  "Applies to",
                  "Discount",
                  "Validity",
                  "Status",
                  "Actions",
                ].map((t) => (
                  <th
                    key={t}
                    className={
                      t === "Actions" ? "cm-actions-heading" : undefined
                    }
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.offers.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.name}</strong>
                    <small className="business-block catalog-muted">
                      {o.description}
                    </small>
                  </td>
                  <td>
                    {o.scope === "all"
                      ? "All products"
                      : `${label(o.scope)}: ${o.targetName || "Unavailable target"}`}
                  </td>
                  <td>
                    {o.discountType === "percentage"
                      ? `${o.discountValue}%`
                      : `${money(o.discountValue)} / unit`}
                  </td>
                  <td>
                    {date(o.startDate)} – {date(o.expiryDate)}
                  </td>
                  <td>
                    <span
                      className={`cm-status ${o.status === "active" ? "is-active" : o.status === "scheduled" ? "is-blocked" : "catalog-unlisted"}`}
                    >
                      {label(o.status)}
                    </span>
                  </td>
                  <td>
                    <div className="catalog-row-actions">
                      <button className="cm-button" onClick={() => setForm(o)}>
                        Edit
                      </button>
                      <button
                        className="cm-button"
                        disabled={busy}
                        onClick={() => toggle(o)}
                      >
                        {o.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.offers.length && (
                <tr>
                  <td colSpan={6}>
                    {data
                      ? "No campaigns match these filters."
                      : error
                        ? "Campaigns could not be loaded."
                        : "Loading campaigns…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {form && (
        <OfferForm
          offer={form.id ? form : null}
          close={() => setForm(null)}
          saved={() => {
            setForm(null);
            setNotice("Campaign saved.");
            refresh();
          }}
        />
      )}
    </section>
  );
}
