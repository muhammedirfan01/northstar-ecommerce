import { Link } from "react-router";

export default function NotFound() {
  return (
    <main className="shop-page shop-empty">
      <h1>Page not found</h1>
      <p>This page is unavailable. You can continue browsing the store.</p>
      <Link to="/products">Browse products</Link>
      <Link to="/">Back to home</Link>
    </main>
  );
}
