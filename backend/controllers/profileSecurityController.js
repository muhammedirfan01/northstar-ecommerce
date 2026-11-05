import { issueAuthCookie } from "../utils/jwt.js";
import * as profileSecurityService from "../services/profileSecurityService.js";
export async function requestEmailChange(req, res) {
  const result = await profileSecurityService.requestEmailChange({
    body: req.body,
    user: req.user,
  });
  return res.status(result.status).json(result.body);
}
export async function verifyEmailChange(req, res) {
  const result = await profileSecurityService.verifyEmailChange({
    user: req.user,
    body: req.body,
    apiBaseUrl: req.headers?.host
      ? `${req.protocol || "http"}://${req.headers.host}/api`
      : "",
  });
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}
export async function requestPasswordChange(req, res) {
  const result = await profileSecurityService.requestPasswordChange({
    body: req.body,
    user: req.user,
  });
  return res.status(result.status).json(result.body);
}
export async function changePassword(req, res) {
  const result = await profileSecurityService.changePassword({
    user: req.user,
    body: req.body,
    apiBaseUrl: req.headers?.host
      ? `${req.protocol || "http"}://${req.headers.host}/api`
      : "",
  });
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}
export async function resendSecurityCode(req, res) {
  const result = await profileSecurityService.resendSecurityCode({
    body: req.body,
    user: req.user,
  });
  return res.status(result.status).json(result.body);
}
