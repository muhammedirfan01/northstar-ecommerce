import { NavLink } from "react-router";
import "./requests.css";
export default function CustomerNav() {
  return (
    <nav className="customer-admin-tabs" aria-label="Customer sections">
      <NavLink to="/admin/customers" end>
        Customers
      </NavLink>
      <NavLink to="/admin/customers/requests">Customer Requests</NavLink>
    </nav>
  );
}
