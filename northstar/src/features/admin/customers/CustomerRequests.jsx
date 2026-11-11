import { useState } from "react";
import { API, useAdminData, useDirectory, date } from "../operations/data.js";
import {
  DirectoryHeader,
  SearchBox,
  Pager,
  Modal,
  Badge,
} from "../operations/shared.jsx";
import "./requests.css";

function RequestDialog({ request, close, saved }) {
  const [note, setNote] = useState(request.resolutionNote || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function update(status) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await API.patch(`/admin/customer-requests/${request.id}`, {
        status,
        note: note.trim(),
        version: request.version,
      });
      saved();
    } catch (failure) {
      setError(
        failure.response?.data?.message || "The request could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Customer request"
      subtitle={`${request.reference} · ${date(request.createdAt)}`}
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="ops-modal-body request-details">
        <dl className="cm-details">
          <div>
            <dt>Customer</dt>
            <dd>
              {request.name}
              <small>{request.email}</small>
            </dd>
          </div>
          <div>
            <dt>Subject</dt>
            <dd>{request.subject}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{request.status === "closed" ? "Fulfilled" : request.status === "in_progress" ? "In progress" : "Open"}</dd>
          </div>
        </dl>
        <section className="request-message">
          <h3>Message</h3>
          <p>{request.message}</p>
        </section>
        <label>
          Internal note (optional)
          <textarea
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
          />
          <small>
            This note is for your records. It is not emailed to the customer.
          </small>
        </label>
        {error && (
          <p role="alert" className="cm-notice cm-error">
            {error}
          </p>
        )}
        <footer className="ops-modal-actions">
          <button className="cm-button" onClick={close} disabled={busy}>
            Close
          </button>
          {request.status === "open" && <button className="cm-button" disabled={busy} onClick={() => update("in_progress")}>Mark in progress</button>}
          <button className="catalog-primary" disabled={busy} onClick={() => update(request.status === "closed" ? "open" : "closed")}>
            {busy
              ? "Saving…"
              : request.status !== "closed"
                ? "Fulfill request"
                : "Reopen request"}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
export default function CustomerRequests() {
  const { values, query, change, clear } = useDirectory({ status: "" });
  const { data, error, refresh } = useAdminData(
    `/admin/customer-requests?${query}`,
  );
  const [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");
  return (
    <section className="cm-page catalog-page requests-page">
      <DirectoryHeader
        summary={<div className="cm-summary">
        <span>
          <strong>{data?.summary.total ?? "—"}</strong> Total requests
        </span>
        <span>
          <strong>{data?.summary.open ?? "—"}</strong> Open
        </span>
        <span><strong>{data?.summary.in_progress ?? 0}</strong> In progress</span>
        <span className="cm-active-text">
          <strong>{data?.summary.closed ?? "—"}</strong> Fulfilled
        </span>
      </div>}
        title="Customer Requests"
        description="Manage customer requests and follow up on open enquiries."
      />

      {(error || notice) && (
        <p
          className={`cm-notice ${error ? "cm-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </p>
      )}
      <div className="cm-toolbar ops-filters">
        <SearchBox
          value={values.search}
          onChange={(value) => change("search", value)}
          placeholder="Search requests by customer, subject or reference…"
        />
        <select
          aria-label="Request status"
          value={values.status}
          onChange={(event) => change("status", event.target.value)}
        >
          <option value="">All requests</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Fulfilled</option>
        </select>
        <button className="cm-clear" onClick={clear}>
          Clear filters
        </button>
      </div>
      <section className="cm-table-card">
        <div className="cm-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {["Request", "Customer", "Date received", "Status", "Action"].map(
                  (name) => (
                    <th key={name}>{name}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data?.requests.map((request) => (
                <tr key={request.id}>
                  <td className="request-subject-cell">
                    <strong>{request.subject}</strong>
                    <small>{request.message.slice(0, 95)}{request.message.length > 95 ? "…" : ""} · {request.reference}</small>
                  </td>
                  <td><strong>{request.name}</strong><small>{request.email}</small></td>
                  <td className="request-date">{new Date(request.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td><Badge value={request.status === "closed" ? "fulfilled" : request.status} /></td>
                  <td>
                    <button
                      className="cm-button"
                      aria-label={`View request ${request.reference}`}
                      onClick={() => setSelected(request)}
                    >
                      View request
                    </button>
                  </td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan={5}>
                    {error ? "Unable to load requests." : "Loading requests…"}
                  </td>
                </tr>
              )}
              {data && !data.requests.length && (
                <tr>
                  <td className="ops-empty" colSpan={5}>
                    No customer requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {selected && (
        <RequestDialog
          request={selected}
          close={() => setSelected(null)}
          saved={() => {
            setSelected(null);
            setNotice("Customer request updated.");
            refresh();
          }}
        />
      )}
    </section>
  );
}
