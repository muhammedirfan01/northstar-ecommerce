import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import { authApi, ACCOUNT_RESTRICTION_EVENT } from "../api/auth.js";
import AccountRestricted from "../components/AccountRestricted.jsx";
import SignOutDialog from "../components/SignOutDialog.jsx";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [restriction, setRestriction] = useState(null);
  const [signOutPrompt, setSignOutPrompt] = useState(null);
  const authChannel = useRef(null);
  const accountRevision = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshUser = useCallback(async (signal) => {
    const revision = accountRevision.current;
    try {
      const result = await authApi.me(signal);
      if (!signal?.aborted && revision === accountRevision.current) {
        setUser(result.user);
        setRestriction(null);
        setError("");
        setStatus("ready");
      }
      return "authenticated";
    } catch (failure) {
      if (["ACCOUNT_BLOCKED", "ACCOUNT_DELETED"].includes(failure.code)) return "restricted";
      if (signal?.aborted || revision !== accountRevision.current) return;
      if (failure.status === 401 || failure.status === 403) {
        setUser(null);
        setRestriction(null);
        setError("");
        setStatus("ready");
        return "anonymous";
      } else {
        setError(failure.message);
        setStatus("error");
        return "error";
      }
    }
  }, []);

  useEffect(() => {
    const restricted = event => {
      accountRevision.current++;
      setUser(null);
      setRestriction(event.detail);
      setError("");
      setStatus("ready");
      setSignOutPrompt(null);
    };
    window.addEventListener(ACCOUNT_RESTRICTION_EVENT, restricted);
    return () => window.removeEventListener(ACCOUNT_RESTRICTION_EVENT, restricted);
  }, []);

  const clearAccount = useCallback(() => {
    accountRevision.current++;
    setUser(null);
    setRestriction(null);
    setError("");
    setStatus("ready");
    navigate("/", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("northstar:auth");
    authChannel.current = channel;
    channel.onmessage = event => {
      if (event.data?.type !== "SIGNED_OUT") return;
      setSignOutPrompt(null);
      clearAccount();
    };
    return () => { authChannel.current = null; channel.close(); };
  }, [clearAccount]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) refreshUser(controller.signal);
    });
    return () => controller.abort();
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    let pending = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || pending) return;
      pending = true;
      try { await refreshUser(); } finally { pending = false; }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(interval);
    };
  }, [user, restriction, refreshUser]);

  function completeLogin(account) {
    accountRevision.current++;
    setSignOutPrompt(null);
    setUser(account);
    setRestriction(null);
    setStatus("ready");
    setError("");
    const next = new URLSearchParams(location.search).get("next");
    const destination = ["/profile", "/profile/edit", "/addresses"].includes(next) ? next : "/";
    navigate(account.role === "admin" ? "/admin" : destination, { replace: true });
  }

  async function logout() {
    await authApi.logout();
    clearAccount();
    authChannel.current?.postMessage({ type: "SIGNED_OUT" });
  }

  function requestLogout() {
    if (user) setSignOutPrompt({ stage: "confirm", account: user });
  }

  function updateAccount(account) {
    accountRevision.current++;
    setUser(account);
    setRestriction(null);
    setError("");
    setStatus("ready");
  }

  return (
    <AuthContext.Provider value={{ user, displayUser: user, updateAccount, status, error, completeLogin, logout, requestLogout, refreshUser }}>
      {status === "loading" ? <main className="account-restricted" role="status">Checking your account…</main> : restriction ? <AccountRestricted restriction={restriction} onCheck={async () => {
        const result = await refreshUser();
        if (result === "anonymous") navigate("/?signin=1", { replace: true });
        if (result === "error") return "Unable to check your account. Please try again.";
        return result === "restricted" ? "Your account is still restricted. Please contact support." : "";
      }} onSignOut={async () => { await logout(); navigate("/?signin=1", { replace: true }); }} /> : children}
      {signOutPrompt && <SignOutDialog account={signOutPrompt.account} stage={signOutPrompt.stage}
        onConfirm={async () => {
          await logout();
          setSignOutPrompt(previous => previous ? { ...previous, stage: "success" } : null);
        }}
        onClose={() => setSignOutPrompt(null)}
        onSignIn={() => { setSignOutPrompt(null); navigate("/?signin=1", { replace: true }); }}
      />}
    </AuthContext.Provider>
  );
}
