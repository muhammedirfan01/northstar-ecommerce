import { useContext, useEffect, useState } from "react";
import { Link } from "react-router";
import { shopApi } from "../api/shop.js";
import { ShoppingContext } from "../context/ShoppingContext.js";
import ShopProductCard from "../components/shop/ShopProductCard.jsx";

export default function Wishlist() {
  const { wishlistIds } = useContext(ShoppingContext);
  const ids = wishlistIds.join(",");
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    shopApi
      .wishlist(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProducts(result.products);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
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
            <ShopProductCard key={product.id} product={product} />
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
