import { canRefundToWallet } from "./refundOptions.js";
import RequestHistory from "../../orders/RequestHistory.jsx";
import ReplacementProgress from "../../orders/ReplacementProgress.jsx";
import { useState } from "react";
import { Link } from "react-router";
import {
  RotateCcw,
  Clock3,
  CheckCircle,
  Wallet,
  MoreHorizontal,
} from "lucide-react";
import {
  DirectoryHeader,
  Stats,
  SearchBox,
  Pager,
  Badge,
  Modal,
} from "./shared.jsx";
import { API, useDirectory, useAdminData, money, date, label } from "./data.js";

function ReturnDialog({ initial, close, refresh }) {
  const [order, setOrder] = useState(initial),
    [note, setNote] = useState(""),
    [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function action(path, body) {
    setBusy(true);
    setError("");
    try {
      const { data } = await API.post(
        `/admin/orders/${order.id}/${path}`,
        path.startsWith("return/") ? { ...body, requestCycle: order.returnRequest?.cycle || 1 } : body,
      );
      setOrder(data.data.order);
      refresh();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  const request = order.returnRequest,
    address = request.pickupAddress || order.shippingAddress;
  return (
    <Modal
      wide
      title="Return Request Details"
      subtitle={`${request.reference || `RET-${order.orderId}`} · Order ${order.orderId}`}
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="ops-modal-body">
        <div className="ops-payment-amount">
          <div>
            <small>Order amount</small>
            <strong>{money(order.totalAmount)}</strong>
            <Badge value={request.status} />
          </div>
          <div>
            <small>Requested {date(request.requestedAt)}</small>
            <span>{request.resolution === "replacement" ? "Replacement" : "Return & refund"} · All order items</span>
          </div>
        </div>
        <div className="ops-detail-grid">
          <section>
            <h3>Customer information</h3>
            <p>
              <b>{order.customer?.name || address.name}</b>
            </p>
            <p>{order.customer?.email || "—"}</p>
            <small>{address.phone}</small>
          </section>
          <section>
            <h3>Pickup address</h3>
            <p>
              {address.addressLine1} {address.addressLine2}
            </p>
            <p>
              {address.city}, {address.state} {address.pincode}
            </p>
          </section>
          <section className="ops-detail-full">
            <h3>Reason for request</h3>
            <p>{request.reason}</p>
            {request.description && <p>{request.description}</p>}
            <small>
              {request.packagingConfirmed
                ? "Customer confirmed packaging and accessories."
                : "Packaging confirmation not supplied."}
            </small>
          </section>
          <section className="ops-detail-full">
            <h3>Returned items</h3>
            {order.items.map((item, i) => (
              <div className="ops-return-item" key={i}>
                {item.productImage && <img src={item.productImage} alt="" />}
                <div>
                  <b>{item.productName}</b>
                  <small>
                    {item.variantName} · Qty: {item.quantity}
                  </small>
                </div>
                <strong>{money(item.lineTotalPaise)}</strong>
              </div>
            ))}
          </section>
          {request.photos?.length > 0 && (
            <section className="ops-detail-full">
              <h3>Customer photos</h3>
              <div className="ops-return-photos">
                {request.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={`${API.defaults.baseURL.replace(/\/$/, "")}/admin/orders/${order.id}/return/photos/${photo.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={`${API.defaults.baseURL.replace(/\/$/, "")}/admin/orders/${order.id}/return/photos/${photo.id}`}
                      alt={photo.name}
                    />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
        <ReplacementProgress order={order} busy={busy} onAdvance={(status) => action("return/replacement", { status })} />
        <RequestHistory order={order} />
        {request.reviewNote && (
          <p className="ops-notice">Review: {request.reviewNote}</p>
        )}
        {error && (
          <p className="ops-error" role="alert">
            {error}
          </p>
        )}
        {request.status === "requested" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("return/review", { decision: "accepted", note });
            }}
          >
            <label>
              Return review note
              <input
                value={note}
                maxLength={500}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="ops-return-actions">
              <button className="ops-primary" disabled={busy}>
                {request.resolution === "replacement" ? "Accept replacement" : "Accept return"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  action("return/review", { decision: "rejected", note })
                }
              >
                {request.resolution === "replacement" ? "Reject replacement" : "Reject return"}
              </button>
            </div>
          </form>
        )}
        {request.status === "accepted" && (
          <div className="ops-notice">
            <p>
              Confirm receipt only after the returned goods have arrived. This
              {request.resolution === "replacement" ? "reserves replacement stock once without restocking the returned item or issuing a refund." : "restores inventory once and creates any refund due."}
            </p>
            <button
              className="ops-primary"
              disabled={busy}
              onClick={() => action("return/complete", {})}
            >
              Confirm returned goods received
            </button>
          </div>
        )}
        {order.refund?.status && order.refund.status !== "none" && (
          <section>
            <h3>Refund: {label(order.refund.status)}</h3>
            <p>
              {money(order.refund.amount)} ·{" "}
              {order.refund.method === "cash"
                ? "Cash refund"
                : order.refund.method === "wallet" ? "Northstar Wallet" : "Original payment method"}
            </p>
            {order.refund.reference && (
              <p>Reference: {order.refund.reference}</p>
            )}
            {canRefundToWallet(order) && <button type="button" className="ops-primary" disabled={busy} onClick={() => action("refund", { destination: "wallet" })}>Refund to wallet</button>}
            {order.refund.status !== "completed" && order.refund.method !== "wallet" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  action(
                    "refund",
                    order.refund.method === "cash" ? { reference } : {},
                  );
                }}
              >
                {order.refund.method === "cash" && (
                  <label>
                    Reference confirming cash was refunded
                    <input
                      required
                      minLength={3}
                      maxLength={120}
                      value={reference}
                      disabled={busy}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </label>
                )}
                <button className="ops-primary" disabled={busy}>
                  {order.refund.method === "cash"
                    ? "Confirm cash refund paid"
                    : "Process / refresh online refund"}
                </button>
              </form>
            )}
          </section>
        )}
      </div>
      <footer className="ops-modal-actions">
        <Link to={`/admin/orders/${order.id}`}>View complete order ↗</Link>
        <button className="ops-primary" disabled={busy} onClick={close}>
          Close
        </button>
      </footer>
    </Modal>
  );
}
export default function AdminReturns() {
  const { values, change, clear, query } = useDirectory({
    returnStatus: "requested",
  });
  const { data, error, refresh } = useAdminData(`/admin/orders?${query}`);
  const [selected, setSelected] = useState(null),
    s = data?.returnSummary || {};
  return (
    <div className="cm-page catalog-page ops-page ops-returns">
      <DirectoryHeader
        eyebrow="Sales / Returns & refunds"
        summary={<Stats
        cards={[
          {
            name: "Total returns",
            value: s.total,
            icon: RotateCcw,
            hint: "All customer return requests",
          },
          {
            name: "Awaiting review",
            value: s.requested,
            icon: Clock3,
            hint: "Requests needing a decision",
          },
          {
            name: "Accepted returns",
            value: s.accepted,
            icon: CheckCircle,
            hint: "Awaiting returned goods",
          },
          {
            name: "Completed returns",
            value: s.completed,
            icon: Wallet,
            hint: "Goods received and stock restored",
          },
        ]}
      />}
        title="Returns & Refunds"
        description="Review return requests, coordinate received goods and track refunds."
      />

      {error && (
        <p className="ops-error" role="alert">
          {error}
        </p>
      )}
      <div className="cm-toolbar ops-filters">
        <SearchBox
          value={values.search}
          onChange={(v) => change("search", v)}
          placeholder="Search order, customer or product…"
        />
        <select
          aria-label="Return status"
          value={values.returnStatus}
          onChange={(e) => change("returnStatus", e.target.value)}
        >
          <option value="all">All returns</option>
          {["requested", "accepted", "rejected", "completed", "cancelled"].map((s) => (
            <option value={s} key={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort returns"
          value={values.sort || "newest"}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="newest">Newest orders first</option>
          <option value="oldest">Oldest orders first</option>
        </select>
        <button className="ops-clear" onClick={clear}>
          Clear Filters
        </button>
        <span className="ops-result">
          Showing {data?.orders.length || 0} of{" "}
          <b>{data?.pagination.total || 0}</b> returns
        </span>
      </div>
      <section className="cm-table-card ops-table-card">
        <div className="cm-table-scroll ops-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {[
                  "Request / Order ID",
                  "Customer",
                  "Item",
                  "Requested",
                  "Amount",
                  "Return status",
                  "Refund",
                  "Actions",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((o) => (
                <tr key={o.id}>
                  <td className="ops-reference">
                    {o.returnRequest.reference || `RET-${o.orderId}`}
                    <small>{o.orderId}</small>
                  </td>
                  <td>
                    <b>{o.customer?.name || o.shippingAddress.name}</b>
                    <small>{o.customer?.email}</small>
                  </td>
                  <td>
                    <div
                      className="ops-return-product"
                      title={o.items[0]?.productName}
                    >
                      {o.items[0]?.productName}
                      <small>
                        {o.items.length > 1
                          ? `+${o.items.length - 1} more items`
                          : o.items[0]?.variantName}
                      </small>
                    </div>
                  </td>
                  <td>{date(o.returnRequest.requestedAt)}</td>
                  <td className="ops-nowrap">{money(o.totalAmount)}</td>
                  <td>
                    <Badge value={o.returnRequest.status} />
                  </td>
                  <td>
                    {o.refund?.status && o.refund.status !== "none" ? (
                      <Badge value={o.refund.status} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button
                      className="ops-action"
                      aria-label={`Review return for ${o.orderId}`}
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
                    {error ? "Unable to load returns." : "Loading returns…"}
                  </td>
                </tr>
              )}
              {data && !data.orders.length && (
                <tr>
                  <td colSpan="8" className="ops-empty">
                    No returns match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {selected && (
        <ReturnDialog
          initial={selected}
          close={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}
