import { useState } from "react";
import { Link } from "react-router";
import {
  date,
  label,
  money,
  useAdminData,
  useDirectory,
} from "../operations/data.js";
import {
  Badge,
  ExportButton,
  Pager,
  SearchBox,
} from "../operations/shared.jsx";
import "./business.css";
const indiaDate = (value) =>
  new Date(value + 330 * 60000).toISOString().slice(0, 10);
export default function SalesReport() {
  const [today] = useState(() => Date.now());
  const { values, change, clear, query } = useDirectory({
    from: indiaDate(today).slice(0, 7) + "-01",
    to: indiaDate(today),
    group: "day",
    sort: "newest",
  });
  const { data, error, refresh } = useAdminData(
      `/admin/reports/sales?${query}`,
    ),
    [exportError, setExportError] = useState("");
  return (
    <section className="cm-page catalog-page">
      <p className="catalog-muted business-help">
        Dates use India time. This report groups orders by placement date and
        uses their current payment and refund states. Collected includes paid
        and refunded orders; only completed refunds are deducted. Pending and
        failed payments are excluded from collections.
      </p>
      {(error || exportError) && (
        <p className="cm-notice cm-error" role="alert">
          {error || exportError}
          <button
            onClick={() => {
              setExportError("");
              refresh();
            }}
          >
            Retry
          </button>
        </p>
      )}
      <ExportButton
        url={`/admin/reports/sales/export?${query}`}
        filename="northstar-sales.csv"
        onError={setExportError}
      />
      <div className="cm-toolbar business-toolbar">
        <label className="cm-filter">
          From
          <input
            aria-label="Report from"
            type="date"
            value={values.from}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label className="cm-filter">
          To
          <input
            aria-label="Report to"
            type="date"
            value={values.to}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        <label className="cm-filter">
          Group
          <select
            aria-label="Report grouping"
            value={values.group}
            onChange={(e) => change("group", e.target.value)}
          >
            <option value="day">Daily</option>
            <option value="month">Monthly</option>
          </select>
        </label>
        <SearchBox
          value={values.search}
          onChange={(v) => change("search", v)}
          placeholder="Search order or customer…"
        />
        <label className="cm-filter">
          Payment
          <select
            aria-label="Report payment status"
            value={values.paymentStatus || ""}
            onChange={(e) => change("paymentStatus", e.target.value)}
          >
            <option value="">All payments</option>
            {["pending", "paid", "failed", "refunded"].map((v) => (
              <option value={v} key={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-filter">
          Order status
          <select
            aria-label="Report order status"
            value={values.status || ""}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "pending",
              "confirmed",
              "shipped",
              "out_for_delivery",
              "delivered",
              "cancelled",
            ].map((v) => (
              <option value={v} key={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-filter">
          Sort
          <select
            aria-label="Report sort"
            value={values.sort}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total-desc">Amount: High to low</option>
            <option value="total-asc">Amount: Low to high</option>
          </select>
        </label>
        <button className="cm-clear" onClick={clear}>
          Clear filters
        </button>
      </div>
      <section className="cm-table-card">
        <div className="cm-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {[
                  "Order",
                  "Placed",
                  "Customer",
                  "Total",
                  "Payment",
                  "Refund",
                  "Status",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/admin/orders/${o.id}`}>{o.orderId}</Link>
                  </td>
                  <td>{date(o.createdAt)}</td>
                  <td>
                    {o.customer?.name}
                    <small className="business-block catalog-muted">
                      {o.customer?.email}
                    </small>
                  </td>
                  <td>{money(o.totalAmount)}</td>
                  <td>
                    <Badge value={o.paymentStatus} />
                    <small className="business-block">
                      {label(o.paymentMethod)}
                    </small>
                  </td>
                  <td>{money(o.completedRefund)}</td>
                  <td>
                    <Badge value={o.orderStatus} />
                  </td>
                </tr>
              ))}
              {!data?.orders.length && (
                <tr>
                  <td colSpan={7}>
                    {data
                      ? "No matching orders."
                      : error
                        ? "Report could not be loaded."
                        : "Loading orders…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
    </section>
  );
}
