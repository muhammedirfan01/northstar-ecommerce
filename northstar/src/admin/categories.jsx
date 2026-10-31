import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Search, X } from "lucide-react";
import { categoryApi } from "../api/catalog.js";
import CategoryForm from "./catalog/CategoryForm.jsx";
import ConfirmAction from "./catalog/ConfirmAction.jsx";
import Pagination from "./catalog/Pagination.jsx";
import "./customers.css";
import "./catalog/catalog.css";

export default function Categories() {
  const [data, setData] = useState({
    categories: [],
    summary: { total: 0, listed: 0, unlisted: 0 },
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const [query, setQuery] = useState({
    search: "",
    status: "all",
    page: 1,
    limit: 10,
  });
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await categoryApi.list(query, controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [query, reload]);

  function change(values) {
    setQuery({ ...query, page: 1, ...values });
    setLoading(true);
  }
  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }
  function ask(category, kind) {
    setAction({ category, kind });
    setActionError("");
  }
  async function confirm() {
    setBusy(true);
    setActionError("");
    try {
      if (action.kind === "delete")
        await categoryApi.remove(action.category.id);
      else
        await categoryApi.setListed(
          action.category.id,
          !action.category.isListed,
        );
      setMessage(
        action.kind === "delete"
          ? "Category and its products permanently deleted."
          : "Category status updated.",
      );
      setAction(null);
      refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cm-page catalog-page">
      <p className="cm-breadcrumb">Catalog / Categories</p>
      <div className="cm-heading">
        <div>
          <h1>Categories</h1>
          <p>Organise and manage your product categories.</p>
        </div>
        <div className="cm-summary">
          <span>
            <strong>{data.summary.total}</strong> Total categories
          </span>
          <span className="cm-active-text">● {data.summary.listed} Listed</span>
          <span className="catalog-muted">
            ● {data.summary.unlisted} Unlisted
          </span>
        </div>
      </div>
      {message && (
        <p className="cm-notice" role="status">
          {message}
        </p>
      )}
      <div className="cm-toolbar">
        <div className="cm-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search categories"
            placeholder="Search category names…"
            maxLength={100}
            value={query.search}
            onChange={(event) => change({ search: event.target.value })}
          />
          {query.search && (
            <button
              className="cm-icon-button"
              type="button"
              aria-label="Clear search"
              onClick={() => change({ search: "" })}
            >
              <X size={15} />
            </button>
          )}
        </div>
        <label className="cm-filter">
          Status{" "}
          <select
            value={query.status}
            onChange={(event) => change({ status: event.target.value })}
          >
            <option value="all">All statuses</option>
            <option value="listed">Listed</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </label>
        <button
          className="cm-clear"
          type="button"
          disabled={!query.search && query.status === "all"}
          onClick={() => change({ search: "", status: "all" })}
        >
          Clear filters
        </button>
        <button
          className="catalog-primary catalog-add"
          type="button"
          onClick={() => setEditing({})}
        >
          <Plus size={16} /> Add category
        </button>
      </div>
      {error && (
        <div className="cm-notice cm-error" role="alert">
          {error}
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      <div className="cm-table-card" aria-busy={loading}>
        <div className="cm-table-scroll">
          <table className="cm-table">
            <caption className="cm-sr-only">Categories, latest first</caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>Products</th>
                <th>Status</th>
                <th>Created</th>
                <th className="cm-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                !error &&
                data.categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="catalog-person">
                        {category.image ? (
                          <img src={category.image.url} alt="" />
                        ) : (
                          <span className="catalog-thumbnail-placeholder">
                            {category.name[0]}
                          </span>
                        )}
                        <div>
                          <strong>{category.name}</strong>
                          <small>
                            {category.parentName
                              ? `Under ${category.parentName}${category.parentListed ? "" : " (parent unlisted)"}`
                              : "Main category"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{category.productCount} products</td>
                    <td>
                      <span
                        className={`cm-status ${category.isListed ? "is-active" : "catalog-unlisted"}`}
                      >
                        {category.isListed ? "Listed" : "Unlisted"}
                      </span>
                    </td>
                    <td className="cm-date">
                      {new Date(category.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <div className="catalog-row-actions">
                        <button
                          className="cm-button"
                          type="button"
                          onClick={() => setEditing(category)}
                        >
                          Edit
                        </button>
                        <Link
                          className="cm-button"
                          to={`/admin/products?category=${category.id}`}
                        >
                          View products
                        </Link>
                        <button
                          className="cm-button"
                          type="button"
                          onClick={() => ask(category, "status")}
                        >
                          {category.isListed ? "Unlist" : "List"}
                        </button>
                        <button
                          className="cm-button cm-delete"
                          type="button"
                          onClick={() => ask(category, "delete")}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <p className="cm-empty" role="status">
            Loading categories…
          </p>
        )}
        {!loading && !error && !data.categories.length && (
          <div className="cm-empty">
            <h2>No categories found</h2>
            <p>Add a category or clear your search.</p>
          </div>
        )}
        <Pagination
          itemLabel="categories"
          pagination={data.pagination}
          disabled={loading}
          onPage={(page) => change({ page })}
          onLimit={(limit) => change({ limit })}
        />
      </div>
      {editing && (
        <CategoryForm
          category={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage("Category saved.");
            refresh();
          }}
        />
      )}
      {action && (
        <ConfirmAction
          title={
            action.kind === "delete"
              ? "Delete category permanently?"
              : `${action.category.isListed ? "Unlist" : "List"} category?`
          }
          description={
            action.kind === "delete"
              ? `Permanently delete “${action.category.name}”, its ${action.category.productCount} products and ${action.category.subcategoryCount || 0} subcategories? Their variants, reviews and uploaded photos will also be removed. This cannot be undone. Products used in orders must be unlisted instead.`
              : action.category.isListed
                ? "This category and its products will be hidden from customers. You can list it again later."
                : "This category can appear to customers again. Only published, listed products with stock will be shown."
          }
          busy={busy}
          error={actionError}
          danger={action.kind === "delete"}
          confirmLabel={
            action.kind === "delete"
              ? "Delete category and products"
              : "Confirm"
          }
          onConfirm={confirm}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  );
}
