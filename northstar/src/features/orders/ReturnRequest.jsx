import RequestHistory from "./RequestHistory.jsx";
import { canStartFollowup } from "./requestEligibility.js";
import WalletRefundNotice from "./WalletRefundNotice.jsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Camera, Check, RotateCcw, Wallet, X } from "lucide-react";
import ReplacementProgress from "./ReplacementProgress.jsx";
import CancelReturnButton from "./CancelReturnButton.jsx";
import API from "../../api/API.js";
import { money } from "../../utils/money.js";
import { useCustomerOrder, titleCase } from "./purchaseData.js";
import { ProductRow, DeliveryAddress } from "./PurchaseParts.jsx";
import "./purchase.css";

function Photo({ file, remove }) {
  const image = useRef(null);
  useEffect(() => {
    const href = URL.createObjectURL(file);
    image.current.src = href;
    return () => URL.revokeObjectURL(href);
  }, [file]);
  return (
    <div className="purchase-photo">
      <img ref={image} alt="Selected return evidence" />
      <span>
        {file.name}
        <br />
        <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
      </span>
      <button type="button" aria-label={`Remove ${file.name}`} onClick={remove}>
        <X size={15} />
      </button>
    </div>
  );
}
function Submitted({ order, close }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="purchase-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={dialog}
        className="purchase-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-submitted-title"
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const nodes = [...e.currentTarget.querySelectorAll("button,a[href]")],
            first = nodes[0],
            last = nodes.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <button
          className="purchase-close"
          aria-label="Close confirmation"
          onClick={close}
        >
          <X size={18} />
        </button>
        <div className="purchase-success-icon">
          <Check size={28} />
        </div>
        <h2 id="return-submitted-title">{order.returnRequest.resolution === "replacement" ? "Replacement Request Submitted" : "Return Request Submitted"}</h2>
        <p>
          Your {order.returnRequest.resolution === "replacement" ? "replacement" : "return & refund"} request has been received and is awaiting review.
        </p>
        <WalletRefundNotice order={order} />
        <div className="purchase-muted-box">
          <div className="purchase-section-label">
            Request reference{" "}
            <b>{order.returnRequest.reference || `RET-${order.orderId}`}</b>
          </div>
          <dl className="purchase-prices">
            <dt>Items</dt>
            <dd>{order.items.reduce((n, i) => n + i.quantity, 0)}</dd>
            <dt>Resolution</dt>
            <dd>{order.returnRequest.resolution === "replacement" ? "Replacement" : "Return & refund"}</dd>
            <dt>Order amount</dt>
            <dd>{money(order.totalAmount)}</dd>
            <dt>Pickup location</dt>
            <dd>
              {
                (order.returnRequest.pickupAddress || order.shippingAddress)
                  .city
              }
            </dd>
          </dl>
        </div>
        <ol className="purchase-next-steps">
          <li>
            Inspection & review
            <small>Our team will review your request and evidence.</small>
          </li>
          <li>
            Return coordination
            <small>
              Pickup arrangements follow acceptance of your request.
            </small>
          </li>
          <li>
            {order.returnRequest.resolution === "replacement" ? "Replacement dispatch" : "Refund processing"}
            <small>
              {order.returnRequest.resolution === "replacement" ? "Track replacement dispatch and delivery in your order after the returned goods are received." : "Refund status appears in your order after returned goods are received."}
            </small>
          </li>
        </ol>
        <Link
          className="purchase-button purchase-primary purchase-wide"
          to="/orders"
        >
          My orders
        </Link>
        <Link className="purchase-button purchase-text purchase-wide" to="/">
          Return to homepage
        </Link>
      </section>
    </div>
  );
}
export default function ReturnRequest() {
  const [params, setParams] = useSearchParams();
  const { id } = useParams(),
    { order, setOrder, error } = useCustomerOrder(id);
  const [resolution, setResolution] = useState("refund");
  const [reason, setReason] = useState(""),
    [description, setDescription] = useState(""),
    [photos, setPhotos] = useState([]),
    [addresses, setAddresses] = useState([]),
    [pickupAddressId, setPickupAddressId] = useState("");
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [submitted, setSubmitted] = useState(false);
  const close = useCallback(() => setSubmitted(false), []);
  useEffect(() => {
    const controller = new AbortController();
    API.get("/addresses", { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setAddresses(r.data.data.addresses);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function choosePhotos(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (
      photos.length + files.length > 3 ||
      files.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 5 * 1024 * 1024,
      )
    ) {
      setActionError(
        "Choose up to 3 JPG, PNG or WebP photos, each no larger than 5 MB.",
      );
      return;
    }
    setPhotos((old) => [...old, ...files]);
    setActionError("");
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      const body = {
        resolution,
        ...(canStartFollowup(order) ? { requestCycle: (order.returnRequest.cycle || 1) + 1 } : {}),
        reason,
        description,
        pickupAddressId,
        packagingConfirmed: true,
      };
      let payload = body;
      if (photos.length) {
        payload = new FormData();
        for (const [key, value] of Object.entries(body))
          payload.append(key, String(value));
        photos.forEach((file) => payload.append("photos", file));
      }
      const { data } = await API.post(`/orders/${id}/return`, payload);
      setOrder(data.data.order);
      setParams({}, { replace: true });
      setReason("");
      setDescription("");
      setPhotos([]);
      setResolution("refund");
      setSubmitted(true);
    } catch (e) {
      setActionError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  const existing =
    order?.returnRequest?.status && order.returnRequest.status !== "none" && !(canStartFollowup(order) && params.get("newRequest") === "1");
  const pickup = addresses.find((a) => a.id === pickupAddressId);
  return (
    <main className="purchase-page purchase-return-page">
      <h1>Return or Replace Item</h1>
      {(error || actionError) && (
        <p className="purchase-alert" role="alert">
          {error || actionError}
        </p>
      )}
      {!order ? (
        !error && <p role="status">Loading order…</p>
      ) : (
        <>
          <div className="purchase-return-item">
            <small className="purchase-eyebrow">
              Northstar · Order #{order.orderId}
            </small>
            {order.items.map((item, i) => (
              <ProductRow key={i} item={item} />
            ))}
            <small>This request includes all items in the order.</small>
          </div>
          {existing ? (
            <section className="purchase-panel">
              <h2>{order.returnRequest.resolution === "replacement" ? "Replacement" : "Return"}: {titleCase(order.returnRequest.status)}</h2>
              <ReplacementProgress order={order} />
              <p>{order.returnRequest.reason}</p>
              <WalletRefundNotice order={order} />
              <CancelReturnButton order={order} onUpdate={setOrder} />
              {canStartFollowup(order) && <Link className="purchase-button" to={`/orders/${id}/return?newRequest=1`}>Return / replacement</Link>}
              <RequestHistory order={order} />
              <Link to={`/orders/${id}`}>View {order.returnRequest.resolution === "replacement" ? "replacement" : "return"} status →</Link>
            </section>
          ) : order.orderStatus !== "delivered" ? (
            <section className="purchase-panel">
              <h2>Return unavailable</h2>
              <p>Return requests are available after delivery.</p>
              <Link to={`/orders/${id}`}>View order details</Link>
            </section>
          ) : (
            <form onSubmit={submit}>
              <div className="purchase-return-choices">
                <label className={`purchase-return-choice ${resolution === "refund" ? "is-selected" : ""}`}>
                  <div>
                    <Wallet size={22} />
                    <input
                      type="radio"
                      aria-label="Request return and refund"
                      name="resolution"
                      checked={resolution === "refund"}
                      onChange={() => setResolution("refund")}
                      disabled={busy}
                    />
                  </div>
                  <h2>Request Return & Refund</h2>
                  <p>
                    Return your order for review. An approved return is eligible
                    for a refund after the goods are received.
                  </p>
                </label>
                <label className={`purchase-return-choice ${resolution === "replacement" ? "is-selected" : ""}`}>
                  <div>
                    <RotateCcw size={22} />
                    <input
                      type="radio"
                      name="resolution"
                      checked={resolution === "replacement"}
                      onChange={() => setResolution("replacement")}
                      disabled={busy}
                      aria-label="Request replacement"
                    />
                  </div>
                  <h2>Request Replacement</h2>
                  <p>
                    Request the same product and option at no extra charge. Replacement stock is checked after your returned item is received.
                  </p>
                </label>
              </div>
              <section className="purchase-return-section">
                <h2>
                  <span>02</span>Reason for Request
                </h2>
                <label className="purchase-field">
                  <span>{resolution === "replacement" ? "Replacement reason" : "Return reason"} · Required</span>
                  <select
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Select a reason</option>
                    {[
                      "Received defective or malfunctioning item",
                      "Item damaged during delivery",
                      "Received the wrong item",
                      "Item does not match its description",
                      "Other",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="purchase-field">
                  <span>
                    Detailed description (optional) · {description.length} / 500
                  </span>
                  <textarea
                    rows={5}
                    maxLength={500}
                    placeholder="Tell us what happened with the item…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </section>
              <section className="purchase-return-section">
                <h2>
                  <span>03</span>Upload photo
                </h2>
                <label className="purchase-upload">
                  <Camera size={27} />
                  <b>Upload photos of the issue</b>
                  <small>
                    Up to 3 JPG, PNG or WebP photos, 5 MB each. Include the
                    affected part clearly.
                  </small>
                  <input
                    aria-label={resolution === "replacement" ? "Upload replacement photos" : "Upload return photos"}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={choosePhotos}
                    disabled={busy}
                  />
                </label>
                <div className="purchase-photos">
                  {photos.map((f, i) => (
                    <Photo
                      key={`${f.name}:${i}`}
                      file={f}
                      remove={() =>
                        setPhotos((old) =>
                          old.filter((_, index) => index !== i),
                        )
                      }
                    />
                  ))}
                </div>
              </section>
              <section className="purchase-return-section">
                <h2>
                  <span>04</span>Courier Pickup Address
                </h2>
                <label className="purchase-field">
                  <span>Pickup address</span>
                  <select
                    value={pickupAddressId}
                    disabled={busy}
                    onChange={(e) => setPickupAddressId(e.target.value)}
                  >
                    <option value="">Original delivery address</option>
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label || "Saved"} · {a.addressLine1}, {a.city}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="purchase-panel">
                  <DeliveryAddress
                    address={
                      pickup
                        ? {
                            name: pickup.fullName,
                            phone: pickup.phoneNumber,
                            ...pickup,
                            pincode: pickup.postalCode,
                          }
                        : order.shippingAddress
                    }
                  />
                </div>
                <small>
                  Pickup details are confirmed after the return request is
                  accepted.
                </small>
              </section>
              <label className="purchase-confirm-packaging">
                <input type="checkbox" required disabled={busy} />I confirm that
                I will return the product with its original packaging and
                included accessories.
              </label>
              <div className="purchase-buttons">
                <button className="purchase-primary" disabled={busy}>
                  {busy ? "Submitting…" : resolution === "replacement" ? "Submit replacement request →" : "Submit return request →"}
                </button>
                <Link className="purchase-button purchase-text" to="/orders">
                  Cancel and return to orders
                </Link>
              </div>
            </form>
          )}
        </>
      )}
      {submitted && <Submitted order={order} close={close} />}
    </main>
  );
}
