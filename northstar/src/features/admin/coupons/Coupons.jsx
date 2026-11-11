import { useState } from "react";
import { Plus } from "lucide-react";
import {
  useDirectory,
  useAdminData,
  API,
  money,
  date,
  label,
} from "../operations/data.js";
import { SearchBox, Pager } from "../operations/shared.jsx";
import ConfirmAction from "../ConfirmAction.jsx";
import CouponForm from "./CouponForm.jsx";
import "./coupons.css";
export default function Coupons() {
  const { values, change, clear, query } = useDirectory({
      status: "all",
      sort: "newest",
    }),
    { data, error, refresh } = useAdminData(`/admin/coupons?${query}`);
  const [form, setForm] = useState(null),
    [action, setAction] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState("");
  function ask(coupon, kind) {
    setAction({ coupon, kind });
    setActionError("");
  }
  async function confirm() {
    setBusy(true);
    setActionError("");
    try {
      const { coupon, kind } = action,
        url = `/admin/coupons/${coupon.id}`,
        body = { version: coupon.version };
      if (kind === "delete")
        await API.delete(url, { data: { ...body, confirmDelete: true } });
      else if (kind === "restore") await API.post(url + "/restore", body);
      else
        await API.patch(url + "/status", {
          ...body,
          isActive: !coupon.isActive,
        });
      setAction(null);
      setNotice("Coupon updated.");
      refresh();
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  const summary = data?.summary || {},
    title =
      action?.kind === "delete"
        ? "Delete coupon?"
        : action?.kind === "restore"
          ? "Restore coupon?"
          : action?.coupon.isActive
            ? "Disable coupon?"
            : "Enable coupon?";
  return (
    <section className="cm-page catalog-page coupons-page">
      <p className="cm-breadcrumb">Sales and marketing / Coupons</p>
      <div className="cm-heading">
        <div>
          <h1>Coupons</h1>
          <p>
            Create discount codes and manage their validity, limits and
            availability.
          </p>
        </div>
        <button className="catalog-primary" onClick={() => setForm({})}>
          <Plus size={15} />
          Add coupon
        </button>
      </div>
      <div className="cm-summary coupon-summary">
        <span>
          <strong>{summary.total ?? "—"}</strong> Total coupons
        </span>
        <span className="cm-active-text">● {summary.active ?? "—"} Active</span>
        <span className="cm-blocked-text">
          ● {summary.expired ?? "—"} Expired
        </span>
        <span className="catalog-muted">
          ● {summary.inactive ?? "—"} Disabled
        </span>
      </div>
      {notice && (
        <p className="cm-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="cm-notice cm-error" role="alert">
          {error}
          <button onClick={refresh}>Retry</button>
        </div>
      )}
      <div className="cm-toolbar">
        <SearchBox
          value={values.search}
          onChange={(value) => change("search", value)}
          placeholder="Search coupon codes…"
        />
        <label className="cm-filter">
          Status
          <select
            aria-label="Coupon status"
            value={values.status}
            onChange={(event) => change("status", event.target.value)}
          >
            {[
              "all",
              "active",
              "scheduled",
              "expired",
              "inactive",
              "exhausted",
              "deleted",
            ].map((value) => (
              <option value={value} key={value}>
                {value === "all"
                  ? "All statuses"
                  : value === "exhausted"
                    ? "Usage limit reached"
                    : label(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-filter">
          Sort
          <select
            value={values.sort}
            onChange={(event) => change("sort", event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="code">Code: A to Z</option>
            <option value="expiry">Expires soonest</option>
          </select>
        </label>
        <button className="cm-clear" onClick={clear}>
          Clear filters
        </button>
        <span className="cm-result-count">
          Showing {data?.coupons.length || 0} of {data?.pagination.total || 0}{" "}
          coupons
        </span>
      </div>
      <section className="cm-table-card">
        <div className="cm-table-scroll">
          <table className="cm-table coupon-table">
            <thead>
              <tr>
                {[
                  "Coupon code",
                  "Discount",
                  "Minimum purchase",
                  "Validity",
                  "Usage",
                  "Status",
                  "Actions",
                ].map((value) => (
                  <th key={value}>{value}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <b className="coupon-code">{coupon.code}</b>
                  </td>
                  <td>
                    {coupon.discountType === "percentage"
                      ? `${coupon.discountValue}% off`
                      : money(coupon.discountValue)}
                    {coupon.maxDiscountPaise !== null && (
                      <small>Up to {money(coupon.maxDiscountPaise)}</small>
                    )}
                  </td>
                  <td>{money(coupon.minPurchasePaise)}</td>
                  <td>
                    <span>{date(coupon.startDate)}</span>
                    <small>to {date(coupon.expiryDate)}</small>
                  </td>
                  <td>
                    {coupon.usedCount} / {coupon.usageLimit ?? "Unlimited"}
                  </td>
                  <td>
                    <span
                      className={`cm-status ${coupon.status === "active" ? "is-active" : coupon.status === "expired" || coupon.status === "exhausted" ? "is-blocked" : "catalog-unlisted"}`}
                    >
                      {label(coupon.status)}
                    </span>
                  </td>
                  <td>
                    <div className="coupon-actions">
                      {coupon.deletedAt ? (
                        <button
                          className="cm-button"
                          onClick={() => ask(coupon, "restore")}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            className="cm-button"
                            aria-label={`Edit ${coupon.code}`}
                            onClick={() => setForm(coupon)}
                          >
                            Edit
                          </button>
                          <button
                            className={`cm-button ${coupon.isActive ? "cm-block" : "cm-unblock"}`}
                            onClick={() => ask(coupon, "status")}
                          >
                            {coupon.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="cm-button cm-delete"
                            aria-label={`Delete ${coupon.code}`}
                            onClick={() => ask(coupon, "delete")}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan="7" className="cm-empty">
                    {error ? "Unable to load coupons." : "Loading coupons…"}
                  </td>
                </tr>
              )}
              {data && !data.coupons.length && (
                <tr>
                  <td colSpan="7" className="cm-empty">
                    <h2>No coupons found</h2>
                    <p>Add a coupon or change your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {form && (
        <CouponForm
          key={form.id || "new"}
          coupon={form.id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setNotice("Coupon saved.");
            refresh();
          }}
        />
      )}
      {action && (
        <ConfirmAction
          title={title}
          description={
            action.kind === "delete"
              ? "This code will stop working at checkout. Its record and usage history will be kept, and you can restore it later."
              : action.kind === "restore"
                ? "The coupon's previous enable setting, dates and usage limits will be preserved."
                : "This changes availability for future checkouts. Existing order totals stay the same."
          }
          confirmLabel={
            action.kind === "delete"
              ? "Delete coupon"
              : action.kind === "restore"
                ? "Restore coupon"
                : action.coupon.isActive
                  ? "Disable coupon"
                  : "Enable coupon"
          }
          danger={action.kind === "delete"}
          busy={busy}
          error={actionError}
          onConfirm={confirm}
          onClose={() => {
            if (!busy) setAction(null);
          }}
        />
      )}
    </section>
  );
}
