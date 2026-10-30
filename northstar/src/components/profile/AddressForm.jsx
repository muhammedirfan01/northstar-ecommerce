export default function AddressForm({ user, address, hasAddresses, disabled, onSave, onCancel }) {
  const mustBeDefault = !hasAddresses || address?.isDefault;

  async function submit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const saved = await onSave({
      fullName: form.get("fullName").trim(),
      phoneNumber: form.get("phoneNumber").trim(),
      addressLine1: form.get("addressLine1").trim(),
      addressLine2: form.get("addressLine2").trim(),
      city: form.get("city").trim(),
      state: form.get("state").trim(),
      postalCode: form.get("postalCode").trim(),
      label: form.get("label"),
      isDefault: Boolean(mustBeDefault || form.get("isDefault")),
    });
    if (saved) element.reset();
  }

  return (
    <form className="address-form" id="address-form" onSubmit={submit}>
      <h2>{address ? "EDIT ADDRESS" : "ADD A NEW ADDRESS"}</h2>
      <fieldset disabled={disabled}>
        <label className="address-field address-field-wide"><span>Full name</span><input name="fullName" defaultValue={address?.fullName || user.name} autoComplete="shipping name" minLength={2} maxLength={80} required /></label>
        <label className="address-field address-field-wide"><span>Street address</span><input name="addressLine1" defaultValue={address?.addressLine1 || ""} autoComplete="shipping address-line1" minLength={5} maxLength={160} required /></label>
        <label className="address-field"><span>Apartment / suite (optional)</span><input name="addressLine2" defaultValue={address?.addressLine2 || ""} autoComplete="shipping address-line2" maxLength={100} /></label>
        <label className="address-field"><span>PIN code</span><input name="postalCode" defaultValue={address?.postalCode || ""} autoComplete="shipping postal-code" inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} required /></label>
        <label className="address-field"><span>City</span><input name="city" defaultValue={address?.city || ""} autoComplete="shipping address-level2" minLength={2} maxLength={80} required /></label>
        <label className="address-field"><span>State / union territory</span><input name="state" defaultValue={address?.state || ""} autoComplete="shipping address-level1" minLength={2} maxLength={80} required /></label>
        <label className="address-field"><span>Mobile number</span><input name="phoneNumber" type="tel" defaultValue={address?.phoneNumber || user.phone || ""} autoComplete="shipping tel" maxLength={25} required /></label>
        <label className="address-field"><span>Address type</span><select name="label" defaultValue={address?.label || "Home"}><option>Home</option><option>Work</option><option>Other</option></select></label>
        <label className="address-default-control"><input name="isDefault" type="checkbox" defaultChecked={Boolean(mustBeDefault)} disabled={Boolean(mustBeDefault)} /><span>Default delivery address</span></label>
      </fieldset>
      <div className="address-form-actions">
        <button className="address-primary" type="submit" disabled={disabled}>Save address</button>
        <button className="address-secondary" type="reset" disabled={disabled} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
