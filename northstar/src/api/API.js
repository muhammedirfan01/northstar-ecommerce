import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL || "/api";
export const ACCOUNT_RESTRICTION_EVENT = "northstar:account-restricted";

const API = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

API.interceptors.response.use(
  (response) => {
    if (response.data?.success === false) {
      return Promise.reject(
        new Error(response.data.message || "Request failed")
      );
    }

    return response;
  },

  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const result = error.response?.data;

    if (
      result?.code === "ACCOUNT_BLOCKED" ||
      result?.code === "ACCOUNT_DELETED"
    ) {
      window.dispatchEvent(
        new CustomEvent(ACCOUNT_RESTRICTION_EVENT, {
          detail: {
            code: result.code,
            message: result.message,
          },
        })
      );
    }

    const message = result?.message || "Unable to connect. Please try again.";

    const customError = new Error(message);
    customError.status = error.response?.status;
    customError.code = result?.code;
    customError.data = result?.data;

    return Promise.reject(customError);
  }
);

export default API;

export function profileImageUrl(source) {
  if (!source) return "";

  if (
    source.startsWith("/profile/photo/") ||
    source.startsWith("/admin/customers/")
  ) {
    return API_URL.replace(/\/+$/, "") + source;
  }

  return source;
}