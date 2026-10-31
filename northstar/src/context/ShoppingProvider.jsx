import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { ShoppingContext } from "./ShoppingContext.js";
import { shopApi } from "../api/shop.js";

export default function ShoppingProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const customerId = user?.role === "customer" ? user.id : null;
  useEffect(() => {
    const controller = new AbortController();
    if (!customerId) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setCartCount(0);
          setWishlistIds([]);
        }
      });
    } else {
      Promise.all([
        shopApi.cart(controller.signal),
        shopApi.wishlist(controller.signal),
      ])
        .then(([cart, wish]) => {
          if (!controller.signal.aborted) {
            setCartCount(cart.quantityTotal);
            setWishlistIds(wish.products.map((product) => product.id));
          }
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [customerId]);

  function requireCustomer() {
    if (!user) {
      navigate(`/?signin=1&next=${encodeURIComponent(location.pathname)}`);
      return false;
    }
    if (user.role !== "customer")
      throw new Error("Use a customer account to shop.");
    return true;
  }
  function updateCart(cart) {
    setCartCount(cart.quantityTotal);
  }
  async function addToCart(productId, variantId = null, quantity = 1) {
    if (!requireCustomer()) return false;
    const cart = await shopApi.addToCart({ productId, variantId, quantity });
    updateCart(cart);
    setWishlistIds((ids) => ids.filter((id) => id !== productId));
    return true;
  }
  async function toggleWishlist(productId) {
    if (!requireCustomer()) return;
    const result = wishlistIds.includes(productId)
      ? await shopApi.removeWish(productId)
      : await shopApi.saveWish(productId);
    setWishlistIds(result.products.map((product) => product.id));
  }
  return (
    <ShoppingContext.Provider
      value={{ cartCount, wishlistIds, updateCart, addToCart, toggleWishlist }}
    >
      {children}
    </ShoppingContext.Provider>
  );
}
