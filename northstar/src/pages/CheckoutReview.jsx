import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { shopApi } from "../api/shop.js";
import { money } from "../utils/money.js";

export default function CheckoutReview() {
  const location = useLocation();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const current = await shopApi.cart();
        const result = await shopApi.checkout(
          location.state?.expectedTotalPaise ?? current.totalPaise,
        );
        if (!cancelled) setCart(result);
      } catch (error) {
        if (!cancelled) setError(error.message);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [location.state?.expectedTotalPaise]);
  return (
    <main className="shop-page">
      <p className="shop-breadcrumb">
        <Link to="/cart">Cart</Link> / Checkout review
      </p>
      <h1>Checkout Review</h1>
      {error ? (
        <div className="shop-error" role="alert">
          <p>{error}</p>
          <Link to="/cart">Return to your cart to review the changes</Link>
        </div>
      ) : !cart ? (
        <p role="status">Checking current prices and stock…</p>
      ) : (
        <section className="shop-checkout-review">
          <p className="shop-notice" role="status">
            Current prices and stock have been checked.
          </p>
          {cart.items.map((item) => (
            <p key={item.id}>
              <span>
                {item.name}
                {item.variantName ? ` — ${item.variantName}` : ""} ×{" "}
                {item.quantity}
              </span>
              <strong>{money(item.subtotalPaise)}</strong>
            </p>
          ))}
          <p>
            <span>Total</span>
            <strong>{money(cart.totalPaise)}</strong>
          </p>
          <p className="shop-help">
            Order placement and payment will be available in the next checkout
            stage. These items have not been reserved.
          </p>
          <Link to="/cart">Back to cart</Link>
        </section>
      )}
    </main>
  );
}
