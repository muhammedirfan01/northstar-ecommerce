import { request } from "./request.js";

// Existing shared components and the admin API can keep these imports.
export { request, profileImageUrl, ACCOUNT_RESTRICTION_EVENT } from "./request.js";

export const authApi = {
  me: signal => request("/auth/me", { signal }),
  login: body => request("/auth/login", { method: "POST", body }),
  google: body => request("/auth/google", { method: "POST", body }),
  register: body => request("/auth/register", { method: "POST", body }),
  verifyRegistration: body => request("/auth/register/verify-otp", { method: "POST", body }),
  resendRegistration: body => request("/auth/register/resend-otp", { method: "POST", body }),
  requestRecovery: body => request("/auth/forgot-password", { method: "POST", body }),
  verifyRecovery: body => request("/auth/forgot-password/verify-otp", { method: "POST", body }),
  resendRecovery: body => request("/auth/forgot-password/resend-otp", { method: "POST", body }),
  resetPassword: body => request("/auth/reset-password", { method: "POST", body }),
  logout: () => request("/auth/logout", { method: "POST" }),
};
