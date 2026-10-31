import { useRef } from "react";
import { Link } from "react-router";
import ProfileAvatar from "./ProfileAvatar.jsx";

export default function ProfileMenu({ user, onSignOut }) {
  const menuRef = useRef(null);

  function closeMenu() {
    menuRef.current.open = false;
  }

  function signOut() {
    closeMenu();
    onSignOut();
  }

  return (
    <details
      className="profile-dropdown"
      ref={menuRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeMenu();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
      }}
    >
      <summary className="profile-button" aria-label="Account options">
        <ProfileAvatar user={user} />
      </summary>
      <div className="profile-panel">
        <div className="profile-panel-header">
          <div className="profile-avatar">
            <ProfileAvatar user={user} />
          </div>
          <div>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        </div>
        <div className="profile-menu-group">
          <Link to="/profile" onClick={closeMenu}>
            My Profile
          </Link>
          {user.role === "customer" && (
            <Link to="/addresses" onClick={closeMenu}>
              Saved Addresses
            </Link>
          )}
          {user.role === "customer" && (
            <>
              <Link to="/cart" onClick={closeMenu}>
                My Cart
              </Link>
              <Link to="/wishlist" onClick={closeMenu}>
                My Wishlist
              </Link>
            </>
          )}
        </div>
        <button
          className="profile-signout"
          type="button"
          onClick={signOut}
          aria-haspopup="dialog"
        >
          Sign Out
        </button>
      </div>
    </details>
  );
}
