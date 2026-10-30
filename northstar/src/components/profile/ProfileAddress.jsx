import { useEffect, useState } from "react";
import { Link } from "react-router";
import { addressApi } from "../../api/addresses.js";

export default function ProfileAddress() {
  const [addresses, setAddresses] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAddress() {
      try {
        const result = await addressApi.list(controller.signal);
        if (!controller.signal.aborted) setAddresses(result.addresses);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      }
    }
    loadAddress();
    return () => controller.abort();
  }, [reload]);

  function tryAgain() {
    setError("");
    setReload(value => value + 1);
  }

  const address = addresses?.find(item => item.isDefault);
  return (
    <section className="account-address" aria-labelledby="profile-address-heading">
      <div className="account-address-heading"><h2 id="profile-address-heading">Default address</h2><Link to="/addresses">Manage addresses →</Link></div>
      {error && <p role="alert">{error} <button type="button" onClick={tryAgain}>Try again</button></p>}
      {!error && !addresses && <p role="status">Loading your address…</p>}
      {!error && addresses && !address && <p>No saved address yet. <Link to="/addresses">Add an address</Link></p>}
      {!error && address && <address><strong>{address.fullName}</strong><span>{address.addressLine1}</span>{address.addressLine2 && <span>{address.addressLine2}</span>}<span>{address.city}, {address.state} {address.postalCode}</span><span>{address.phoneNumber}</span></address>}
    </section>
  );
}
