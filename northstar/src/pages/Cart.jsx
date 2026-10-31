import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ShoppingBag, ArrowRight, Trash2, Minus, Plus } from "lucide-react";
import { shopApi } from "../api/shop.js";
import { ShoppingContext } from "../context/ShoppingContext.js";
import { money } from "../utils/money.js";

export default function Cart() {
  const [cart, setCart] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const { updateCart } = useContext(ShoppingContext);
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    shopApi
      .cart(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setCart(result);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [reload]);
  async function change(item, quantity) {
    setBusy(true);
    setError("");
    try {
      const result =
        quantity === 0
          ? await shopApi.removeFromCart(item.id)
          : await shopApi.quantity(item.id, quantity);
      setCart(result);
      updateCart(result);
    } catch (error) {
      setError(error.message);
      setReload((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  const savings =
    cart?.items.reduce(
      (total, item) =>
        total +
        Math.max(
          0,
          (item.regularPricePaise || item.unitPricePaise) - item.unitPricePaise,
        ) *
          item.quantity,
      0,
    ) || 0;
  return (
    <main className="shop-page cart-page">
      <p className="shop-breadcrumb">
        <Link to="/products">Products</Link> / Cart
      </p>
      <div className="cart-page-heading">
        <div>
          <p className="pd-eyebrow">Your selection</p>
          <h1>
            Your Cart <span>{cart?.quantityTotal || 0} items</span>
          </h1>
        </div>
        <Link to="/products">
          Continue shopping <ArrowRight size={15} />
        </Link>
      </div>
      {error && (
        <p className="shop-error" role="alert">
          {error}{" "}
          <button onClick={() => setReload(reload + 1)}>Refresh cart</button>
        </p>
      )}
      {!cart ? (
        !error && <p role="status">Loading cart…</p>
      ) : !cart.items.length ? (
        <div className="shop-empty cart-empty">
          <ShoppingBag size={48} strokeWidth={1} />
          <h2>Your cart is empty</h2>
          <p>Find something you love and add it here.</p>
          <Link className="shop-primary" to="/products">
            Explore products <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="shop-cart-grid">
          <section className="shop-cart-items" aria-label="Cart items">
            <div className="cart-list-heading">
              <strong>Products</strong>
              <span>Item total</span>
            </div>
            {cart.items.map((item) => (
              <article
                className={`shop-cart-item ${item.valid ? "" : "cart-item-invalid"}`}
                key={item.id}
              >
                <Link
                  className="cart-item-image"
                  to={`/products/${item.productId}`}
                >
                  <img src={item.image || "/favicon.png"} alt={item.name} />
                </Link>
                <div>
                  <h2>
                    <Link to={`/products/${item.productId}`}>{item.name}</Link>
                  </h2>
                  {item.variantName && (
                    <p className="cart-item-variant">{item.variantName}</p>
                  )}
                  <p className="cart-unit-price">
                    {money(item.unitPricePaise)} each{" "}
                    {item.regularPricePaise > item.unitPricePaise && (
                      <del>{money(item.regularPricePaise)}</del>
                    )}
                  </p>
                  {item.error && <p className="shop-error">{item.error}</p>}
                  <div className="cart-item-controls">
                    <div className="shop-quantity">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name}`}
                        disabled={busy || !item.available || item.quantity <= 1}
                        onClick={() =>
                          change(
                            item,
                            Math.min(item.quantity - 1, item.maxQuantity),
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name}`}
                        disabled={
                          busy ||
                          !item.available ||
                          item.quantity >= item.maxQuantity
                        }
                        onClick={() => change(item, item.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="cart-remove"
                      type="button"
                      disabled={busy}
                      onClick={() => change(item, 0)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
                <strong className="cart-line-total">
                  {money(item.subtotalPaise)}
                </strong>
              </article>
            ))}
            <p className="shop-help cart-stock-note">
              Quantities are limited to current stock, with a maximum of 5 units
              per option.
            </p>
          </section>
          <aside className="shop-cart-summary">
            <p className="pd-eyebrow">Order summary</p>
            <h2>Price details</h2>
            <p>
              <span>Items ({cart.quantityTotal})</span>
              <strong>{money(cart.totalPaise + savings)}</strong>
            </p>
            {savings > 0 && (
              <p className="cart-savings">
                <span>Product savings</span>
                <strong>−{money(savings)}</strong>
              </p>
            )}
            <p className="cart-grand-total">
              <span>Total amount</span>
              <strong>{money(cart.totalPaise)}</strong>
            </p>
            {savings > 0 && (
              <p className="cart-savings-note">
                You save {money(savings)} on these products.
              </p>
            )}
            <button
              className="shop-primary"
              type="button"
              disabled={busy || !cart.canCheckout}
              onClick={() =>
                navigate("/checkout", {
                  state: { expectedTotalPaise: cart.totalPaise },
                })
              }
            >
              Continue to checkout <ArrowRight size={16} />
            </button>
            {!cart.canCheckout && (
              <p className="shop-error">
                Remove unavailable items or adjust their quantities before
                checkout.
              </p>
            )}
            <p className="shop-help">
              Current prices and stock are checked again before checkout review.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
