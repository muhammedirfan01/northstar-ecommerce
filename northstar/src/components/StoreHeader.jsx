import { useContext, useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Search, ShoppingBag, Heart } from "lucide-react";
import { AuthContext } from "../context/AuthContext.js";
import { ShoppingContext } from "../context/ShoppingContext.js";
import { shopApi } from "../api/shop.js";
import CategoryDropdown from "./CategoryDropdown.jsx";
import ProfileMenu from "./ProfileMenu.jsx";

export default function StoreHeader({ onSignIn }) {
  const { user, displayUser, status, requestLogout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    shopApi
      .categories(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCategories(result.categories);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function categoryLink(pattern) {
    const category =
      categories.find(
        (category) => !category.parentId && pattern.test(category.name),
      ) || categories.find((category) => pattern.test(category.name));
    return category ? `/products?category=${category.id}` : null;
  }
  const laptopLink = categoryLink(/^laptops?$/i);
  const mobileLink = categoryLink(/^(mobiles?|smartphones?|phones?)$/i);
  const { cartCount, wishlistIds } = useContext(ShoppingContext);

  return (
    <>
      <div className="announcement">
        <span className="announcement-badge">Limited Time</span>
        <span className="announcement-message">
          <span className="announcement-lightning" aria-hidden="true">
            ⚡
          </span>
          <span>
            FLASH SALE: UP TO 50% OFF ON ALL PRODUCTS | USE CODE{" "}
            <strong className="announcement-code">NORTHSTAR50</strong>
          </span>
        </span>
        <Link className="announcement-link" to="/products">
          Shop Now →
        </Link>
      </div>
      <header className="site-header">
        <Link className="logo" to="/">
          NORTHSTAR
        </Link>

        <nav aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? "nav-home" : "")}
          >
            Home
          </NavLink>
          <CategoryDropdown categories={categories} />
          <Link
            to={laptopLink || "#"}
            aria-disabled={!laptopLink}
            onClick={(event) => {
              if (!laptopLink) event.preventDefault();
            }}
          >
            Laptops
          </Link>
          <Link
            to={mobileLink || "#"}
            aria-disabled={!mobileLink}
            onClick={(event) => {
              if (!mobileLink) event.preventDefault();
            }}
          >
            Mobiles
          </Link>
          <Link to="/#support">Support</Link>
        </nav>

        <form
          className="header-search"
          onSubmit={(event) => {
            event.preventDefault();
            const search = new FormData(event.currentTarget)
              .get("search")
              .trim();
            navigate(
              search
                ? `/products?search=${encodeURIComponent(search)}`
                : "/products",
            );
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            name="search"
            placeholder="Search for products..."
            aria-label="Search products"
            maxLength={100}
          />
          <button
            className="cm-icon-button"
            type="submit"
            aria-label="Submit product search"
          >
            →
          </button>
        </form>

        <div className="header-account-slot">
          {status === "loading" ? (
            <span
              className="header-account-placeholder"
              role="status"
              aria-label="Loading account"
            />
          ) : user ? (
            <div className="header-user-actions">
              {user.role === "customer" && (
                <>
                  <Link
                    className="header-shopping-link"
                    to="/wishlist"
                    aria-label={`Wishlist, ${wishlistIds.length} products`}
                  >
                    <Heart size={19} />
                    <span>{wishlistIds.length}</span>
                  </Link>
                  <Link
                    className="cart-button header-shopping-link"
                    to="/cart"
                    aria-label={`View cart, ${cartCount} items`}
                  >
                    <ShoppingBag size={20} />
                    <span className="cart-count">{cartCount}</span>
                  </Link>
                </>
              )}
              <ProfileMenu
                user={displayUser || user}
                onSignOut={requestLogout}
              />
            </div>
          ) : (
            <button
              className="sign-in"
              type="button"
              aria-haspopup="dialog"
              disabled={status === "loading"}
              onClick={onSignIn || (() => navigate("/?signin=1"))}
            >
              Sign In
            </button>
          )}
        </div>
      </header>
    </>
  );
}
