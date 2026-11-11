import { Link } from "react-router";
import {
  Users,
  Package,
  RotateCcw,
  ReceiptText,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useAdminData, money, date } from "./operations/data.js";
import { Badge } from "./operations/shared.jsx";
import "./dashboard.css";
export default function AdminDashboard() {
  const stats = useAdminData("/admin/dashboard"),
    orders = useAdminData("/admin/orders?limit=5&sort=newest");
  const cards = [
    {
      name: "Total orders",
      value: stats.data?.orders,
      icon: ReceiptText,
      path: "/admin/orders",
      note: "View and manage store orders",
    },
    {
      name: "Total products",
      value: stats.data?.products,
      icon: Package,
      path: "/admin/products",
      note: "View your product catalogue",
    },
    {
      name: "Total customers",
      value: stats.data?.customers,
      icon: Users,
      path: "/admin/customers",
      note: "Manage customer accounts",
    },
    {
      name: "Total returns",
      value: stats.data?.returns,
      icon: RotateCcw,
      path: "/admin/returns",
      note: "Review customer return requests",
    },
  ];
  return (
    <section className="cm-page catalog-page dashboard-page">
      <p className="cm-breadcrumb">Overview / Dashboard</p>
      <div className="cm-heading">
        <div>
          <h1>Dashboard</h1>
          <p>
            An overview of your Northstar store and the work that needs
            attention.
          </p>
        </div>
        <button
          className="cm-button"
          onClick={() => {
            stats.refresh();
            orders.refresh();
          }}
        >
          <RefreshCw size={14} />
          Refresh dashboard
        </button>
      </div>
      {stats.error && (
        <p className="cm-notice cm-error" role="alert">
          {stats.error}
        </p>
      )}
      <div className="admin-stats dashboard-stats">
        {cards.map(({ name, value, icon: Icon, path, note }) => (
          <Link className="admin-stat-card" to={path} key={name}>
            <div className="admin-stat-heading">
              <h2>{name}</h2>
              <span className="admin-stat-icon">
                <Icon size={19} />
              </span>
            </div>
            <p className="admin-stat-value">{value ?? "—"}</p>
            <span className="dashboard-stat-note">
              {note}
              <ArrowRight size={13} />
            </span>
          </Link>
        ))}
      </div>
      <div className="dashboard-sections">
        <section className="cm-table-card">
          <header className="dashboard-section-heading">
            <div>
              <h2>Recent orders</h2>
              <p>The latest orders placed in your store.</p>
            </div>
            <Link className="cm-button" to="/admin/orders">
              View all orders
            </Link>
          </header>
          {orders.error ? (
            <p className="dashboard-message cm-error" role="alert">
              {orders.error}
            </p>
          ) : !orders.data ? (
            <p className="dashboard-message" role="status">
              Loading recent orders…
            </p>
          ) : !orders.data.orders.length ? (
            <p className="dashboard-message">No orders have been placed yet.</p>
          ) : (
            <div className="cm-table-scroll">
              <table className="cm-table dashboard-orders">
                <thead>
                  <tr>
                    {["Order", "Customer", "Date", "Total", "Status"].map(
                      (t) => (
                        <th key={t}>{t}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {orders.data.orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/admin/orders/${o.id}`}>{o.orderId}</Link>
                      </td>
                      <td>
                        <b>{o.customer?.name || o.shippingAddress.name}</b>
                        <small>{o.customer?.email || ""}</small>
                      </td>
                      <td>{date(o.createdAt)}</td>
                      <td>{money(o.totalAmount)}</td>
                      <td>
                        <Badge value={o.orderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="catalog-card dashboard-shortcuts dashboard-quick-access">
          <header className="dashboard-section-heading">
            <div><h2>Quick access</h2><p>Everyday store tasks, in one place.</p></div>
          </header>
          <div className="dashboard-links">
            {[
              ["Orders", "/admin/orders", "View and process orders"],
              ["Products", "/admin/products", "Manage products and variants"],
              ["Customers", "/admin/customers", "View customer accounts"],
              [
                "Customer Requests",
                "/admin/customers/requests",
                "Review support messages",
              ],
              ["Categories", "/admin/categories", "Organise your catalogue"],
              ["Coupons", "/admin/coupons", "Manage discount codes"],
            ].map(([name, path, note]) => (
              <Link key={path} to={path}>
                <b>
                  {name}
                  <ArrowRight size={14} />
                </b>
                <small>{note}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
