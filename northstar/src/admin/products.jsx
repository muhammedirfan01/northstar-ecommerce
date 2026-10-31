import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, Search, X } from "lucide-react";
import { categoryApi, productApi } from "../api/catalog.js";
import Pagination from "./catalog/Pagination.jsx";
import ConfirmAction from "./catalog/ConfirmAction.jsx";
import "./customers.css";
import "./catalog/catalog.css";

const money = (paise) =>
  (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
export default function Products() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState({
    search: "",
    status: "all",
    category: params.get("category") || "",
    page: 1,
    limit: 10,
  });
  const [data, setData] = useState({
    products: [],
    summary: { total: 0, published: 0, lowStock: 0 },
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [result, options] = await Promise.all([
          productApi.list(query, controller.signal),
          categoryApi.list({ options: true }, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setData(result);
          setCategories(options.categories);
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
  function ask(product, kind) {
    setAction({ product, kind });
    setActionError("");
  }
  async function confirm() {
    setBusy(true);
    setActionError("");
    try {
      if (action.kind === "delete") await productApi.remove(action.product.id);
      else
        await productApi.setListed(action.product.id, !action.product.isListed);
      setMessage(
        action.kind === "delete"
          ? "Product permanently deleted."
          : "Product status updated.",
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
      <p className="cm-breadcrumb">Catalog / Manage products</p>
      <div className="cm-heading">
        <div>
          <h1>Manage Products</h1>
          <p>Manage product details, images, publication and stock.</p>
        </div>
        <div className="cm-summary">
          <span>
            <strong>{data.summary.total}</strong> Total products
          </span>
          <span className="cm-active-text">
            ● {data.summary.published} Published
          </span>
          <span className="cm-blocked-text">
            ● {data.summary.lowStock} Low stock
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
            aria-label="Search products"
            placeholder="Search product names…"
            value={query.search}
            maxLength={100}
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
          Category
          <select
            value={query.category}
            onChange={(event) => change({ category: event.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentName
                  ? `${category.parentName} → ${category.name}`
                  : category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-filter">
          Status
          <select
            value={query.status}
            onChange={(event) => change({ status: event.target.value })}
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="unlisted">Unlisted</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </label>
        <button
          className="cm-clear"
          type="button"
          disabled={!query.search && !query.category && query.status === "all"}
          onClick={() => change({ search: "", category: "", status: "all" })}
        >
          Clear filters
        </button>
        <Link className="catalog-primary catalog-add" to="/admin/products/new">
          <Plus size={16} /> Add product
        </Link>
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
            <caption className="cm-sr-only">Products, latest first</caption>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th className="cm-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                !error &&
                data.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="catalog-person">
                        <img src={product.images[0]?.url} alt="" />
                        <div>
                          <strong>{product.name}</strong>
                          <small>
                            {product.variants.length
                              ? `${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`
                              : "Single product"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {product.category.name}
                      {!product.category.isListed && (
                        <small className="catalog-muted"> (unlisted)</small>
                      )}
                    </td>
                    <td className="catalog-price">
                      {money(product.pricePaise)}
                    </td>
                    <td>
                      <span
                        className={
                          product.stock === 0
                            ? "catalog-muted"
                            : product.stock <= 5
                              ? "cm-blocked-text"
                              : "cm-active-text"
                        }
                      >
                        ● {product.stock}{" "}
                        {product.stock ? "in stock" : "out of stock"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`cm-status ${product.isListed && product.isPublished ? "is-active" : "catalog-unlisted"}`}
                      >
                        {!product.isListed
                          ? "Unlisted"
                          : product.isPublished
                            ? "Published"
                            : "Draft"}
                      </span>
                    </td>
                    <td>
                      <div className="catalog-row-actions">
                        <Link
                          className="cm-button"
                          to={`/admin/products/${product.id}/edit`}
                        >
                          Edit
                        </Link>
                        <Link
                          className="cm-button"
                          to={`/admin/products/${product.id}/variants`}
                        >
                          Variants
                        </Link>
                        <button
                          className="cm-button"
                          type="button"
                          onClick={() => ask(product, "status")}
                        >
                          {product.isListed ? "Unlist" : "List"}
                        </button>
                        <button
                          className="cm-button cm-delete"
                          type="button"
                          onClick={() => ask(product, "delete")}
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
            Loading products…
          </p>
        )}
        {!loading && !error && !data.products.length && (
          <div className="cm-empty">
            <h2>No products found</h2>
            <p>Add a product or clear your filters.</p>
          </div>
        )}
        <Pagination
          itemLabel="products"
          pagination={data.pagination}
          disabled={loading}
          onPage={(page) => change({ page })}
          onLimit={(limit) => change({ limit })}
        />
      </div>
      {action && (
        <ConfirmAction
          title={
            action.kind === "delete"
              ? "Delete product permanently?"
              : `${action.product.isListed ? "Unlist" : "List"} product?`
          }
          description={
            action.kind === "delete"
              ? `“${action.product.name}”, its variants and images will be permanently removed. Products used in orders cannot be deleted.`
              : action.product.isListed
                ? "Customers will no longer see this product. You can list it again later."
                : "This product can be shown again if it is published, its category is listed, and it has stock."
          }
          busy={busy}
          error={actionError}
          danger={action.kind === "delete"}
          onConfirm={confirm}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  );
}
