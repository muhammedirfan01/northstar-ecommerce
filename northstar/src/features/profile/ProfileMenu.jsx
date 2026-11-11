import { useEffect, useRef } from "react";
import { Link } from "react-router";
import {
  Package,
  MapPin,
  Wallet,
  Heart,
  UserRound,
  Truck,
  FileText,
  ShieldCheck,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";
import ProfileAvatar from "./ProfileAvatar.jsx";

function AccountLink({ to, icon: Icon, children, onClick, arrow = false }) {
  return (
    <Link to={to} onClick={onClick}>
      <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
      <span>{children}</span>
      {arrow && <ChevronRight size={14} aria-hidden="true" />}
    </Link>
  );
}

export default function ProfileMenu({ user, onSignOut }) {
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }
  function dismissMenu() {
    closeMenu();
    triggerRef.current?.focus();
  }
  useEffect(() => {
    function outside(event) {
      if (!menuRef.current?.contains(event.target)) closeMenu();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function signOut() {
    closeMenu();
    onSignOut();
  }
  return (
    <details
      className="profile-dropdown"
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") dismissMenu();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
      }}
    >
      <summary
        className="profile-button"
        aria-label="Account options"
        ref={triggerRef}
      >
        <ProfileAvatar user={user} />
      </summary>
      <div className="profile-panel">
        <div className="profile-panel-header">
          <Link to="/profile" className="profile-identity" onClick={closeMenu}>
            <div className="profile-avatar">
              <ProfileAvatar user={user} />
            </div>
            <div className="profile-identity-text">
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          </Link>
          <button
            className="profile-close"
            type="button"
            aria-label="Close account menu"
            onClick={dismissMenu}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {user.role === "customer" && (
          <div className="profile-menu-group">
            <AccountLink to="/orders" icon={Package} onClick={closeMenu} arrow>
              My Orders
            </AccountLink>
            <AccountLink to="/addresses" icon={MapPin} onClick={closeMenu} arrow>
              Saved Addresses
            </AccountLink>
            <AccountLink to="/wallet" icon={Wallet} onClick={closeMenu} arrow>
              My Wallet
            </AccountLink>
            <AccountLink to="/wishlist" icon={Heart} onClick={closeMenu} arrow>
              My Wishlist
            </AccountLink>
          </div>
        )}
        <div className="profile-menu-group">
          <AccountLink to="/profile" icon={UserRound} onClick={closeMenu}>
            My Profile
          </AccountLink>
          {user.role === "customer" && (
            <>
              <AccountLink to="/shipping-policy" icon={Truck} onClick={closeMenu}>
                Shipping Policy
              </AccountLink>
              <AccountLink to="/terms-and-conditions" icon={FileText} onClick={closeMenu}>
                Terms &amp; Conditions
              </AccountLink>
              <AccountLink to="/privacy-policy" icon={ShieldCheck} onClick={closeMenu}>
                Privacy Policy
              </AccountLink>
            </>
          )}
        </div>
        <button className="profile-signout" type="button" onClick={signOut}>
          <LogOut size={16} strokeWidth={1.6} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </details>
  );
}
