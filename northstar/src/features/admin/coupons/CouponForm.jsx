import { useState } from "react";
import API from "../../../api/API.js";
import AdminDialog from "../AdminDialog.jsx";
const localDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const rupees = (value) =>
  value === null || value === undefined ? "" : (value / 100).toFixed(2);
export default function CouponForm({ coupon, onClose, onSaved }) {
  const [type, setType] = useState(coupon?.discountType || "percentage"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget),
      paise = (name) => Math.round(Number(form.get(name)) * 100);
    try {
      const body = {
        code:
          coupon?.usedCount > 0
            ? coupon.code
            : String(form.get("code")).trim().toUpperCase(),
        discountType: type,
        discountValue:
          type === "percentage"
            ? Number(form.get("discountValue"))
            : paise("discountValue"),
        minPurchasePaise: paise("minimum"),
        maxDiscountPaise: form.get("maximum") === "" ? null : paise("maximum"),
        usageLimit:
          form.get("usageLimit") === "" ? null : Number(form.get("usageLimit")),
        startDate: new Date(form.get("startDate")).toISOString(),
        expiryDate: new Date(form.get("expiryDate")).toISOString(),
        isActive: form.get("isActive") === "on",
      };
      if (coupon)
        await API.patch(`/admin/coupons/${coupon.id}`, {
          ...body,
          version: coupon.version,
        });
      else await API.post("/admin/coupons", body);
      onSaved();
    } catch (error) {
      setError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminDialog
      title={coupon ? "Edit coupon" : "Add coupon"}
      subtitle="Use your existing Northstar discount rules for future checkouts."
      close={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <form className="ops-modal-body" onSubmit={save}>
        <fieldset className="catalog-fields" disabled={busy}>
          <div className="catalog-form-grid">
            <label className="catalog-wide">
              Coupon code
              <input
                name="code"
                required
                minLength={3}
                maxLength={40}
                pattern={"[A-Za-z0-9_\\-]+"}
                defaultValue={coupon?.code || ""}
                disabled={coupon?.usedCount > 0}
                placeholder="e.g. NORTHSTAR10"
              />
              {coupon?.usedCount > 0 && (
                <small>Used coupon codes are kept for order history.</small>
              )}
            </label>
            <label>
              Discount type
              <select
                aria-label="Discount type"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label>
              {type === "percentage"
                ? "Discount percentage"
                : "Discount amount (₹)"}
              <input
                key={type}
                name="discountValue"
                type="number"
                min={type === "percentage" ? 1 : 0.01}
                max={type === "percentage" ? 100 : 1000000}
                step={type === "percentage" ? 1 : 0.01}
                required
                defaultValue={
                  coupon && coupon.discountType === type
                    ? type === "percentage"
                      ? coupon.discountValue
                      : rupees(coupon.discountValue)
                    : ""
                }
              />
            </label>
            <label>
              Minimum purchase (₹)
              <input
                name="minimum"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                defaultValue={rupees(coupon?.minPurchasePaise ?? 0)}
              />
            </label>
            <label>
              Maximum discount (₹, optional)
              <input
                name="maximum"
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                defaultValue={rupees(coupon?.maxDiscountPaise)}
              />
            </label>
            <label>
              Starts at
              <input
                name="startDate"
                type="datetime-local"
                required
                defaultValue={localDate(coupon?.startDate || new Date())}
              />
            </label>
            <label>
              Expires at
              <input
                name="expiryDate"
                type="datetime-local"
                required
                defaultValue={localDate(coupon?.expiryDate)}
              />
            </label>
            <label className="catalog-wide">
              Total usage limit (optional)
              <input
                name="usageLimit"
                type="number"
                min={Math.max(1, coupon?.usedCount || 0)}
                max="100000000"
                step="1"
                defaultValue={coupon?.usageLimit ?? ""}
              />
              <small>
                Leave blank for unlimited uses.{" "}
                {coupon
                  ? `${coupon.usedCount} uses recorded.`
                  : "Usage is recorded by checkout."}
              </small>
            </label>
            <label className="coupon-check catalog-wide">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={coupon?.isActive ?? true}
              />
              Enable coupon
            </label>
          </div>
        </fieldset>
        {error && (
          <p className="cm-error" role="alert">
            {error}
          </p>
        )}
        <div className="catalog-actions">
          <button
            className="cm-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="catalog-primary" disabled={busy}>
            {busy ? "Saving…" : "Save coupon"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
