import { useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { ShoppingContext } from "./ShoppingContext.js";
import { getCart, addCartItem } from "../features/cart/cartApi.js";
import {
  getWishlist,
  addWishlistItem,
  removeWishlistItem,
} from "../features/wishlist/wishlistApi.js";

export default function ShoppingProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState([]);
  const customerSession = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const customerId = user?.role === "customer" ? user.id : null;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    customerSession.current = { customerId, signal };

    async function loadShoppingData() {
      try {
        const [cart, wishlist] = await Promise.all([
          getCart(signal),
          getWishlist(signal),
        ]);

        if (signal.aborted) return;

        setCartCount(cart.quantityTotal);
        setWishlistIds(wishlist.products.map((product) => product.id));
      } catch (error) {
        if (!signal.aborted) {
          console.error("Failed to load shopping data:", error);
        }
      }
    }

    // Clear the previous customer's data before loading the current account.
    queueMicrotask(() => {
      if (signal.aborted) return;

      setCartCount(0);
      setWishlistIds([]);
      if (customerId) loadShoppingData();
    });

    return () => controller.abort();
  }, [customerId]);

  function requireCustomer() {
    if (!user) {
      navigate(`/?signin=1&next=${encodeURIComponent(location.pathname)}`);
      return false;
    }

    if (user.role !== "customer") {
      throw new Error("Use a customer account to shop.");
    }

    return true;
  }

  function updateCart(cart) {
    if (customerId && customerSession.current?.customerId === customerId) {
      setCartCount(cart.quantityTotal);
    }
  }

  async function addToCart(productId, variantId = null, quantity = 1) {
    if (!requireCustomer()) return false;

    const { signal } = customerSession.current;
    const cart = await addCartItem(productId, variantId, quantity, signal);
    if (signal.aborted) return false;

    updateCart(cart);
    setWishlistIds((ids) => ids.filter((id) => id !== productId));
    return true;
  }

  async function toggleWishlist(productId) {
    if (!requireCustomer()) return;

    const { signal } = customerSession.current;
    let wishlist;

    if (wishlistIds.includes(productId)) {
      wishlist = await removeWishlistItem(productId, signal);
    } else {
      wishlist = await addWishlistItem(productId, signal);
    }

    if (signal.aborted) return;
    setWishlistIds(wishlist.products.map((product) => product.id));
  }

  return (
    <ShoppingContext.Provider
      value={{ cartCount, wishlistIds, updateCart, addToCart, toggleWishlist }}
    >
      {children}
    </ShoppingContext.Provider>
  );
}
