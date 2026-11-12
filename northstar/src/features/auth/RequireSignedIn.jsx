import { AccountStatus } from "../../status/statuses.js";
import { Navigate, Outlet, useLocation } from "react-router";
export default function RequireSignedIn({ user, status, error, refreshUser }) {
  const location = useLocation();
  if (status === AccountStatus.LOADING) {
    return (
      <main className="account-loading" role="status">
        Loading your account…
      </main>
    );
  }
  if (status === AccountStatus.ERROR) {
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
        to={`/?signin=1&next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }
  return <Outlet />;
}
