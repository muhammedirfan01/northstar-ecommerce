import { useState } from "react";
import { Link } from "react-router";
import {
  ReceiptText,
  SquareCheck,
  ClipboardClock,
  Truck,
  MoreHorizontal,
} from "lucide-react";
import {
  DirectoryHeader,
  Stats,
  SearchBox,
  Pager,
  Badge,
  ExportButton,
} from "./shared.jsx";
import { useDirectory, useAdminData, money, date } from "./data.js";
import OrderActionDialog from "./OrderActionDialog.jsx";
import OrderMenu from "./OrderMenu.jsx";
import "./admin-simple.css";
export default function AdminOrders() {
  const { values, change, clear, query } = useDirectory({
    status: "",
    paymentStatus: "",
    sort: "newest",
    returnStatus: "",
  });
  const { data, error, refresh } = useAdminData(`/admin/orders?${query}`);
  const [notice, setNotice] = useState("");
  const [operationError, setOperationError] = useState("");
  const [action, setAction] = useState(null);
  const [menu, setMenu] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const summary = data?.summary || {};
  return (
    <div className="cm-page catalog-page ops-page">
      <DirectoryHeader
        summary={<Stats
        cards={[
          {
            name: "Total orders",
            value: summary.total,
            icon: ReceiptText,
            hint: "All orders placed",
          },
          {
            name: "Fulfilled orders",
            value: summary.fulfilled,
            icon: SquareCheck,
            hint: "Shipped and delivered",
          },
          {
            name: "Pending to fulfill",
            value: summary.pending,
            icon: ClipboardClock,
            hint: "Awaiting payment or dispatch",
          },
          {
            name: "Delivered orders",
            value: summary.delivered,
            icon: Truck,
            hint: "Delivery completed",
          },
        ]}
      />}
        title="Orders"
        description="Manage and fulfill customer orders from one place."
      >
        <ExportButton
          url={`/admin/orders/export?${query}`}
          filename="northstar-orders.csv"
          onError={(message) => {
            setNotice("");
            setOperationError(message);
          }}
        />
      </DirectoryHeader>

      {(error || operationError || notice) && (
        <p
          className={error || operationError ? "ops-error" : "ops-notice"}
          role={error || operationError ? "alert" : "status"}
        >
          {error || operationError || notice}
        </p>
      )}
      <div className="cm-toolbar ops-filters">
        <SearchBox
          value={values.search}
          onChange={(v) => change("search", v)}
          placeholder="Search by Order ID, customer, product…"
        />
        <select
          aria-label="Order status"
          value={values.status}
          onChange={(e) => change("status", e.target.value)}
        >
          <option value="">Status: All Statuses</option>
          {[
            "pending",
            "confirmed",
            "shipped",
            "out_for_delivery",
            "delivered",
            "cancelled",
          ].map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Payment status"
          value={values.paymentStatus}
          onChange={(e) => change("paymentStatus", e.target.value)}
        >
          <option value="">Payment: All</option>
          {["pending", "paid", "failed", "refunded"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="cm-button" aria-expanded={advanced} aria-controls="order-advanced-filters" onClick={() => setAdvanced(!advanced)}>Advanced filters</button>
        <button className="ops-clear" onClick={clear}>
          Clear Filters
        </button>
        <span className="ops-result">
          Showing {data?.orders.length || 0} of{" "}
          <b>{data?.pagination.total || 0}</b> orders
        </span>
      </div>
      {advanced && <div className="cm-toolbar ops-advanced-panel" id="order-advanced-filters">
        <label className="cm-filter">Sort <select
          aria-label="Sort orders"
          value={values.sort}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total-asc">Amount: Low to High</option>
          <option value="total-desc">Amount: High to Low</option>
        </select></label>
        <label className="cm-filter">Returns
          <select aria-label="Order return status" value={values.returnStatus} onChange={event => change("returnStatus", event.target.value)}>
            <option value="">All orders</option><option value="all">With returns</option><option value="requested">Requested</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>}
      <section className="cm-table-card ops-table-card">
        <div className="cm-table-scroll ops-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {[
                  "Order ID",
                  "Customer name",
                  "Item",
                  "Amount",
                  "Payment",
                  "Status",
                  "Actions",
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link
                      className="ops-reference"
                      to={`/admin/orders/${o.id}`}
                    >
                      {o.orderId}
                    </Link>
                    <small>{date(o.createdAt)}</small>
                  </td>
                  <td>
                    <b>{o.customer?.name || o.shippingAddress?.name}</b>
                    <small>{o.customer?.email || "—"}</small>
                  </td>
                  <td>
                    <span>{o.items[0]?.productName}</span>
                    <small>
                      {o.items[0]?.variantName ||
                        `${o.items.reduce((n, i) => n + i.quantity, 0)} item(s)`}
                      {o.items.length > 1 && ` · +${o.items.length - 1} more`}
                    </small>
                  </td>
                  <td className="ops-nowrap">{money(o.totalAmount)}</td>
                  <td>
                    <Badge value={o.paymentStatus} />
                  </td>
                  <td>
                    <Badge value={o.orderStatus} />
                  </td>
                  <td>
                    <button className="cm-icon-button" aria-label={`Actions for ${o.orderId}`} onClick={() => setMenu(o)}>
                      <MoreHorizontal size={17} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan="7">
                    {error ? "Unable to load orders." : "Loading orders…"}
                  </td>
                </tr>
              )}
              {data && !data.orders.length && (
                <tr>
                  <td className="ops-empty" colSpan="7">
                    No orders match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {menu && <OrderMenu order={menu} close={() => setMenu(null)} choose={type => { setMenu(null); setAction({ order: menu, type }); }} />}
      {action && (
        <OrderActionDialog
          order={action.order}
          action={action.type}
          close={() => setAction(null)}
          saved={() => {
            setOperationError("");
            setNotice(
              action.type === "paid" ? "Payment recorded." : "Order cancelled.",
            );
            setAction(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
