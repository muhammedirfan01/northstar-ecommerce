import { useState } from "react";
import { Download, Search } from "lucide-react";
import Pagination from "../../../components/ui/Pagination.jsx";
import AdminDialog from "../AdminDialog.jsx";
import { label, download } from "./data.js";
export function Badge({ value }) {
  return (
    <span className={`cm-status ops-badge ops-${value || "pending"}`}>
      {label(value)}
    </span>
  );
}
export function DirectoryHeader({ eyebrow, title, description, summary, children }) {
  return (
    <header>
      {eyebrow && <p className="cm-breadcrumb">{eyebrow}</p>}
      <div className="cm-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {summary || <div className="ops-heading-actions">{children}</div>}
      </div>
      {summary && children && <div className="ops-directory-actions">{children}</div>}
    </header>
  );
}
export function Stats({ cards }) {
  return (
    <section className="cm-summary ops-summary" aria-label="Summary">
      {cards.map(({ name, value, hint }) => (
        <span key={name} title={hint}>
          <strong>{value ?? "—"}</strong> {name}
        </span>
      ))}
    </section>
  );
}
export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="cm-search ops-search">
      <Search size={16} aria-hidden="true" />
      <input
        aria-label={placeholder}
        maxLength={100}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function Pager({ pagination, change }) {
  return (
    pagination && (
      <Pagination
        pagination={pagination}
        itemLabel="results"
        onPage={(page) => change("page", String(page))}
        onLimit={(limit) => change("limit", String(limit))}
        pageSizes={[10, 25, 50]}
      />
    )
  );
}
export function Modal(props) {
  return <AdminDialog {...props} />;
}
export function ExportButton({ url, filename, onError }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="cm-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await download(url, filename);
        } catch (e) {
          onError(e.response?.data?.message || "Export failed. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download size={15} />
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}
