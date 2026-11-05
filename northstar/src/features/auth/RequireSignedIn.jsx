import { Navigate, Outlet, useLocation } from "react-router";
export default function RequireSignedIn({ user, status, error, refreshUser }) {
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
    return (
      <Navigate
        to={`/?signin=1&next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }
  return <Outlet />;
}
