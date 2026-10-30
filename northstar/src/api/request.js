import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
export const ACCOUNT_RESTRICTION_EVENT = "northstar:account-restricted";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  // Handle API errors below so every page receives the same error details.
  validateStatus: () => true,
});

// Axios handles JSON and FormData for all account, profile, address and admin calls.
export async function request(path, options = {}) {
  let response;
  try {
    response = await api.request({
      url: path,
      method: options.method || "GET",
      data: options.body,
      signal: options.signal,
    });
  } catch (error) {
    if (axios.isCancel(error)) throw new DOMException("Request cancelled.", "AbortError");
    throw new Error("Unable to connect. Please try again.", { cause: error });
  }

  const result = response.data && typeof response.data === "object" && !Array.isArray(response.data)
    ? response.data
    : { success: false, message: "Unable to process the server response. Please try again." };
  if (response.status < 200 || response.status >= 300 || !result.success) {
    const error = new Error(result.message || "Your request could not be completed.");
    error.status = response.status;
    error.data = result.data;
    error.code = result.code;
    if (result.code === "ACCOUNT_BLOCKED" || result.code === "ACCOUNT_DELETED") {
      window.dispatchEvent(new CustomEvent(ACCOUNT_RESTRICTION_EVENT, {
        detail: { code: result.code, message: result.message },
      }));
    }
    throw error;
  }
  return result.data || {};
}

export function profileImageUrl(source) {
  if (!source) return "";
  if (source.startsWith("/profile/photo/") || source.startsWith("/admin/customers/")) return API_URL + source;
  return source;
}


