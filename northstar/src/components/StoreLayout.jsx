import { useContext } from "react";
import { Outlet, useSearchParams } from "react-router";
import { AuthContext } from "../context/AuthContext.js";
import AuthModal from "./AuthModal.jsx";
import Footer from "./Footer.jsx";
import StoreHeader from "./StoreHeader.jsx";

export default function StoreLayout() {
  const { completeLogin } = useContext(AuthContext);
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
    setParams(next, { replace: true });
  }

  return <>
    <StoreHeader onSignIn={openAuth} />
    <Outlet />
    <Footer />
    {showAuth && <AuthModal key={params.has("signup") ? "register" : "login"} initialView={params.has("signup") ? "register" : "login"} onClose={closeAuth} onAuthenticated={completeLogin} />}
  </>;
}
