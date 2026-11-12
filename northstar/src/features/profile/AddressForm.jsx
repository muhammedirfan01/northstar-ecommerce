import { useEffect, useId, useState } from "react";
import API from "../../api/API.js";
import "../customer/customer.css";
export default function AddressForm({
  user,
  address,
  hasAddresses,
  disabled,
  onSave,
  onCancel,
}) {
  const [pin, setPin] = useState(address?.postalCode || "");
  const cityOptions = useId();
  const [city, setCity] = useState(address?.city || "");
  const [state, setState] = useState(address?.state || "");
  const [postal, setPostal] = useState(null),
    [postalError, setPostalError] = useState("");
  const [retry, setRetry] = useState(0);
  const validPin = /^[1-9][0-9]{5}$/.test(pin);
  useEffect(() => {
    if (!validPin) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      API.get(`/addresses/postal/${pin}`, { signal: controller.signal })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          const districts = data.data.districts || [];
          const nextState = data.data.states?.[0] || data.data.state || "";
          if (!districts.length || !nextState) throw new Error("PIN lookup did not return city and state details.");
          setPostal({ ...data.data, pin });
          setState(nextState);
          setCity((current) => districts.find((district) => district.trim().toLowerCase() === current.trim().toLowerCase()) || districts[0]);
          setPostalError("");
        })
        .catch((failure) => {
          if (!controller.signal.aborted)
            setPostalError(
              failure.response?.data?.message ||
                "PIN lookup is unavailable. Please try again.",
            );
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pin, validPin, retry]);
  const postalReady =
    postal?.pin === pin && postal.districts?.some((district) => district.trim().toLowerCase() === city.trim().toLowerCase());
  const mustBeDefault = !hasAddresses || address?.isDefault;
  async function submit(event) {
    event.preventDefault();
    if (!postalReady) return;
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
    if (saved) {
      element.reset();
      setCity("");
      setPin("");
      setState("");
      setPostal(null);
    }
  }
  return (
    <form className="address-form" id="address-form" onSubmit={submit}>
      <h2>{address ? "EDIT ADDRESS" : "ADD A NEW ADDRESS"}</h2>
      <fieldset disabled={disabled}>
        <label className="address-field address-field-wide">
          <span>Full name</span>
          <input
            name="fullName"
            defaultValue={address?.fullName || user.name}
            autoComplete="shipping name"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label className="address-field address-field-wide">
          <span>Street address</span>
          <input
            name="addressLine1"
            defaultValue={address?.addressLine1 || ""}
            autoComplete="shipping address-line1"
            minLength={5}
            maxLength={160}
            required
          />
        </label>
        <label className="address-field">
          <span>Apartment / suite (optional)</span>
          <input
            name="addressLine2"
            defaultValue={address?.addressLine2 || ""}
            autoComplete="shipping address-line2"
            maxLength={100}
          />
        </label>
        <label className="address-field">
          <span>PIN code</span>
          <input
            name="postalCode"
            value={pin}
            onChange={(event) => {
              const nextPin = event.target.value.replace(/\D/g, "").slice(0, 6);
              if (nextPin === pin) return;
              setPin(nextPin);
              setCity("");
              setState("");
              setPostal(null);
              setPostalError("");
            }}
            autoComplete="shipping postal-code"
            inputMode="numeric"
            pattern="[1-9][0-9]{5}"
            maxLength={6}
            required
          />
        </label>
        <label className="address-field">
          <span>City</span>
          <input
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            list={cityOptions}
            autoComplete="shipping address-level2"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <datalist id={cityOptions}>
          {(postal?.pin === pin ? postal.districts : []).map(
            (name) => (
              <option key={name} value={name} />
            ),
          )}
        </datalist>
        <label className="address-field">
          <span>State / union territory</span>
          <input
            name="state"
            value={state}
            readOnly
            title="Filled from your PIN code"
            autoComplete="shipping address-level1"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <div className="postal-notice" role={postalError ? "alert" : "status"}>
          {postalError ? (
            <>
              {postalError}{" "}
              <button
                type="button"
                onClick={() => {
                  setPostalError("");
                  setRetry((n) => n + 1);
                }}
              >
                Retry lookup
              </button>
            </>
          ) : postal?.pin === pin ? (
            <>
              PIN {pin}:{" "}
              {(postal.districts).slice(0, 4).join(", ")}.
              {postalReady
                ? " City and state filled from your PIN code."
                : " Choose a district returned for this PIN code from the suggestions."}
            </>
          ) : validPin ? (
            "Checking PIN code…"
          ) : (
            "Enter a six-digit PIN code to fill your city and state."
          )}
        </div>
        <label className="address-field">
          <span>Mobile number</span>
          <input
            name="phoneNumber"
            type="tel"
            defaultValue={address?.phoneNumber || user.phone || ""}
            autoComplete="shipping tel"
            maxLength={25}
            required
          />
        </label>
        <label className="address-field">
          <span>Address type</span>
          <select name="label" defaultValue={address?.label || "Home"}>
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </label>
        <label className="address-default-control">
          <input
            name="isDefault"
            type="checkbox"
            defaultChecked={Boolean(mustBeDefault)}
            disabled={Boolean(mustBeDefault)}
          />
          <span>Default delivery address</span>
        </label>
      </fieldset>
      <div className="address-form-actions">
        <button
          className="address-primary"
          type="submit"
          disabled={disabled || !postalReady}
        >
          Save address
        </button>
        <button
          className="address-secondary"
          type="reset"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
