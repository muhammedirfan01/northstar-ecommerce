import { request } from "./request.js";

export const profileApi = {
  get: signal => request("/profile", { signal }),
  save: body => request("/profile", { method: "PATCH", body }),
  requestEmail: body => request("/profile/email", { method: "POST", body }),
  verifyEmail: body => request("/profile/email/verify", { method: "POST", body }),
  requestPasswordCode: body => request("/profile/password/code", { method: "POST", body }),
  changePassword: body => request("/profile/password", { method: "PATCH", body }),
  resend: challengeId => request("/profile/security/resend", { method: "POST", body: { challengeId } }),
};
