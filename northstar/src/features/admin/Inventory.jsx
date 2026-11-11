import { useEffect, useState } from "react";
import API from "../../api/API.js";
import "../shop/checkout.css";

function StockRow({ product, variant, refresh }) {
  const [stock, setStock] = useState(variant?.stock ?? product.stock);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await API.patch(`/admin/inventory/${product.id}`, {
        variantId: variant?.id || null,
        stock: Number(stock),
        version: product.version,
      });
      refresh();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="commerce-stock-row" onSubmit={save}>
      <span>
        <strong>{product.name}</strong>
        {variant && ` / ${variant.name}`}
      </span>
      <label>
        Stock
        <input
          aria-label={`Stock for ${product.name}${variant ? ` ${variant.name}` : ""}`}
          type="number"
          min="0"
          max="100000000"
          step="1"
          required
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </label>
      <button disabled={busy}>Save stock</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export default function Inventory() {
  const [data, setData] = useState(null),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const [reload, setReload] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    API.get("/admin/inventory", {
      signal: controller.signal,
      params: { search, page },
    })
      .then((r) => {
        if (!controller.signal.aborted) {
          setData(r.data.data);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.response?.data?.message || e.message);
      });
    return () => controller.abort();
  }, [search, page, reload]);
  return (
    <main className="commerce-page">
      <h1>Inventory</h1>
      <p>Update available stock. Orders reserve stock automatically.</p>
      <label>
        Search products
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {data ? (
        <section className="commerce-card">
          {!data.products.length && <p>No products found.</p>}
          {data.products.flatMap((p) =>
            p.variants.length
              ? p.variants.map((v) => (
                  <StockRow
                    key={`${p.id}-${v.id}-${p.version}`}
                    product={p}
                    variant={v}
                    refresh={() => setReload((r) => r + 1)}
                  />
                ))
              : [
                  <StockRow
                    key={`${p.id}-${p.version}`}
                    product={p}
                    refresh={() => setReload((r) => r + 1)}
                  />,
                ],
          )}
          <div className="commerce-actions">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages}
            </span>
            <button
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </section>
      ) : (
        <p role="status">Loading inventory…</p>
      )}
    </main>
  );
}
