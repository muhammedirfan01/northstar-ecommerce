import RequestHistory from "./RequestHistory.jsx";
import ReplacementProgress from "./ReplacementProgress.jsx";
import OrderActionDialog from "../admin/operations/OrderActionDialog.jsx";
import { canMarkPaid } from "../admin/operations/orderRules.js";
import "../admin/operations/admin-simple.css";
import { canRefundToWallet } from "../admin/operations/refundOptions.js";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Download, Package } from "lucide-react";
import {
  API,
  useAdminData,
  money,
  date,
  label,
  download,
} from "../admin/operations/data.js";
import { Badge } from "../admin/operations/shared.jsx";
import { reconcilePayment } from "./payment.js";
import "../shop/checkout.css";
import "../admin/order-details.css";
export default function Orders() {
  const { id } = useParams(),
    { data, error, refresh } = useAdminData(`/admin/orders/${id}`),
    order = data?.order;
  const [orderAction, setOrderAction] = useState("");
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [reviewNote, setReviewNote] = useState(""),
    [refundReference, setRefundReference] = useState("");
  async function action(task) {
    setBusy(true);
    setActionError("");
    try {
      await task();
      refresh();
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  const base = `/admin/orders/${id}`;
  return (
    <section className="cm-page catalog-page admin-order-details">
      <p className="cm-breadcrumb">Sales / Orders / Order details</p>
      <Link className="catalog-back" to="/admin/orders">
        ← Back to orders
      </Link>
      <div className="cm-heading">
        <div>
          <h1>Order details</h1>
          <p>
            {order
              ? `${order.orderId} · Placed ${date(order.createdAt)}`
              : "Loading order…"}
          </p>
        </div>
        {order && (
          <button
            className="cm-button"
            disabled={busy}
            onClick={() =>
              action(() =>
                download(base + "/invoice", `invoice-${order.orderId}.pdf`),
              )
            }
          >
            <Download size={14} />
            Download PDF invoice
          </button>
        )}
      </div>
      {(error || actionError) && (
        <div className="cm-notice cm-error" role="alert">
          {error || actionError}
          <button onClick={refresh}>Refresh</button>
        </div>
      )}
      {!order ? (
        !error && <p role="status">Loading order…</p>
      ) : (
        <>
          <div className="cm-summary admin-order-summary">
            <b>{order.orderId}</b>
            <span>
              Order: <Badge value={order.orderStatus} />
            </span>
            <span>
              Payment: <Badge value={order.paymentStatus} />
            </span>
            <span>
              {order.paymentMethod === "cod"
                ? "Cash on delivery"
                : order.paymentMethod === "wallet"
                  ? "Wallet"
                  : "Razorpay"}
            </span>
            <strong>{money(order.totalAmount)}</strong>
          </div>
          <div className="admin-order-summary-actions">
            {canMarkPaid(order) && (
              <button
                className="cm-button"
                disabled={busy}
                onClick={() => setOrderAction("paid")}
              >
                Mark as paid
              </button>
            )}
            {["pending", "confirmed"].includes(order.orderStatus) && (
              <button
                className="cm-button cm-delete"
                disabled={busy}
                onClick={() => setOrderAction("cancel")}
              >
                Cancel order
              </button>
            )}
            {order.nextStatuses?.map((next) => (
              <button
                className="catalog-primary"
                key={next}
                disabled={busy}
                onClick={() =>
                  action(() => API.patch(base + "/status", { status: next }))
                }
              >
                Mark {next.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <section className="cm-table-card admin-order-items">
            <div className="dashboard-section-heading">
              <h2>Ordered products</h2>
            </div>
            <div className="cm-table-scroll">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Item total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div className="catalog-person">
                          {item.productImage ? (
                            <img src={item.productImage} alt="" />
                          ) : (
                            <span className="catalog-thumbnail-placeholder">
                              <Package size={20} />
                            </span>
                          )}
                          <div>
                            <strong>{item.productName}</strong>
                            <small>
                              {item.variantName || "Single product"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{item.quantity}</td>
                      <td className="catalog-price">
                        {money(item.lineTotalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="admin-order-main-grid">
            <section className="catalog-card">
              <h2>Customer details</h2>
              <dl className="cm-details">
                <div>
                  <dt>Name</dt>
                  <dd>{order.customer?.name || order.shippingAddress.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{order.customer?.email || "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>
                    {order.customer?.phone || order.shippingAddress.phone}
                  </dd>
                </div>
              </dl>
              <h2 style={{ marginTop: 22 }}>Delivery address</h2>
              <address>
                {order.shippingAddress.name}
                <br />
                {order.shippingAddress.addressLine1}{" "}
                {order.shippingAddress.addressLine2}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.pincode}
                <br />
                {order.shippingAddress.phone}
              </address>
            </section>
            <section className="catalog-card">
              <h2>Payment summary</h2>
              <dl className="cm-details">
                {[
                  ["Subtotal", order.subtotal],
                  ["Delivery", order.shippingCharge],
                  ["Discount", -order.discount],
                  ["Tax", order.tax || 0],
                  ["Total", order.totalAmount],
                ].map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{money(value)}</dd>
                  </div>
                ))}
              </dl>
              {order.paymentMethod === "razorpay" &&
                !["paid", "refunded"].includes(order.paymentStatus) && (
                  <button
                    className="cm-button"
                    disabled={busy}
                    onClick={() => action(() => reconcilePayment(id, true))}
                  >
                    Reconcile online payment
                  </button>
                )}
            </section>
            {order.cancellationReason && (
              <section className="catalog-card">
                <h2>Cancellation</h2>
                <p>{order.cancellationReason}</p>
              </section>
            )}
          </div>
          {order.returnRequest?.status &&
            order.returnRequest.status !== "none" && (
              <section className="catalog-card">
                <h2>{order.returnRequest.resolution === "replacement" ? "Replacement request" : "Return"}: {order.returnRequest.status}</h2>
                <ReplacementProgress order={order} busy={busy} onAdvance={(status) => action(() => API.post(base + "/return/replacement", { status, requestCycle: order.returnRequest.cycle || 1 }))} />
                <RequestHistory order={order} />
                <p>{order.returnRequest.reason}</p>
                {order.returnRequest.description && (
                  <p>{order.returnRequest.description}</p>
                )}
                {order.returnRequest.reviewNote && (
                  <p>Review: {order.returnRequest.reviewNote}</p>
                )}
                {order.returnRequest.status === "requested" && (
                  <>
                    <label className="catalog-fields">
                      Return review note
                      <input
                        maxLength={500}
                        value={reviewNote}
                        disabled={busy}
                        onChange={(event) => setReviewNote(event.target.value)}
                      />
                    </label>
                    <div className="admin-order-actions">
                      {["accepted", "rejected"].map((decision) => (
                        <button
                          className="cm-button"
                          key={decision}
                          disabled={busy}
                          onClick={() =>
                            action(() =>
                              API.post(base + "/return/review", {
                                requestCycle: order.returnRequest.cycle || 1,
                                decision,
                                note: reviewNote,
                              }),
                            )
                          }
                        >
                          {decision === "accepted"
                            ? (order.returnRequest.resolution === "replacement" ? "Accept replacement" : "Accept return")
                            : (order.returnRequest.resolution === "replacement" ? "Reject replacement" : "Reject return")}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {order.returnRequest.status === "accepted" && (
                  <button
                    className="catalog-primary"
                    disabled={busy}
                    onClick={() =>
                      action(() => API.post(base + "/return/complete", { requestCycle: order.returnRequest.cycle || 1 }))
                    }
                  >
                    Confirm returned goods received
                  </button>
                )}
                <p>
                  <Link to="/admin/returns">Open returns management</Link>
                </p>
              </section>
            )}
          {order.refund?.status && order.refund.status !== "none" && (
            <section className="catalog-card">
              <h2>Refund: {order.refund.status}</h2>
              <p>
                {money(order.refund.amount)} ·{" "}
                {order.refund.method === "cash"
                  ? "Cash refund"
                  : order.refund.method === "wallet" ? "Northstar Wallet" : "Original payment method"}
              </p>
              {order.refund.method === "wallet" && order.refund.status === "completed" && <p>Refunded amount added to wallet.</p>}
              {order.refund.reference && (
                <p>Reference: {order.refund.reference}</p>
              )}
              {canRefundToWallet(order) && <button type="button" className="catalog-primary" disabled={busy} onClick={() => action(() => API.post(base + "/refund", { destination: "wallet" }))}>Refund to wallet</button>}
              {order.refund.status !== "completed" && order.refund.method !== "wallet" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    action(() =>
                      API.post(
                        base + "/refund",
                        order.refund.method === "cash"
                          ? { reference: refundReference }
                          : {},
                      ),
                    );
                  }}
                >
                  {order.refund.method === "cash" && (
                    <label className="catalog-fields">
                      Reference confirming cash was refunded
                      <input
                        required
                        minLength={3}
                        maxLength={120}
                        value={refundReference}
                        disabled={busy}
                        onChange={(event) =>
                          setRefundReference(event.target.value)
                        }
                      />
                    </label>
                  )}
                  <button className="catalog-primary" disabled={busy}>
                    {order.refund.method === "cash"
                      ? "Confirm cash refund paid"
                      : "Process / refresh online refund"}
                  </button>
                </form>
              )}
            </section>
          )}
          <details className="catalog-card admin-order-history-toggle">
            <summary>Order & payment history</summary>
            <div className="admin-order-grid">
              <section className="catalog-card">
                <h2>Order history</h2>
                <ol className="admin-order-history">
                  {order.statusHistory?.map((event, i) => (
                    <li key={i}>
                      {label(event.status)}
                      <small>{date(event.at)}</small>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="catalog-card">
                <h2>Payment history</h2>
                <ol className="admin-order-history">
                  {order.paymentHistory?.map((event, i) => (
                    <li key={i}>
                      {label(event.status)}
                      <small>
                        {date(event.at)}
                        {event.note && ` · ${event.note}`}
                        {event.reference && ` · ${event.reference}`}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </details>
          {orderAction && (
            <OrderActionDialog
              order={order}
              action={orderAction}
              close={() => setOrderAction("")}
              saved={() => {
                setOrderAction("");
                refresh();
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
