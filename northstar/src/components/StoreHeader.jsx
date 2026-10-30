import { useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Search, ShoppingBag } from "lucide-react";
import { AuthContext } from "../context/AuthContext.js";
import CategoryDropdown from "./CategoryDropdown.jsx";
import ProfileMenu from "./ProfileMenu.jsx";

export default function StoreHeader({ onSignIn }) {
  const { user, displayUser, status, requestLogout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <>
      <div className="announcement">
        <span className="announcement-badge">Limited Time</span>
        <span className="announcement-message">
          <span className="announcement-lightning" aria-hidden="true">⚡</span>
          <span>FLASH SALE: UP TO 50% OFF ON ALL PRODUCTS | USE CODE{" "}<strong className="announcement-code">NORTHSTAR50</strong></span>
        </span>
        <Link className="announcement-link" to="/#best-sellers">Shop Now →</Link>
      </div>
    <header className="site-header">
      <Link className="logo" to="/">NORTHSTAR</Link>

      <nav aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-home" : ""}>Home</NavLink>
        <CategoryDropdown />
        <Link to="/#best-sellers">Laptops</Link>
        <Link to="/#best-sellers">Mobiles</Link>
        <Link to="/#best-sellers">Accessories</Link>
      </nav>

      <div className="header-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          name="search"
          placeholder="Search for products..."
          aria-label="Search products"
        />
      </div>

      <div className="header-account-slot">
      {status === "loading" ? (
        <span className="header-account-placeholder" role="status" aria-label="Loading account" />
      ) : user ? (
        <div className="header-user-actions">
          <button className="cart-button" type="button" aria-label="View cart, 0 items">
            <ShoppingBag size={20} aria-hidden="true" />
            <span className="cart-count" aria-hidden="true">0</span>
          </button>
          <ProfileMenu user={displayUser || user} onSignOut={requestLogout} />
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
