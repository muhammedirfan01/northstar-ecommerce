import { useRef, useState } from "react";
import { useGoogleLogin, useGoogleOAuth } from "@react-oauth/google";
import { authApi } from "../api/auth.js";

export default function GoogleSignInButton({ busy, setBusy, onSuccess }) {
  const [error, setError] = useState("");
  const codeReceived = useRef(false);
  const { scriptLoadedSuccessfully } = useGoogleOAuth();

  function failed(message) {
    setError(message);
    setBusy(false);
  }

  const openGoogle = useGoogleLogin({
    flow: "auth-code",
    ux_mode: "popup",
    async onSuccess(response) {
      codeReceived.current = true;
      setError("");
      if (!response.code) {
        failed("Google did not return a sign-in code. Please try again.");
        return;
      }
      try {
        const result = await authApi.google({ code: response.code });
        onSuccess(result.user);
      } catch (error) {
        setError(
          error.cause?.isAxiosError
            ? "Our sign-in server could not be reached. Please try again shortly."
            : error.message,
        );
      } finally {
        setBusy(false);
      }
    },
    onError: (response) =>
      failed(
        response.error === "access_denied"
          ? "Google sign-in was not approved. Please try again when you are ready."
          : "Google could not authorize sign-in. Please try again.",
      ),
    onNonOAuthError(response) {
      // The popup can close while the backend is already finishing sign-in.
      if (codeReceived.current) return;
      if (response.type === "popup_failed_to_open") {
        failed(
          "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
        );
      } else if (response.type === "popup_closed") {
        failed(
          "The Google window closed before sign-in finished. Keep it open until it completes, then try again.",
        );
      } else {
        failed("Google could not finish the popup sign-in. Please try again.");
      }
    },
  });

  function signIn() {
    setError("");
    codeReceived.current = false;
    setBusy(true);
    // Open directly from the click so the browser keeps the user's popup permission.
    try {
      openGoogle();
    } catch {
      failed("Unable to open Google sign-in. Please try again.");
    }
  }

  return (
    <>
      <button
        className="auth-google"
        type="button"
        disabled={busy || !scriptLoadedSuccessfully}
        onClick={signIn}
      >
        <img src="/google_icon.png" alt="" />
        Continue with Google
      </button>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
