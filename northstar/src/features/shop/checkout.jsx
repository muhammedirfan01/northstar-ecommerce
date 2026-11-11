import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { LockKeyhole, MapPin, Plus } from "lucide-react";
import API from "../../api/API.js";
import { money } from "../../utils/money.js";
import { payForOrder, preparePayment } from "../orders/payment.js";
import AddressForm from "../profile/AddressForm.jsx";
import { ProductRow, PriceSummary } from "../orders/PurchaseParts.jsx";
import "../orders/purchase.css";
import "./customer-checkout.css";

export default function Checkout({ updateCart, user }) {
  const [params] = useSearchParams();
  const productId = params.get("productId"), variantId = params.get("variantId"), quantity = params.get("quantity");
  const buyNow = useMemo(() => productId ? { productId, variantId: variantId || null, quantity: Number(quantity) } : null, [productId, variantId, quantity]);
  const [addressData, setAddressData] = useState(null),
    [addressId, setAddressId] = useState("");
  const [editing, setEditing] = useState(null),
    [showForm, setShowForm] = useState(false);
  const [couponCode, setCouponCode] = useState(""),
    [appliedCoupon, setAppliedCoupon] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod"),
    [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false),
    [openingPayment, setOpeningPayment] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [error, setError] = useState(""),
    [paymentError, setPaymentError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestId = useRef(crypto.randomUUID()),
    navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    API.get("/addresses", { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setAddressData(data.data);
        setAddressId(
          data.data.addresses.find((a) => a.isDefault)?.id ||
            data.data.addresses[0]?.id ||
            "",
        );
        setShowForm(!data.data.addresses.length);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || e.message);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!addressId) return;
    const controller = new AbortController();
    API.post(
      "/orders/preview",
      { addressId, couponCode: appliedCoupon, ...(buyNow ? { buyNow } : {}) },
      { signal: controller.signal },
    )
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setQuote({
            ...data.data,
            addressId,
            couponCode: appliedCoupon,
            revision,
            buyNow,
          });
          setError("");
          requestId.current = crypto.randomUUID();
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setQuote(null);
          setError(e.response?.data?.message || e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReviewing(false);
      });
    return () => controller.abort();
  }, [addressId, appliedCoupon, revision, buyNow]);
  function review(e) {
    e.preventDefault();
    setPaymentError("");
    setReviewing(true);
    setQuote(null);
    setAppliedCoupon(couponCode.trim());
    setRevision((n) => n + 1);
  }
  async function saveAddress(values) {
    setBusy(true);
    setError("");
    try {
      const body = { ...values, version: addressData.version };
      const { data } = editing
        ? await API.patch(`/addresses/${editing.id}`, body)
        : await API.post("/addresses", body);
      const next = data.data,
        added = next.addresses.find(
          (a) => !addressData.addresses.some((old) => old.id === a.id),
        );
      setAddressData(next);
      setAddressId(
        editing?.id ||
          added?.id ||
          next.addresses.find((a) => a.isDefault)?.id ||
          next.addresses[0]?.id ||
          "",
      );
      setQuote(null);
      setRevision((n) => n + 1);
      setShowForm(false);
      setEditing(null);
      return true;
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      if (e.response?.status === 409) {
        setQuote(null);
        try {
          const { data } = await API.get("/addresses");
          setAddressData(data.data);
          setShowForm(false);
          setEditing(null);
          const selected =
            data.data.addresses.find((a) => a.id === addressId) ||
            data.data.addresses[0];
          setAddressId(selected?.id || "");
          setRevision((n) => n + 1);
        } catch {
          setError(
            "Your addresses changed and could not be reloaded. Refresh checkout before continuing.",
          );
        }
      }
      return false;
    } finally {
      setBusy(false);
    }
  }
  const currentQuote =
    quote?.addressId === addressId &&
    quote?.couponCode === appliedCoupon &&
    quote?.revision === revision && quote?.buyNow === buyNow
      ? quote
      : null;
  const selectedPayment =
    currentQuote?.paymentMethods?.[paymentMethod] === false
      ? ["cod", "razorpay", "wallet"].find(
          (method) => currentQuote.paymentMethods[method] === true,
        ) || ""
      : paymentMethod;
  async function place() {
    if (busy || !currentQuote || !selectedPayment || showForm || reviewing)
      return;
    setBusy(true);
    setPaymentError("");
    setError("");
    try {
      if (selectedPayment === "razorpay") {
        setOpeningPayment(true);
        await preparePayment();
        setOpeningPayment(false);
      }
      const { data } = await API.post(
        "/orders",
        {
          addressId,
          ...(buyNow ? { buyNow } : {}),
          couponCode: appliedCoupon,
          paymentMethod: selectedPayment,
          expectedTotalPaise: currentQuote.totalAmount,
          requestId: requestId.current,
        },
        { timeout: 30000 },
      );
      if (!buyNow) updateCart?.({ quantityTotal: 0 });
      const order = data.data.order;
      if (selectedPayment === "razorpay") {
        try {
          setOpeningPayment(true);
          await payForOrder(order.id);
        } catch (e) {
          navigate(`/orders/${order.id}/payment/failure`, {
            state: { paymentError: e.response?.data?.message || e.message },
          });
          return;
        }
      }
      navigate(`/orders/${order.id}/payment/success`);
    } catch (e) {
      setPaymentError(e.response?.data?.message || e.message);
      if (e.response?.status === 409) {
        setQuote(null);
        setRevision((n) => n + 1);
      }
    } finally {
      setOpeningPayment(false);
      setBusy(false);
    }
  }
  return (
    <main className="purchase-page checkout-page">
      <header className="checkout-heading">
        <h1>Checkout</h1>
      </header>
      {error && (
        <p className="purchase-alert" role="alert">
          {error}
        </p>
      )}
      <div className="purchase-columns">
        <div className="purchase-stack">
          <section className="purchase-panel">
            <h2>Saved Addresses</h2>
            {!addressData ? (
              <p role="status">Loading addresses…</p>
            ) : addressData.addresses.length === 0 ? (
              <p>Add a delivery address to continue.</p>
            ) : (
              addressData.addresses.map((a) => (
                <div
                  className={`purchase-option ${addressId === a.id ? "is-selected" : ""}`}
                  key={a.id}
                >
                  <input
                    aria-label={`Deliver to ${a.fullName}, ${a.addressLine1}`}
                    type="radio"
                    name="address"
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    disabled={busy}
                  />
                  <div>
                    <b>{a.fullName}</b>
                    {a.isDefault && <small> · DEFAULT ADDRESS</small>}
                    <p>
                      {a.addressLine1}
                      {a.addressLine2 && `, ${a.addressLine2}`}
                      <br />
                      {a.city}, {a.state} — {a.postalCode}
                    </p>
                    <p>Phone: {a.phoneNumber}</p>
                    {addressId === a.id && (
                      <small className="purchase-green">
                        ● DELIVERING TO THIS ADDRESS
                      </small>
                    )}
                  </div>
                  <button
                    className="purchase-text"
                    disabled={busy}
                    onClick={() => {
                      setEditing(a);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
            <button
              className="purchase-text"
              disabled={
                busy ||
                !addressData ||
                addressData.addresses.length >= (addressData.maxAddresses || 10)
              }
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus size={15} />
              Add new delivery address
            </button>
            {showForm && addressData && (
              <AddressForm
                key={`${editing?.id || "new"}:${addressData.version}`}
                user={user || { name: "" }}
                address={editing}
                hasAddresses={addressData.addresses.length > 0}
                disabled={busy}
                onSave={saveAddress}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            )}
            <p>
              <Link to="/addresses" state={{ returnTo: `/checkout?${params}` }}>
                Manage saved addresses
              </Link>
            </p>
          </section>
          <section className="purchase-panel">
            <h2>Payment method</h2>
            <label
              className={`purchase-option ${selectedPayment === "razorpay" ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                checked={selectedPayment === "razorpay"}
                onChange={() => setPaymentMethod("razorpay")}
                disabled={
                  busy || currentQuote?.paymentMethods?.razorpay === false
                }
              />
              <span>
                <b>Pay online with Razorpay</b>
                <p>{currentQuote?.paymentMethods?.razorpay === false
                  ? "Online payment is currently unavailable."
                  : "Pay securely using UPI, cards or netbanking."}</p>
              </span>
            </label>
            <label
              className={`purchase-option ${selectedPayment === "cod" ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                checked={selectedPayment === "cod"}
                onChange={() => setPaymentMethod("cod")}
                disabled={busy || currentQuote?.paymentMethods?.cod === false}
              />
              <span>
                <b>Cash on delivery</b>
                <p>{currentQuote?.paymentMethods?.cod === false
                  ? "Cash on delivery is currently unavailable."
                  : "Pay in cash when your order is delivered."}</p>
              </span>
            </label>
            <label
              className={`purchase-option ${selectedPayment === "wallet" ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                checked={selectedPayment === "wallet"}
                onChange={() => setPaymentMethod("wallet")}
                disabled={busy || !currentQuote?.paymentMethods?.wallet}
              />
              <span>
                <b>Northstar Wallet</b>
                <p className="checkout-wallet-balance">
                  {Number.isSafeInteger(currentQuote?.walletBalancePaise)
                    ? <>Available balance: <strong>{money(currentQuote.walletBalancePaise)}</strong></>
                    : "Select a delivery address to check your wallet balance."}
                </p>
                {Number.isSafeInteger(currentQuote?.walletBalancePaise) && <small>
                  {currentQuote.walletBalancePaise < currentQuote.totalAmount
                    ? "Your balance must cover the full order total."
                    : "Use your wallet balance to pay for this order."}
                </small>}
              </span>
            </label>
            {currentQuote && !selectedPayment && (
              <p role="alert">
                No payment methods are available right now. Please try again
                later.
              </p>
            )}
          </section>
        </div>
        <aside className="purchase-panel purchase-checkout-summary">
          <div className="purchase-section-label">
            <span>
              <MapPin size={15} />
              Order summary
            </span>
            <span>INR</span>
          </div>
          <form onSubmit={review}>
            <label className="purchase-field">
              <span>Voucher</span>
              <div className="purchase-coupon">
                <input
                  aria-label="Coupon code"
                  value={couponCode}
                  maxLength={40}
                  placeholder="ENTER COUPON CODE"
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={busy}
                />
                <button
                  className="purchase-primary"
                  disabled={busy || reviewing}
                >
                  Apply
                </button>
              </div>
            </label>
          </form>
          {appliedCoupon && currentQuote && (
            <p className="purchase-green">
              Coupon: {appliedCoupon}{" "}
              <button
                className="purchase-text"
                disabled={busy}
                onClick={() => {
                  setCouponCode("");
                  setAppliedCoupon("");
                }}
              >
                Remove
              </button>
            </p>
          )}

          {paymentError && (
            <p className="purchase-alert" role="alert">
              {paymentError}
            </p>
          )}
          {busy && selectedPayment === "razorpay" && (
            <p role="status" aria-live="polite">
              {openingPayment
                ? "Preparing the secure Razorpay payment window…"
                : "Creating your order…"}
            </p>
          )}
          {!currentQuote ? (
            <p role="status">
              {error
                ? "Update your details and review the order again."
                : addressId
                  ? "Reviewing current prices and availability…"
                  : "Choose a delivery address to see your order summary."}
            </p>
          ) : (
            <>
              {currentQuote.items.map((item, i) => (
                <ProductRow key={i} item={item} />
              ))}
              <PriceSummary order={currentQuote} />
              <button
                type="button"
                className="purchase-primary purchase-wide"
                disabled={busy || reviewing || showForm || !selectedPayment}
                onClick={place}
              >
                <LockKeyhole size={14} />
                {busy
                  ? openingPayment
                    ? "Opening Razorpay…"
                    : "Placing order…"
                  : selectedPayment === "cod"
                    ? "Place COD order"
                    : selectedPayment === "wallet"
                      ? `Pay with wallet · ${money(currentQuote.totalAmount)}`
                      : `Complete order & pay ${money(currentQuote.totalAmount)}`}
              </button>
              <p>
                <small>
                  Prices and availability are checked again when you place your
                  order.
                </small>
              </p>
            </>
          )}
          <Link
            className="purchase-button purchase-text purchase-wide"
            to="/cart"
          >
            Return to cart
          </Link>
        </aside>
      </div>
    </main>
  );
}
