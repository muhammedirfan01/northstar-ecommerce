import { useCallback, useEffect, useRef, useState } from "react";
import API from "./api/API.js";
import SignOutDialog from "./features/auth/SignOutDialog.jsx";
import { getCart, addCartItem } from "./features/cart/cartApi.js";
import { getWishlist, addWishlistItem, removeWishlistItem } from "./features/wishlist/wishlistApi.js";
import { BrowserRouter, Navigate, Routes, Route, useLocation, useNavigate } from "react-router";
import Home from "./features/shop/Home.jsx";
import AdminLayout from "./features/admin/AdminLayout.jsx";
import AdminDashboard from "./features/admin/AdminDashboard.jsx";
import Categories from "./features/admin/categories/Categories.jsx";
import Customers from "./features/admin/customers/Customers.jsx";
import RequireAdmin from "./features/admin/RequireAdmin.jsx";
import RequireSignedIn from "./features/auth/RequireSignedIn.jsx";
import StoreLayout from "./components/layout/StoreLayout.jsx";
import ProfileScreen from "./features/profile/ProfileScreen.jsx";
import Addresses from "./features/profile/Addresses.jsx";
import Products from "./features/admin/products/Products.jsx";
import ProductForm from "./features/admin/products/ProductForm.jsx";
import ProductVariants from "./features/admin/products/ProductVariants.jsx";
import ProductListing from "./features/shop/ProductListing.jsx";
import ProductDetails from "./features/shop/ProductDetails.jsx";
import Cart from "./features/cart/Cart.jsx";
import Wishlist from "./features/wishlist/Wishlist.jsx";
import NotFound from "./components/ui/NotFound.jsx";
export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}

function AppContent() {

  // Shared account state lives here and is passed to screens through props.
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const accountRevision = useRef(0);
  const logoutPending = useRef(false);
  const [signOut, setSignOut] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  function updateAccount(account) {
    accountRevision.current++;
    setUser(account);
    setError("");
    setAccountMessage("");
    setStatus("ready");
  }

  const refreshUser = useCallback(async (signal) => {
    const revision = accountRevision.current;
    try {
      const response = await API.get("/auth/me", { signal });
      // Ignore replies from requests started before an account change.
      if (signal?.aborted || revision !== accountRevision.current) return;
      setUser(response.data.data.user);
      setError("");
      setAccountMessage("");
      setStatus("ready");
    } catch (failure) {
      if (signal?.aborted || revision !== accountRevision.current) return;
      const code = failure.response?.data?.code;
      const restricted = ["ACCOUNT_BLOCKED", "ACCOUNT_DELETED"].includes(code);
      if (restricted || [401, 403].includes(failure.response?.status)) {
        accountRevision.current++;
        setUser(null);
        setError("");
        setStatus(restricted ? "restricted" : "ready");
        if (restricted) {
          setAccountMessage(failure.response?.data?.message || "This account is unavailable. Please contact support.");
        }
        return;
      }
      setError(failure.response?.data?.message || failure.message);
      setStatus("error");
    }
  }, []);

  // Restore the login once when the application starts.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) refreshUser(controller.signal);
    });
    return () => controller.abort();
  }, [refreshUser]);

  function completeLogin(account) {
    updateAccount(account);
    const next = new URLSearchParams(location.search).get("next");
    const allowed = ["/profile", "/profile/edit", "/addresses", "/products", "/cart", "/wishlist"].includes(next)
      || /^\/products\/[a-f0-9]{24}$/i.test(next || "");
    navigate(account.role === "admin" ? "/admin" : allowed ? next : "/", { replace: true });
  }

  function requestLogout() {
    if (user && !logoutPending.current) {
      setSignOut({ account: user, stage: "confirm" });
    }
  }

  async function logout() {
    if (logoutPending.current) return;
    logoutPending.current = true;
    try {
      await API.post("/auth/logout", {});
      updateAccount(null);
      setSignOut((current) => ({ ...current, stage: "success" }));
      navigate("/", { replace: true });
    } finally {
      logoutPending.current = false;
    }
  }

  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState([]);
  const customerSession = useRef(null);
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


  if (status === "loading") {
    return <main className="account-loading" role="status">Checking your account…</main>;
  }

  return (
    <>
      {accountMessage && <p className="shop-error" role="alert">{accountMessage}</p>}
      {status === "restricted" && (location.pathname !== "/" || location.search !== "?signin=1") && (
        <Navigate to="/?signin=1" replace />
      )}
          <Routes>
            <Route element={<StoreLayout completeLogin={completeLogin} user={user} status={status} logout={requestLogout} cartCount={cartCount} wishlistIds={wishlistIds} />}>
              <Route path="/" element={<Home wishlistIds={wishlistIds} addToCart={addToCart} toggleWishlist={toggleWishlist} />} />
              <Route path="/products" element={<ProductListing wishlistIds={wishlistIds} addToCart={addToCart} toggleWishlist={toggleWishlist} />} />
              <Route path="/products/:id" element={<ProductDetails wishlistIds={wishlistIds} addToCart={addToCart} toggleWishlist={toggleWishlist} />} />
              <Route element={<RequireSignedIn user={user} status={status} error={error} refreshUser={refreshUser} />}>
                <Route path="/cart" element={<Cart key={user?.id} updateCart={updateCart} />} />
                <Route path="/wishlist" element={<Wishlist key={user?.id} wishlistIds={wishlistIds} addToCart={addToCart} toggleWishlist={toggleWishlist} />} />
                <Route path="/addresses" element={<Addresses key={user?.id} user={user} />} />
                <Route path="/profile" element={<ProfileScreen user={user} updateAccount={updateAccount} key="view" />} />
                <Route
                  path="/profile/edit"
                  element={<ProfileScreen user={user} updateAccount={updateAccount} key="edit" editing />}
                />
              </Route>
            </Route>
            <Route
              path="/login"
              element={<Navigate to="/?signin=1" replace />}
            />
            <Route
              path="/register"
              element={<Navigate to="/?signup=1" replace />}
            />
            <Route element={<RequireAdmin user={user} status={status} error={error} refreshUser={refreshUser} />}>
              <Route path="/admin" element={<AdminLayout user={user} logout={requestLogout} />}>
                <Route index element={<AdminDashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="categories" element={<Categories />} />
                <Route path="products" element={<Products />} />
                <Route
                  path="products/new"
                  element={<ProductForm key="new-product" />}
                />
                <Route
                  path="products/:id/edit"
                  element={<ProductForm key="edit-product" />}
                />
                <Route
                  path="products/:id/variants"
                  element={<ProductVariants />}
                />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
      {signOut && (
        <SignOutDialog
          account={signOut.account}
          stage={signOut.stage}
          onConfirm={logout}
          onClose={() => setSignOut(null)}
          onSignIn={() => navigate("/?signin=1", { replace: true })}
        />
      )}

    </>
  );
}

