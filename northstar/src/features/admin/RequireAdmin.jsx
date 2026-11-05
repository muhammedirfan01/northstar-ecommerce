import { AccountStatus } from "../../constants/statuses.js";
import { Navigate, Outlet } from "react-router";
export default function RequireAdmin({ user, status, error, refreshUser }) {
  if (status === AccountStatus.LOADING) {
    return <p role="status">Checking your account…</p>;
  }
  if (status === AccountStatus.ERROR) {
    return (
      <div role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => refreshUser()}>
          Try again
        </button>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/?signin=1" replace />;
  }
  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
