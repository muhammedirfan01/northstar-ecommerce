import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  IndianRupee,
  ShoppingBag,
  ReceiptText,
  Package,
  TrendingUp,
} from "lucide-react";
import {
  date,
  money,
  useAdminData,
  useDirectory,
  download,
} from "../operations/data.js";
import SalesChart from "./SalesChart.jsx";
import "./sales-report.css";
const DAY = 86400000;
const iso = (time) => new Date(time).toISOString().slice(0, 10);
const net = (s) => (s?.collected || 0) - (s?.refunded || 0);
const average = (s) =>
  s?.completedOrders ? Math.round(s.completedSales / s.completedOrders) : 0;
function Growth({ value, previous }) {
  if (previous == null)
    return <span className="sr-muted">Comparison unavailable</span>;
  if (!previous)
    return (
      <span className="sr-muted">
        {value ? "No sales in previous period" : "No change"}
      </span>
    );
  const percent = ((value - previous) / Math.abs(previous)) * 100;
  return (
    <span className={`sr-growth ${percent < 0 ? "sr-negative" : ""}`}>
      <TrendingUp size={12} />
      {percent >= 0 ? "+" : ""}
      {percent.toFixed(1)}%
    </span>
  );
}
export default function SalesReport() {
  const [today] = useState(() => iso(Date.now() + 330 * 60000));
  const [, setParams] = useSearchParams();
  const { values, query } = useDirectory({
    from: today.slice(0, 7) + "-01",
    to: today,
    group: "day",
    sort: "newest",
  });
  const { data, error, refresh } = useAdminData(
    `/admin/reports/sales?${query}`,
  );
  const duration = Date.parse(values.to) - Date.parse(values.from) + DAY;
  const valid =
    Number.isFinite(duration) && duration > 0 && duration <= 366 * DAY;
  const previousTo = Date.parse(values.from) - DAY;
  const previousQuery = new URLSearchParams(query);
  previousQuery.set("from", iso(valid ? previousTo - duration + DAY : 0));
  previousQuery.set("to", iso(valid ? previousTo : 0));
  previousQuery.set("page", "1");
  const { data: previous, error: comparisonError } = useAdminData(
    `/admin/reports/sales?${previousQuery}`,
  );
  const [exportError, setExportError] = useState("");
  const [busy, setBusy] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(6);
  const presets = [
    ["Last 7 Days", iso(Date.parse(today) - 6 * DAY)],
    ["This Month", today.slice(0, 7) + "-01"],
    ["Last 3 Months", iso(Date.parse(today) - 89 * DAY)],
    ["Year to Date (YTD)", today.slice(0, 4) + "-01-01"],
  ];
  function selectRange(from) {
    const next = new URLSearchParams(query);
    next.set("from", from);
    next.set("to", today);
    next.set("group", "day");
    next.delete("page");
    setProductPage(1);
    setParams(next, { replace: true });
  }
  const products = data?.topProducts || [];
  const totalPages = Math.max(1, Math.ceil(products.length / productLimit));
  const page = Math.min(productPage, totalPages);
  const previousTrend = [];
  if (valid)
    for (let at = previousTo - duration + DAY; at <= previousTo; at += DAY) {
      const period = iso(at).slice(0, values.group === "month" ? 7 : 10);
      if (previousTrend.at(-1)?.period !== period)
        previousTrend.push(
          previous?.trend?.find((p) => p.period === period) || {
            period,
            collected: 0,
            refunded: 0,
            orders: 0,
          },
        );
    }
  const summary = data?.summary;
  const old = !comparisonError ? previous?.summary : null;
  return (
    <section className="cm-page catalog-page sr-page">
      <header className="sr-heading cm-heading">
        <h1>Sales Report</h1>
        <div className="sr-actions">
          <div className="sr-segments" aria-label="Reporting period">
            {presets.map(([name, from]) => (
              <button
                key={name}
                aria-pressed={values.from === from && values.to === today}
                onClick={() => selectRange(from)}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            className="sr-download"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setExportError("");
              try {
                await download(
                  `/admin/reports/sales/export?${query}`,
                  "northstar-sales.csv",
                );
              } catch {
                setExportError("Download failed. Please retry.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Downloading…" : "↓  Download Report"}
          </button>
        </div>
      </header>
      <p className="sr-range">
        Reporting Range:{" "}
        <strong>
          {valid
            ? `${date(values.from + "T12:00:00Z")} – ${date(values.to + "T12:00:00Z")}`
            : "Choose a reporting period above"}
        </strong>
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
      <div className="sr-stats">
        {[
          [
            "Net Sales",
            summary ? money(net(summary)) : "—",
            net(summary),
            old ? net(old) : null,
            IndianRupee,
          ],
          [
            "Completed Orders",
            summary?.completedOrders ?? "—",
            summary?.completedOrders || 0,
            old?.completedOrders,
            ShoppingBag,
          ],
          [
            "Average Order Value",
            summary ? money(average(summary)) : "—",
            average(summary),
            old ? average(old) : null,
            ReceiptText,
          ],
        ].map(([name, value, amount, before, Icon]) => (
          <article className="sr-stat" key={name}>
            <div>
              <span>{name}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <p>
              <Growth value={amount} previous={before} />
              {before > 0 && (
                <span className="sr-muted">vs previous period</span>
              )}
            </p>
          </article>
        ))}
      </div>
      <section className="sr-card sr-sales">
        <div className="sr-card-heading">
          <div>
            <h2>Sales over time</h2>
            <div className="sr-sales-total">
              <strong>{summary ? money(net(summary)) : "—"}</strong>
              <Growth value={net(summary)} previous={old ? net(old) : null} />
            </div>
          </div>
          <div className="sr-segments" aria-label="Chart period">
            {[
              ["7D", 7],
              ["30 Days", 30],
              ["90 Days", 90],
              ["YTD", 0],
              ["All", 365],
            ].map(([name, days]) => {
              const from = days
                ? iso(Date.parse(today) - (days - 1) * DAY)
                : today.slice(0, 4) + "-01-01";
              return (
                <button
                  key={name}
                  title={
                    name === "All" ? "All of the last 365 days" : undefined
                  }
                  aria-pressed={values.to === today && values.from === from}
                  onClick={() => selectRange(from)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sr-legend">
          <span>
            Current period ({values.from} – {values.to})
          </span>
          <span>
            Previous period ({previousQuery.get("from")} –{" "}
            {previousQuery.get("to")})
          </span>
        </div>
        {comparisonError && (
          <p role="status">Previous period could not be loaded.</p>
        )}
        {data && valid ? (
          <SalesChart
            current={data.trend || []}
            previous={previousTrend}
            from={values.from}
            to={values.to}
            group={values.group}
          />
        ) : (
          <p className="sr-empty">
            {error ? "Report could not be loaded." : "Loading report…"}
          </p>
        )}
      </section>
      <section className="sr-card sr-products">
        <div className="sr-card-heading">
          <h2>
            Top-Selling Products <small>• Ranked by net sales</small>
          </h2>
          <span className="sr-pill">Selected reporting period</span>
        </div>
        <div className="cm-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units sold</th>
                <th>Net sales</th>
              </tr>
            </thead>
            <tbody>
              {products
                .slice((page - 1) * productLimit, page * productLimit)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="sr-product">
                        <span>
                          {p.image ? (
                            <img src={p.image} alt="" />
                          ) : (
                            <Package size={18} />
                          )}
                        </span>
                        <div>
                          {p.name}
                          <small className="business-block catalog-muted">
                            Product ID: {p.id}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{p.units}</td>
                    <td>
                      <strong>{money(p.netSales)}</strong>
                    </td>
                  </tr>
                ))}
              {!products.length && (
                <tr>
                  <td colSpan="3">
                    {data
                      ? "No paid product sales in this period."
                      : "Loading products…"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="sr-product-footer">
          <span>
            {products.length
              ? `Showing ${(page - 1) * productLimit + 1} – ${Math.min(page * productLimit, products.length)} of ${products.length} products`
              : "0 products"}
          </span>
          <select
            aria-label="Products per page"
            value={productLimit}
            onChange={(e) => {
              setProductLimit(Number(e.target.value));
              setProductPage(1);
            }}
          >
            {[6, 12, 24].map((n) => (
              <option key={n} value={n}>
                {n} per page
              </option>
            ))}
          </select>
          <nav aria-label="Product pagination">
            <button
              aria-label="Previous product page"
              disabled={page === 1}
              onClick={() => setProductPage(page - 1)}
            >
              ‹
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              aria-label="Next product page"
              disabled={page === totalPages}
              onClick={() => setProductPage(page + 1)}
            >
              ›
            </button>
          </nav>
        </footer>
      </section>
    </section>
  );
}
