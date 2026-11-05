import { Outlet, useSearchParams } from "react-router";
import AuthModal from "../ui/AuthModal.jsx";
import Footer from "./Footer.jsx";
import StoreHeader from "./StoreHeader.jsx";
export default function StoreLayout({ completeLogin, user, status, accountMessage, logout, cartCount, wishlistIds }) {
  const [params, setParams] = useSearchParams();
  const showAuth = params.has("signin") || params.has("signup");
  function openAuth() {
    const next = new URLSearchParams(params);
    next.delete("signup");
    next.set("signin", "1");
    setParams(next);
  }
  function closeAuth() {
    const next = new URLSearchParams(params);
    next.delete("signin");
    next.delete("signup");
    setParams(next, {
      replace: true,
    });
  }
  return (
    <>
      <StoreHeader onSignIn={openAuth} user={user} status={status} logout={logout} cartCount={cartCount} wishlistIds={wishlistIds} />
      <Outlet />
      <Footer />
      {showAuth && (
        <AuthModal
          key={params.has("signup") ? "register" : "login"}
          accountMessage={accountMessage}
          initialView={params.has("signup") ? "register" : "login"}
          onClose={closeAuth}
          onAuthenticated={completeLogin}
        />
      )}
    </>
  );
}
