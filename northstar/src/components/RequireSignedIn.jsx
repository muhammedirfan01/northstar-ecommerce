import { useContext } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { AuthContext } from "../context/AuthContext.js";

export default function RequireSignedIn() {
  const { user, status, error, refreshUser, signingOut } =
    useContext(AuthContext);
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="account-loading" role="status">
        Loading your account…
      </main>
    );
  }
  if (status === "error") {
    return (
      <main className="account-loading" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => refreshUser()}>
          Try again
        </button>
      </main>
    );
  }
  if (!user) {
    if (signingOut) return null;
    return (
      <Navigate
        to={`/?signin=1&next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  return <Outlet />;
}
