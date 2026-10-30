import { useState } from "react";
import { useGoogleLogin, useGoogleOAuth } from "@react-oauth/google";
import { authApi } from "../api/auth.js";

export default function GoogleSignInButton({ busy, setBusy, onSuccess }) {
  const [error, setError] = useState("");
  const { scriptLoadedSuccessfully } = useGoogleOAuth();

  function failed(message) {
    setError(message);
    setBusy(false);
  }

  const openGoogle = useGoogleLogin({
    flow: "auth-code",
    async onSuccess(response) {
      try {
        const result = await authApi.google({ code: response.code });
        onSuccess(result.user);
      } catch (error) {
        setError(error.message);
      } finally {
        setBusy(false);
      }
    },
    onError: () => failed("Google sign-in failed. Please try again."),
    onNonOAuthError: () => failed("Google sign-in was closed or blocked. Please try again."),
  });

  function signIn() {
    setError("");
    setBusy(true);
    try { openGoogle(); }
    catch { failed("Unable to open Google sign-in."); }
  }

  return <>
    <button className="auth-google" type="button" disabled={busy || !scriptLoadedSuccessfully} onClick={signIn}><img src="/google_icon.png" alt="" />Continue with Google</button>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </>;
}
