import { useRef } from "react";
import { Link } from "react-router";
import ProfileAvatar from "./ProfileAvatar.jsx";
export default function ProfileMenu({ user, onSignOut }) {
  const menuRef = useRef(null);
  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
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
        if (event.key === "Escape") {
          closeMenu();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
    >
      <summary className="profile-button" aria-label="Account options">
        <ProfileAvatar user={user} />
      </summary>
      <div className="profile-panel">
        <Link to="/profile" className="profile-panel-header" onClick={closeMenu}>
          <div className="profile-avatar">
            <ProfileAvatar user={user} />
          </div>
          <div>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        </Link>
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
        >
          Sign Out
        </button>
      </div>
    </details>
  );
}
