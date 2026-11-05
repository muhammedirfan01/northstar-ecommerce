import { Link, NavLink, Outlet } from "react-router";
import {
  Compass,
  LayoutDashboard,
  Archive,
  Shapes,
  Users,
  Warehouse,
  Tag,
  BadgePercent,
  ChartNoAxesColumnIncreasing,
  Settings2,
  LogOut,
} from "lucide-react";
import ProfileAvatar from "../profile/ProfileAvatar.jsx";
import "./admin.css";
import "./management.css";
import "./catalog.css";
const navigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin",
  },
  {
    label: "Products",
    icon: Archive,
    path: "/admin/products",
  },
  {
    label: "Categories",
    icon: Shapes,
    path: "/admin/categories",
  },
  {
    label: "Customers",
    icon: Users,
    path: "/admin/customers",
  },
  {
    label: "Inventory",
    icon: Warehouse,
  },
];
const salesNavigation = [
  {
    label: "Coupons",
    icon: Tag,
  },
  {
    label: "Offers and Campaigns",
    icon: BadgePercent,
  },
  {
    label: "Sales Report",
    icon: ChartNoAxesColumnIncreasing,
  },
];
const system = [
  {
    label: "Settings",
    icon: Settings2,
  },
];
const navigationSystems = [
  {
    title: "Main",
    items: navigation,
  },
  {
    title: "Sales and Marketing",
    items: salesNavigation,
  },
  {
    title: "System",
    items: system,
  },
];
export default function AdminLayout({ user, logout }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand">
          <Compass size={25} aria-hidden="true" />
          <span>
            <strong>NORTHSTAR</strong>
            <small>ADMIN PANEL</small>
          </span>
        </Link>
        <nav className="admin-navigation" aria-label="Admin navigation">
          {navigationSystems.map((sections) => (
            <div className="admin-navigation-section" key={sections.title}>
              <h4 className="admin-navigation-label">{sections.title}</h4>
              <div className="admin-navigation-links">
                {sections.items.map(({ label, icon: Icon, path }) => {
                  if (!path) {
                    return (
                      <span
                        key={label}
                        className="admin-nav-item is-unavailable"
                        aria-disabled="true"
                        title="Coming soon"
                      >
                        <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                        <span>{label}</span>
                      </span>
                    );
                  }
                  return (
                    <NavLink
                      key={label}
                      to={path}
                      end={path === "/admin"}
                      className={({ isActive }) =>
                        isActive ? "admin-nav-item is-active" : "admin-nav-item"
                      }
                    >
                      <Icon
                        size={19}
                        strokeWidth={1.9}
                        aria-hidden="true"
                      ></Icon>
                      <span>{label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="admin-account">
          <span className="admin-account-avatar">
            <ProfileAvatar user={user} />
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button
            className="admin-logout"
            type="button"
            onClick={logout}
            aria-label="Sign out"
            >
            <LogOut size={20} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
