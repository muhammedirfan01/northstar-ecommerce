import { canRefundToWallet } from "./refundOptions.js";
import { useState } from "react";
import { Link } from "react-router";
import { reconcilePayment } from "../../orders/payment.js";
import {
  Banknote,
  Hourglass,
  CircleAlert,
  RotateCcw,
  MoreHorizontal,
  Download,
} from "lucide-react";
import {
  DirectoryHeader,
  Stats,
  SearchBox,
  Pager,
  Badge,
  Modal,
  ExportButton,
} from "./shared.jsx";
import {
  API,
  useDirectory,
  useAdminData,
  money,
  date,
  label,
  download,
} from "./data.js";
function PaymentDialog({ order, close, refresh }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reference, setReference] = useState("");
  const refundDue = ["pending", "processing", "failed"].includes(
    order.refund?.status,
  );
  async function receipt() {
    try {
      await download(
        `/admin/orders/${order.id}/invoice`,
        `receipt-${order.orderId}.pdf`,
      );
    } catch {
      setError("Receipt download failed. Please retry.");
    }
  }
  async function refund(e, destination) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await API.post(
        `/admin/orders/${order.id}/refund`,
        destination === "wallet" ? { destination } : order.refund.method === "cash" ? { reference } : {},
      );
      refresh();
      close();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Payment Transaction Details"
      subtitle={`Transaction Ref: ${order.paymentReference} · Order ${order.orderId}`}
      close={() => {
        if (!busy) close();
      }}
      wide
    >
      <div className="ops-modal-body">
        <div className="ops-payment-amount">
          <div>
            <small>Total order amount</small>
            <strong>{money(order.totalAmount)}</strong>
            <Badge value={order.paymentStatus} />
          </div>
          <div>
            <small>{date(order.createdAt)}</small>
            <code>{order.paymentReference}</code>
          </div>
        </div>
        <div className="ops-detail-grid">
          <section>
            <h3>Customer information</h3>
            <dl>
              <dt>Customer name</dt>
              <dd>{order.customer?.name || order.shippingAddress.name}</dd>
              <dt>Email address</dt>
              <dd>{order.customer?.email || "—"}</dd>
              <dt>Phone</dt>
              <dd>{order.customer?.phone || order.shippingAddress.phone}</dd>
            </dl>
          </section>
          <section>
            <h3>Order association</h3>
            <small>Purchased item</small>
            <p>{order.items[0]?.productName}</p>
            <small>
              {order.items[0]?.variantName}
              {order.items.length > 1 &&
                ` · +${order.items.length - 1} more items`}
            </small>
            <p>
              Fulfillment <Badge value={order.orderStatus} />
            </p>
          </section>
          <section className="ops-detail-full">
            <h3>Payment & settlement details</h3>
            <div className="ops-detail-grid">
              <div>
                <small>Payment method</small>
                <p>{label(order.paymentMethod)}</p>
              </div>
              <div>
                <small>Payment reference</small>
                <p className="ops-reference">{order.paymentReference}</p>
              </div>
              <div>
                <small>Provider settlement / fee</small>
                <p>Not available</p>
              </div>
            </div>
            <small>
              Settlement and bank details appear only when supplied by the
              payment provider.
            </small>
          </section>
        </div>
        <details>
          <summary>Payment history</summary>
          <ol>
            {order.paymentHistory?.map((e, i) => (
              <li key={i}>
                {label(e.status)} · {date(e.at)} {e.reference}
              </li>
            ))}
          </ol>
        </details>
        {error && (
          <p className="ops-error" role="alert">
            {error}
          </p>
        )}
        {order.paymentMethod === "razorpay" &&
          !["paid", "refunded"].includes(order.paymentStatus) && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await reconcilePayment(order.id, true);
                  refresh();
                  close();
                } catch (e) {
                  setError(e.response?.data?.message || e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Reconcile payment
            </button>
          )}
        {canRefundToWallet(order) && <button type="button" className="ops-refund" disabled={busy} onClick={(e) => refund(e, "wallet")}>Refund to wallet</button>}
        {refundDue && order.refund.method !== "wallet" && (
          <form onSubmit={refund}>
            {order.refund.method === "cash" && (
              <label>
                Reference confirming cash was refunded
                <input
                  required
                  minLength={3}
                  maxLength={120}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
            )}
            <button disabled={busy} className="ops-refund">
              {order.refund.method === "cash"
                ? "Confirm cash refund paid"
                : "Process / refresh refund"}
            </button>
          </form>
        )}
      </div>
      <footer className="ops-modal-actions">
        <button onClick={receipt}>
          <Download size={15} />
          Download receipt (PDF)
        </button>
        <Link to={`/admin/orders/${order.id}`}>View order ↗</Link>
        <button className="ops-primary" onClick={close} disabled={busy}>
          Close
        </button>
      </footer>
    </Modal>
  );
}
export default function AdminPayments() {
  const { values, change, clear, query } = useDirectory({
    paymentStatus: "",
    method: "",
  });
  const { data, error, refresh } = useAdminData(`/admin/payments?${query}`);
  const [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");
  const s = data?.summary || {};
  return (
    <div className="cm-page catalog-page ops-page">
      <DirectoryHeader
        eyebrow="Sales / Payments"
        summary={<Stats
        cards={[
          {
            name: "Total collected",
            value: s.collected === undefined ? "—" : money(s.collected),
            icon: Banknote,
            hint: "Captured payments / collected cash",
          },
          {
            name: "Pending payment",
            value: s.pending === undefined ? "—" : money(s.pending),
            icon: Hourglass,
            hint: "Awaiting payment or cash collection",
          },
          {
            name: "Failed transactions",
            value: s.failed,
            icon: CircleAlert,
            hint: "Orders with failed payments",
          },
          {
            name: "Refunded amount",
            value: s.refunded === undefined ? "—" : money(s.refunded),
            icon: RotateCcw,
            hint: "Completed refunds",
          },
        ]}
      />}
        title="Payments"
        description="Track customer payments, pending collections and refunds."
      >
        <ExportButton
          url={`/admin/payments/export?${query}`}
          filename="northstar-payments.csv"
          onError={setNotice}
        />
      </DirectoryHeader>

      {(error || notice) && (
        <p className="ops-error" role="alert">
          {error || notice}
        </p>
      )}
      <div className="cm-toolbar ops-filters">
        <SearchBox
          value={values.search}
          onChange={(v) => change("search", v)}
          placeholder="Search by payment ID, order ID, customer…"
        />
        <select
          aria-label="Payment status"
          value={values.paymentStatus}
          onChange={(e) => change("paymentStatus", e.target.value)}
        >
          <option value="">Status: All Statuses</option>
          {["paid", "pending", "failed", "refunded"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Payment method"
          value={values.method}
          onChange={(e) => change("method", e.target.value)}
        >
          <option value="">Method: All Methods</option>
          <option value="cod">Cash on Delivery</option>
          <option value="razorpay">Razorpay</option>
        </select>
        <button className="ops-clear" onClick={clear}>
          Clear Filters
        </button>
        <span className="ops-result">
          Showing {data?.payments.length || 0} of{" "}
          <b>{data?.pagination.total || 0}</b> payments
        </span>
      </div>
      <section className="cm-table-card ops-table-card">
        <div className="cm-table-scroll ops-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {[
                  "Payment ID",
                  "Order ID",
                  "Customer name",
                  "Date & time",
                  "Payment method",
                  "Amount",
                  "Status",
                  "Actions",
                ].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.payments.map((o) => (
                <tr key={o.id}>
                  <td className="ops-reference">{o.paymentReference}</td>
                  <td>
                    <Link
                      className="ops-reference"
                      to={`/admin/orders/${o.id}`}
                    >
                      {o.orderId}
                    </Link>
                  </td>
                  <td>
                    <b>{o.customer?.name || o.shippingAddress.name}</b>
                    <small>{o.customer?.email || "—"}</small>
                  </td>
                  <td>{date(o.createdAt)}</td>
                  <td>
                    {o.paymentMethod === "cod"
                      ? "Cash on Delivery"
                      : "Razorpay"}
                  </td>
                  <td className="ops-nowrap">{money(o.totalAmount)}</td>
                  <td>
                    <Badge value={o.paymentStatus} />
                  </td>
                  <td>
                    <button
                      aria-label={`View payment for ${o.orderId}`}
                      className="ops-action"
                      onClick={() => setSelected(o)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan="8">
                    {error ? "Unable to load payments." : "Loading payments…"}
                  </td>
                </tr>
              )}
              {data && !data.payments.length && (
                <tr>
                  <td colSpan="8" className="ops-empty">
                    No payments match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {selected && (
        <PaymentDialog
          order={selected}
          close={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}
