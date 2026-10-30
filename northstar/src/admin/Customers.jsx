import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { adminApi } from "../api/admin.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import CustomerDetails from "./CustomerDetails.jsx";
import "./customers.css";

const emptyData = {
  customers: [],
  summary: { total: 0, active: 0, blocked: 0 },
  pagination: { page: 1, totalPages: 1, total: 0 },
};

export default function Customers() {
  const [data, setData] = useState(emptyData);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [deletedCustomer, setDeletedCustomer] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [reload, setReload] = useState(0);

  const { customers, summary, pagination } = data;

  // Fetch a new page when the search, filters or page number changes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      try {
        const result = await adminApi.customers(
          { page, limit: rowsPerPage, search: search.trim(), status },
          controller.signal
        );
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCustomers();

    // Ignore an older request when the user changes the search quickly.
    return () => controller.abort();
  }, [search, status, page, rowsPerPage, reload]);

  function refreshCustomers() {
    setLoading(true);
    setError("");
    setReload(value => value + 1);
  }

  function changeSearch(value) {
    setSearch(value);
    setPage(1);
    setLoading(true);
    setError("");
  }

  function changeStatus(value) {
    setStatus(value);
    setPage(1);
    setLoading(true);
    setError("");
  }

  function changePage(value) {
    setPage(value);
    setLoading(true);
    setError("");
  }

  function changeRowsPerPage(value) {
    setRowsPerPage(Number(value));
    setPage(1);
    setLoading(true);
    setError("");
  }

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPage(1);
    setLoading(true);
    setError("");
  }

  async function changeCustomerStatus(customer) {
    setSaving(true);
    setError("");
    try {
      await adminApi.setCustomerStatus(customer.id, !customer.isBlocked);
      setMessage(`${customer.name} ${customer.isBlocked ? "unblocked" : "blocked"}.`);
      setDeletedCustomer(null);
      refreshCustomers();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer) {
    setSaving(true);
    setError("");
    try {
      await adminApi.deleteCustomer(customer.id);
      setDeletedCustomer(customer);
      setMessage(`${customer.name} removed.`);
      refreshCustomers();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function undoDelete() {
    setSaving(true);
    setError("");
    try {
      await adminApi.restoreCustomer(deletedCustomer.id);
      setMessage("Customer restored.");
      setDeletedCustomer(null);
      refreshCustomers();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function askToChangeStatus(customer) {
    const action = customer.isBlocked ? "Unblock" : "Block";
    setConfirmation({ customer, action });
  }

  function askToDelete(customer) {
    setConfirmation({ customer, action: "Delete" });
  }

  async function confirmAction() {
    const { customer, action } = confirmation;
    setConfirmation(null);
    if (action === "Delete") {
      await deleteCustomer(customer);
    } else {
      await changeCustomerStatus(customer);
    }
  }

  return (
    <section className="cm-page" aria-labelledby="customers-title">
      <p className="cm-breadcrumb">Customers / Customer management</p>
      <div className="cm-heading">
        <div>
          <h1 id="customers-title">Customer Management</h1>
          <p>Manage customer accounts and review their activity.</p>
        </div>
        <div className="cm-summary">
          <span><strong>{summary.total}</strong> Total customers</span>
          <span className="cm-active-text">● {summary.active} Active</span>
          <span className="cm-blocked-text">● {summary.blocked} Blocked</span>
        </div>
      </div>

      {confirmation && (
        <div className="cm-notice" role="alert">
          <span>{confirmation.action} {confirmation.customer.name}?</span>
          <div>
            <button className="cm-button" type="button" autoFocus onClick={() => setConfirmation(null)}>Cancel</button>
            <button className="cm-button" type="button" onClick={confirmAction}>Confirm</button>
          </div>
        </div>
      )}

      {message && (
        <div className="cm-notice" role="status">
          <span>{message}</span>
          <div>
            {deletedCustomer && <button type="button" disabled={saving} onClick={undoDelete}>Undo</button>}
            <button className="cm-icon-button" type="button" aria-label="Dismiss notification" onClick={() => setMessage("")}><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="cm-toolbar">
        <div className="cm-search">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Search customers" type="search" maxLength={100} value={search} placeholder="Search by name, email or ID..." onChange={event => changeSearch(event.target.value)} />
          {search && <button className="cm-icon-button" type="button" aria-label="Clear search" onClick={() => changeSearch("")}><X size={15} /></button>}
        </div>
        <label className="cm-filter">
          Status:
          <select value={status} onChange={event => changeStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        <button className="cm-clear" type="button" disabled={!search && status === "all"} onClick={clearFilters}>Clear filters</button>
      </div>

      {error && <div className="cm-notice cm-error" role="alert"><span>{error}</span><button className="cm-button" type="button" disabled={saving} onClick={refreshCustomers}>Try again</button></div>}

      <div className="cm-table-card" aria-busy={loading}>
        <div className="cm-table-scroll">
          <table className="cm-table">
            <caption className="cm-sr-only">Registered customers, latest registered first</caption>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Status</th>
                <th scope="col">Orders</th>
                <th scope="col">Returned orders</th>
                <th scope="col">Joined date</th>
                <th scope="col" className="cm-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !error && customers.map(customer => (
                <tr key={customer.id}>
                  <td>
                    <div className="cm-person">
                      <span className="cm-avatar"><ProfileAvatar user={customer} /></span>
                      <div><strong>{customer.name}</strong><span>{customer.email}</span></div>
                    </div>
                  </td>
                  <td><span className={`cm-status ${customer.isBlocked ? "is-blocked" : "is-active"}`}>● {customer.isBlocked ? "Blocked" : "Active"}</span></td>
                  <td>{customer.totalOrders}</td>
                  <td>{customer.returnedOrders}</td>
                  <td className="cm-date">{new Date(customer.createdAt).toLocaleDateString("en-IN", { timeZone: "UTC" })}</td>
                  <td>
                    <div className="cm-row-actions">
                      <button className="cm-button" type="button" disabled={saving || confirmation !== null} aria-label={`View ${customer.name}`} onClick={() => setSelectedCustomer(customer)}>View</button>
                      <button className={`cm-button ${customer.isBlocked ? "cm-unblock" : "cm-block"}`} type="button" disabled={saving || confirmation !== null} aria-label={`${customer.isBlocked ? "Unblock" : "Block"} ${customer.name}`} onClick={() => askToChangeStatus(customer)}>{customer.isBlocked ? "Unblock" : "Block"}</button>
                      <button className="cm-button cm-delete" type="button" disabled={saving || confirmation !== null} aria-label={`Delete ${customer.name}`} onClick={() => askToDelete(customer)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && <p className="cm-empty" role="status">Loading customers…</p>}
          {!loading && !error && customers.length === 0 && <div className="cm-empty"><h2>No customers found</h2><p>Try another search or clear your filters.</p></div>}
        </div>

        <div className="cm-pagination">
          <span>{pagination.total} customers</span>
          <nav aria-label="Customer pagination">
            <button type="button" disabled={loading || pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}>Previous</button>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)}>Next</button>
          </nav>
          <label>
            Rows per page:
            <select value={rowsPerPage} onChange={event => changeRowsPerPage(event.target.value)}>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
        </div>
      </div>

      {selectedCustomer && <CustomerDetails customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}
    </section>
  );
}
