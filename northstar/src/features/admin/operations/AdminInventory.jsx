import { useState } from "react";
import { Package } from "lucide-react";
import { DirectoryHeader, SearchBox, Pager, Badge, Modal, ExportButton } from "./shared.jsx";
import { API, useDirectory, useAdminData, date } from "./data.js";
import "./admin-simple.css";
function StockDialog({ product, close, saved }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id || "");
  const option =
    product.variants.find((variant) => variant.id === variantId) || product;
  const [stock, setStock] = useState(option.stock);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const nextStock = stock === "" ? NaN : Number(stock);
  async function submit(event) {
    event.preventDefault();
    if (busy || nextStock === option.stock) return;
    setBusy(true);
    setError("");
    try {
      await API.post(`/admin/inventory/${product.id}/adjustments`, {
        variantId: variantId || null,
        quantity: nextStock - option.stock,
        version: product.version,
        requestId,
      });
      saved();
    } catch (failure) {
      setError(failure.response?.data?.message || failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Update stock"
      subtitle={product.name}
      close={() => {
        if (!busy) close();
      }}
    >
      <form className="ops-modal-body inventory-simple-form" onSubmit={submit}>
        {product.variants.length > 0 && (
          <label>
            Product option
            <select
              disabled={busy}
              value={variantId}
              onChange={(event) => {
                const variant = product.variants.find(
                  (value) => value.id === event.target.value,
                );
                setVariantId(variant.id);
                setStock(variant.stock);
              }}
            >
              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="inventory-simple-stock">
          <span>Current stock</span>
          <strong>{option.stock} units</strong>
        </div>
        <label>
          New stock quantity
          <input
            type="number"
            min="0"
            max="100000000"
            step="1"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            disabled={busy}
            required
            autoFocus
          />
        </label>
        <p className="inventory-stock-note" role="status">
          {Number.isSafeInteger(nextStock) && nextStock >= 0
            ? nextStock === option.stock ? "Enter a higher or lower quantity to adjust stock."
              : `${nextStock > option.stock ? "Increase" : "Decrease"} by ${Math.abs(nextStock - option.stock)} units`
            : "Enter a whole quantity of zero or more."}
        </p>
        {error && (
          <p role="alert" className="ops-error">
            {error}
          </p>
        )}
        <footer className="ops-modal-actions">
          <button
            type="button"
            className="cm-button"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="catalog-primary"
            disabled={
              busy ||
              !Number.isSafeInteger(nextStock) ||
              nextStock < 0 ||
              nextStock > 100000000 ||
              nextStock === option.stock
            }
          >
            {busy ? "Saving…" : "Save stock"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export default function AdminInventory() {
  const { values, change, clear, query } = useDirectory({
    category: "",
    stockStatus: "",
    sort: "stock-asc",
  });
  const { data, error, refresh } = useAdminData(`/admin/inventory?${query}`);
  const [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");
  const summary = data?.summary || {};
  return (
    <div className="cm-page catalog-page ops-page ops-inventory">
      <DirectoryHeader
        summary={<div className="cm-summary">
          <span>
            <strong>{summary.total ?? "—"}</strong> Total products
          </span>
          <span>
            <strong>{summary.lowStock ?? "—"}</strong> Low stock
          </span>
          <span className="cm-blocked-text">
            <strong>{summary.outOfStock ?? "—"}</strong> Out of stock
          </span>
        </div>}
        title="Inventory"
        description="Monitor stock levels and reconcile product quantities."
      >
        <ExportButton url={`/admin/inventory/export?${query}`} filename="northstar-inventory.csv" onError={setNotice} />
      </DirectoryHeader>

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={
            error || notice.includes("failed") ? "ops-error" : "ops-notice"
          }
        >
          {error || notice}
        </p>
      )}
      <div className="cm-toolbar ops-filters">
        <SearchBox
          value={values.search}
          onChange={(v) => change("search", v)}
          placeholder="Search by product name or ID…"
        />
        <select
          aria-label="Inventory category"
          value={values.category}
          onChange={(e) => change("category", e.target.value)}
        >
          <option value="">All categories</option>
          {data?.categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Stock status"
          value={values.stockStatus}
          onChange={(e) => change("stockStatus", e.target.value)}
        >
          <option value="">Stock Status: All</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <select
          aria-label="Sort stock"
          value={values.sort}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="stock-asc">Stock: Low to High</option>
          <option value="stock-desc">Stock: High to Low</option>
          <option value="name">Name: A to Z</option>
          <option value="updated">Last updated</option>
        </select>
        <button className="ops-clear" onClick={clear}>
          Clear Filters
        </button>
      </div>
      <section className="cm-table-card ops-table-card">
        <div className="cm-table-scroll ops-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                {[
                  "Product",
                  "Category",
                  "Available stock",
                  "Status",
                  "Last updated",
                  "Actions",
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="ops-product">
                      {p.image ? (
                        <img src={p.image} alt="" />
                      ) : (
                        <span className="ops-image-placeholder">
                          <Package size={22} />
                        </span>
                      )}
                      <div>
                        <b>{p.name}</b>
                      </div>
                    </div>
                  </td>
                  <td>{p.category?.name || "Uncategorized"}</td>
                  <td>
                    <b className={!p.stock ? "ops-negative" : ""}>
                      {p.stock} units
                    </b>
                    {p.variants.length > 0 && (
                      <small>{p.variants.length} options</small>
                    )}
                  </td>
                  <td>
                    <Badge
                      value={
                        !p.stock
                          ? "out_of_stock"
                          : p.stock <= 5
                            ? "low_stock"
                            : "in_stock"
                      }
                    />
                  </td>
                  <td>{date(p.updatedAt)}</td>
                  <td>
                    <div className="ops-row-actions">
                      <button
                        className={!p.stock ? "ops-primary" : ""}
                        onClick={() => setSelected(p)}
                      >
                        Update stock
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data && (
                <tr>
                  <td colSpan="6">
                    {error ? "Unable to load inventory." : "Loading inventory…"}
                  </td>
                </tr>
              )}
              {data && !data.products.length && (
                <tr>
                  <td colSpan="6" className="ops-empty">
                    No products match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} change={change} />
      </section>
      {selected && (
        <StockDialog
          product={selected}
          close={() => setSelected(null)}
          saved={() => {
            setSelected(null);
            refresh();
            setNotice("Stock adjustment saved.");
          }}
        />
      )}
    </div>
  );
}
