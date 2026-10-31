import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { shopApi } from "../api/shop.js";
import ProductFilters from "../components/shop/ProductFilters.jsx";
import ShopProductCard from "../components/shop/ShopProductCard.jsx";

export default function ProductListing() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const query = params.toString();
  const [data, setData] = useState({
    products: [],
    pagination: { page: 1, totalPages: 1, total: 0 },
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [loadedQuery, setLoadedQuery] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [result, options] = await Promise.all([
          shopApi.products(new URLSearchParams(query), controller.signal),
          shopApi.categories(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setData(result);
          setCategories(options.categories);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadedQuery(query);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [query, reload]);
  function filter(next) {
    setLoading(true);
    if (next.toString() === query) setReload((value) => value + 1);
    else setParams(next);
  }
  function page(number) {
    if (number === data.pagination.page) return;
    const next = new URLSearchParams(params);
    next.set("page", number);
    setLoading(true);
    setParams(next);
  }
  const isLoading = loading || loadedQuery !== query;
  const selectedCategory = categories.find(
    (category) => category.id === params.get("category"),
  );
  const start = Math.max(
    1,
    Math.min(data.pagination.page - 2, data.pagination.totalPages - 4),
  );
  return (
    <main className="shop-page shop-listing-page">
      <p className="shop-breadcrumb">
        <Link to="/">Home</Link> / <Link to="/products">Products</Link>
        {selectedCategory && <> / {selectedCategory.name}</>}
      </p>
      <div className="shop-heading">
        <div>
          <h1>
            {selectedCategory ? selectedCategory.name : "Explore Products"}
          </h1>
          <p>
            {selectedCategory
              ? `Explore products in ${selectedCategory.name}.`
              : "Find your next everyday essential."}
          </p>
        </div>
        <span>
          {isLoading
            ? "Loading products…"
            : `${data.pagination.total} products`}
        </span>
      </div>
      {location.state?.notice && (
        <p className="shop-notice" role="status">
          {location.state.notice}
        </p>
      )}
      <div className="shop-catalog-layout">
        <ProductFilters
          key={query}
          params={params}
          categories={categories}
          onApply={filter}
        />
        <section className="shop-catalog-results" aria-label="Product results">
          {error && (
            <p className="shop-error" role="alert">
              {error}{" "}
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setReload(reload + 1);
                }}
              >
                Try again
              </button>
            </p>
          )}
          {isLoading ? (
            <p role="status">Loading products…</p>
          ) : (
            !error && (
              <>
                <div className="shop-grid">
                  {data.products.map((product) => (
                    <ShopProductCard key={product.id} product={product} />
                  ))}
                </div>
                {!data.products.length && (
                  <div className="shop-empty">
                    <h2>No products found</h2>
                    <p>Try a different search or clear your filters.</p>
                  </div>
                )}
                <nav
                  className="shop-pagination"
                  aria-label="Product pagination"
                >
                  <button
                    disabled={isLoading || data.pagination.page <= 1}
                    onClick={() => page(data.pagination.page - 1)}
                  >
                    Previous
                  </button>
                  {Array.from(
                    { length: Math.min(5, data.pagination.totalPages) },
                    (_, index) => start + index,
                  ).map((number) => (
                    <button
                      key={number}
                      aria-current={
                        number === data.pagination.page ? "page" : undefined
                      }
                      onClick={() => page(number)}
                    >
                      {number}
                    </button>
                  ))}
                  <button
                    disabled={
                      isLoading ||
                      data.pagination.page >= data.pagination.totalPages
                    }
                    onClick={() => page(data.pagination.page + 1)}
                  >
                    Next
                  </button>
                </nav>
              </>
            )
          )}
        </section>
      </div>
    </main>
  );
}
