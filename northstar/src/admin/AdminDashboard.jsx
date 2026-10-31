import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ShoppingBag, CircleCheck, ClipboardList } from "lucide-react";
import { adminApi } from "../api/admin.js";

const statistics = [
  { key: "orders", label: "Total orders", icon: ShoppingBag },
  { key: "fulfilled", label: "Fulfilled orders", icon: CircleCheck },
  { key: "pending", label: "Pending to fulfil", icon: ClipboardList },
];
export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminApi
      .dashboard(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setSummary(result);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [reload]);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Dashboard Overview</h1>
          <p>Store performance overview.</p>
        </div>
      </div>
      {error && (
        <p className="cm-notice cm-error" role="alert">
          {error}{" "}
          <button onClick={() => setReload(reload + 1)}>Try again</button>
        </p>
      )}
      <section className="admin-stats" aria-label="Store overview">
        {statistics.map(({ key, label, icon: Icon }) => (
          <article className="admin-stat-card" key={key}>
            <div className="admin-stat-heading">
              <h2>{label}</h2>
              <span className="admin-stat-icon">
                <Icon size={24} />
              </span>
            </div>
            <p className="admin-stat-value">{summary ? summary[key] : "—"}</p>
            <span className="admin-stat-note">
              {summary ? "Current store total" : "Loading…"}
            </span>
          </article>
        ))}
      </section>
      <section className="dashboard-customers" aria-label="Customer overview">
        <Link to="/admin/customers">
          <strong>{summary ? summary.customers : "—"}</strong>
          <span>Registered customers</span>
        </Link>
      </section>
    </>
  );
}
