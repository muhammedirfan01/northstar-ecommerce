import { inputFrom, inputWithUrl } from "./requestInput.js";
import { setLoginCookie } from "../utils/jwt.js";
import * as profileSecurityService from "../services/profileSecurityService.js";
export async function requestEmailChange(req, res) {
  const result = await profileSecurityService.requestEmailChange(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function verifyEmailChange(req, res) {
  const result = await profileSecurityService.verifyEmailChange(inputWithUrl(req));
  if (result.authUser) {
    setLoginCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}
export async function requestPasswordChange(req, res) {
  const result = await profileSecurityService.requestPasswordChange(inputFrom(req));
  return res.status(result.status).json(result.body);
}
export async function changePassword(req, res) {
  const result = await profileSecurityService.changePassword(inputWithUrl(req));
  if (result.authUser) {
    setLoginCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}
export async function resendSecurityCode(req, res) {
  const result = await profileSecurityService.resendSecurityCode(inputFrom(req));
  return res.status(result.status).json(result.body);
}
