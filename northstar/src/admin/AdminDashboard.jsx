import { Link } from "react-router";
import { ShoppingBag, CircleCheck, ClipboardList } from "lucide-react";

// Placeholder values until dashboard features are added.
const statistics = [
  { label: "Total orders", value: "0", note: "No orders yet", icon: ShoppingBag, tone: "green" },
  { label: "Fulfilled orders", value: "0", note: "No fulfilled orders", icon: CircleCheck, tone: "blue" },
  { label: "Pending to fulfil", value: "0", note: "No pending orders", icon: ClipboardList, tone: "amber" },
];

export default function AdminDashboard() {
  return <>
    <div className="admin-page-heading">
      <div><h1>Dashboard Overview</h1><p>Store performance overview.</p></div>
    </div>

    <section className="admin-stats" aria-label="Store overview">
      {statistics.map(({ label, value, note, icon: Icon, tone }) => <article className="admin-stat-card" key={label}>
        <div className="admin-stat-heading"><h2>{label}</h2><span className="admin-stat-icon"><Icon size={24} /></span></div>
        <p className="admin-stat-value">{value}</p><span className={`admin-stat-note ${tone}`}>{note}</span>
      </article>)}
    </section>

    <section className="dashboard-customers" aria-label="Customer overview">
      <Link to="/admin/customers"><strong>0</strong><span>Registered customers</span></Link>
    </section>
  </>;
}
