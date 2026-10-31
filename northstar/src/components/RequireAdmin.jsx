import { useContext } from "react";
import { Navigate, Outlet } from "react-router";
import { AuthContext } from "../context/AuthContext.js";

export default function RequireAdmin() {
  const { user, status, error, refreshUser, signingOut } =
    useContext(AuthContext);
  if (status === "loading") return <p role="status">Checking your account…</p>;
  if (status === "error") {
    return (
      <div role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => refreshUser()}>
          Try again
        </button>
      </div>
    );
  }
  if (!user) return signingOut ? null : <Navigate to="/?signin=1" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
