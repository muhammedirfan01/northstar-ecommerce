import { useEffect, useState } from "react";
import { Link } from "react-router";
import API from "../../api/API.js";
import ShopProductCard from "../shop/ShopProductCard.jsx";
export default function Wishlist({ wishlistIds, addToCart, toggleWishlist }) {
  const ids = wishlistIds.join(",");
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      try {
        const response = await API.get("/wishlist", {
          signal: controller.signal,
        });
        const result = response.data.data;
        if (!controller.signal.aborted) {
          setProducts(result.products);
          setError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.response?.data?.message || error.message);
        }
      }
    }
    loadData();
    return () => controller.abort();
  }, [ids, reload]);
  return (
    <main className="shop-page">
      <p className="shop-breadcrumb">
        <Link to="/products">Products</Link> / Wishlist
      </p>
      <h1>Your Wishlist</h1>
      <p className="shop-help">
        Adding a product to your cart removes it from your wishlist.
      </p>
      {error && (
        <p className="shop-error" role="alert">
          {error}
          <button onClick={() => setReload(reload + 1)}>Try again</button>
        </p>
      )}
      {!products ? (
        !error && <p role="status">Loading wishlist…</p>
      ) : products.length ? (
        <div className="shop-grid">
          {products.map((product) => (
            <ShopProductCard key={product.id} product={product} wishlistIds={wishlistIds} addToCart={addToCart} toggleWishlist={toggleWishlist} />
          ))}
        </div>
      ) : (
        <div className="shop-empty">
          <h2>Your wishlist is empty</h2>
          <Link to="/products">Discover products</Link>
        </div>
      )}
    </main>
  );
}
