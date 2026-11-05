import { ProductStatus, ProductStatusLabel } from "../../../constants/statuses.js";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus, Search, X } from "lucide-react";
import API from "../../../api/API.js";
import Pagination from "../../../components/ui/Pagination.jsx";
import ConfirmAction from "../ConfirmAction.jsx";
import "./products.css";
function productConfirmation(action) {
  if (!action) {
    return {};
  }
  if (action.kind === "delete") {
    return {
      title: "Delete product?",
      description:
        "This product will be hidden from customers. Its records and images will be kept, and you can restore it later.",
      label: "Delete product",
    };
  }
  if (action.kind === "restore") {
    return {
      title: "Restore product?",
      description:
        "Its previous listing status will be kept. Products appear only when their category is available, they are published and listed, and they have stock.",
      label: "Restore product",
    };
  }
  if (action.product.isListed) {
    return {
      title: "Unlist product?",
      description:
        "This product will be hidden from customers. You can list it again later.",
      label: "Unlist",
    };
  }
  return {
    title: "List product?",
    description: "Available products can appear to customers again.",
    label: "List",
  };
}
function productStatus(product) {
  if (product.deletedAt) {
    return ProductStatusLabel[ProductStatus.DELETED];
  }
  if (!product.isListed) {
    return ProductStatusLabel[ProductStatus.UNLISTED];
  }
  if (!product.isPublished) {
    return ProductStatusLabel[ProductStatus.DRAFT];
  }
  if (product.stock === 0) return ProductStatusLabel[ProductStatus.OUT_OF_STOCK];
  return ProductStatusLabel[ProductStatus.PUBLISHED];
}
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
    status: ProductStatus.ALL,
    sort: "latest",
    category: params.get("category") || "",
    page: 1,
    limit: 10,
  });
  const [data, setData] = useState({
    products: [],
    summary: {
      total: 0,
      published: 0,
      lowStock: 0,
    },
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    },
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
        const [resultResponse, optionsResponse] = await Promise.all([
          API.get("/admin/products", {
            signal: controller.signal,
            params: query,
          }),
          API.get("/admin/categories", {
            signal: controller.signal,
            params: {
              options: true,
            },
          }),
        ]);
        const result = resultResponse.data.data;
        const options = optionsResponse.data.data;
        if (!controller.signal.aborted) {
          setData(result);
          setCategories(options.categories);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.response?.data?.message || error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [query, reload]);
  function change(values) {
    setQuery({
      ...query,
      page: 1,
      ...values,
    });
    setLoading(true);
  }
  function refresh() {
    setLoading(true);
    setReload((value) => value + 1);
  }
  function ask(product, kind) {
    setAction({
      product,
      kind,
    });
    setActionError("");
  }
  async function confirm() {
    setBusy(true);
    setActionError("");
    try {
      let response;
      const url = "/admin/products/" + action.product.id;
      if (action.kind === "delete") {
        response = await API.delete(url, {
          data: {
            confirmDelete: true,
          },
        });
      } else if (action.kind === "restore") {
        response = await API.post(url + "/restore");
      } else {
        response = await API.patch(url + "/status", {
          isListed: !action.product.isListed,
        });
      }
      setMessage(response.data.message || "Status updated.");
      setAction(null);
      refresh();
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  }
  const confirmation = productConfirmation(action);
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
        <label className="cm-filter">Sort by
          <select value={query.sort} onChange={(event) => change({ sort: event.target.value })}>
            <option value="latest">Latest first</option>
            <option value="status-asc">Status: published first</option>
            <option value="status-desc">Status: unlisted first</option>
          </select>
        </label>
        <div className="cm-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search product names…"
            value={query.search}
            maxLength={100}
            onChange={(event) =>
              change({
                search: event.target.value,
              })
            }
          />
          {query.search && (
            <button
              className="cm-icon-button"
              type="button"
              aria-label="Clear search"
              onClick={() =>
                change({
                  search: "",
                })
              }
            >
              <X size={15} />
            </button>
          )}
        </div>
        <label className="cm-filter">
          Category
          <select
            value={query.category}
            onChange={(event) =>
              change({
                category: event.target.value,
              })
            }
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
            onChange={(event) =>
              change({
                status: event.target.value,
              })
            }
          >
            {Object.values(ProductStatus).filter((value) => value !== ProductStatus.LISTED).map((value) => <option key={value} value={value}>{ProductStatusLabel[value]}</option>)}
          </select>
        </label>
        <button
          className="cm-clear"
          type="button"
          disabled={!query.search && !query.category && query.status === ProductStatus.ALL && query.sort === "latest"}
          onClick={() =>
            change({
              search: "",
              category: "",
              status: ProductStatus.ALL,
              sort: "latest",
            })
          }
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
            <caption className="cm-sr-only">Products</caption>
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
                        className={`cm-status ${!product.deletedAt && product.isListed ? "is-active" : "catalog-unlisted"}`}
                      >
                        {productStatus(product)}
                      </span>
                    </td>
                    <td>
                      <div className="catalog-row-actions">
                        {product.deletedAt ? (
                          <button
                            className="cm-button"
                            type="button"
                            onClick={() => ask(product, "restore")}
                          >
                            Restore
                          </button>
                        ) : (
                          <>
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
                          </>
                        )}
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
          onPage={(page) =>
            change({
              page,
            })
          }
          onLimit={(limit) =>
            change({
              limit,
            })
          }
        />
      </div>
      {action && (
        <ConfirmAction
          title={confirmation.title}
          description={confirmation.description}
          busy={busy}
          error={actionError}
          danger={action.kind === "delete"}
          onConfirm={confirm}
          onClose={() => setAction(null)}
          confirmLabel={confirmation.label}
        />
      )}
    </section>
  );
}
