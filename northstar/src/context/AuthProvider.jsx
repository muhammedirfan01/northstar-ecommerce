
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AuthContext } from "./AuthContext.js";
import API, { ACCOUNT_RESTRICTION_EVENT } from "../api/API.js";
import AccountRestricted from "../features/auth/AccountRestricted.jsx";
import SignOutDialog from "../features/auth/SignOutDialog.jsx";

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

  function updateAccount(account) {
    accountRevision.current++;
    setUser(account);
    setRestriction(null);
    setError("");
    setStatus("ready");
  }

  const refreshUser = useCallback(async (signal) => {
    const revision = accountRevision.current;

    try {
      const response = await API.get("/auth/me", { signal });

      if (signal?.aborted || revision !== accountRevision.current) {
        return;
      }

      setUser(response.data.data.user);
      setRestriction(null);
      setError("");
      setStatus("ready");

      return "authenticated";
    } catch (failure) {
      if (signal?.aborted || revision !== accountRevision.current) {
        return;
      }

      if (["ACCOUNT_BLOCKED", "ACCOUNT_DELETED"].includes(failure.code)) {
        return "restricted";
      }

      if (failure.status === 401 || failure.status === 403) {
        setUser(null);
        setRestriction(null);
        setError("");
        setStatus("ready");
        return "anonymous";
      }

      setError(failure.message);
      setStatus("error");
      return "error";
    }
  }, []);

  function clearAccount() {
    updateAccount(null);
    setSignOutPrompt(null);
    navigate("/", { replace: true });
  }

  // Detect blocked or deleted accounts.
  useEffect(() => {
    function handleRestriction(event) {
      updateAccount(null);
      setRestriction(event.detail);
      setSignOutPrompt(null);
    }

    window.addEventListener(ACCOUNT_RESTRICTION_EVENT, handleRestriction);

    return () => {
      window.removeEventListener(
        ACCOUNT_RESTRICTION_EVENT,
        handleRestriction
      );
    };
  }, []);

  // Synchronize logout between browser tabs.
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;

    const channel = new BroadcastChannel("northstar:auth");
    authChannel.current = channel;

    channel.onmessage = (event) => {
      if (event.data?.type === "SIGNED_OUT") {
        clearAccount();
      }
    };

    return () => {
      authChannel.current = null;
      channel.close();
    };
  }, [navigate]);

  // Check authentication when the application starts.
  useEffect(() => {
    const controller = new AbortController();

    refreshUser(controller.signal);

    return () => controller.abort();
  }, [refreshUser]);

  // Recheck the account while the customer is active.
  useEffect(() => {
    if (!user) return;

    let pending = false;
    const controller = new AbortController();

    async function checkAccount() {
      if (document.visibilityState === "hidden" || pending) return;

      pending = true;

      try {
        await refreshUser(controller.signal);
      } finally {
        pending = false;
      }
    }

    window.addEventListener("focus", checkAccount);
    document.addEventListener("visibilitychange", checkAccount);

    const interval = window.setInterval(checkAccount, 5000);

    return () => {
      controller.abort();
      window.removeEventListener("focus", checkAccount);
      document.removeEventListener("visibilitychange", checkAccount);
      window.clearInterval(interval);
    };
  }, [Boolean(user), refreshUser]);

  function completeLogin(account) {
    updateAccount(account);
    setSignOutPrompt(null);

    const next = new URLSearchParams(location.search).get("next");

    const allowed =
      [
        "/profile",
        "/profile/edit",
        "/addresses",
        "/products",
        "/cart",
        "/wishlist",
        "/checkout",
      ].includes(next) ||
      /^\/products\/[a-f0-9]{24}$/i.test(next || "");

    const destination = allowed ? next : "/";

    navigate(account.role === "admin" ? "/admin" : destination, {
      replace: true,
    });
  }

  async function logout() {
    await API.post("/auth/logout", {});
    clearAccount();
    authChannel.current?.postMessage({ type: "SIGNED_OUT" });
  }

  function requestLogout() {
    if (user) {
      setSignOutPrompt({
        stage: "confirm",
        account: user,
      });
    }
  }

  async function checkRestrictedAccount() {
    const result = await refreshUser();

    if (result === "anonymous") {
      navigate("/?signin=1", { replace: true });
    }

    if (result === "error") {
      return "Unable to check your account. Please try again.";
    }

    if (result === "restricted") {
      return "Your account is still restricted. Please contact support.";
    }

    return "";
  }

  async function confirmLogout() {
    await logout();

    setSignOutPrompt((previous) =>
      previous ? { ...previous, stage: "success" } : null
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        displayUser: user,
        updateAccount,
        status,
        error,
        completeLogin,
        logout,
        requestLogout,
        refreshUser,
        signingOut: Boolean(signOutPrompt),
      }}
    >
      {status === "loading" ? (
        <main className="account-restricted" role="status">
          Checking your account…
        </main>
      ) : restriction ? (
        <AccountRestricted
          restriction={restriction}
          onCheck={checkRestrictedAccount}
          onSignOut={async () => {
            await logout();
            navigate("/?signin=1", { replace: true });
          }}
        />
      ) : (
        children
      )}

      {signOutPrompt && (
        <SignOutDialog
          account={signOutPrompt.account}
          stage={signOutPrompt.stage}
          onConfirm={confirmLogout}
          onClose={() => setSignOutPrompt(null)}
          onSignIn={() => {
            setSignOutPrompt(null);
            navigate("/?signin=1", { replace: true });
          }}
        />
      )}
    </AuthContext.Provider>
  );
}
