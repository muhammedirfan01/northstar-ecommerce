import { makeServiceInput, makePublicServiceInput } from "./makeServiceInput.js";
import { issueAuthCookie } from "../utils/jwt.js";
import * as profileSecurityService from "../services/profileSecurityService.js";
export async function requestEmailChange(req, res) {
  const result = await profileSecurityService.requestEmailChange(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function verifyEmailChange(req, res) {
  const result = await profileSecurityService.verifyEmailChange(makePublicServiceInput(req));
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}
export async function requestPasswordChange(req, res) {
  const result = await profileSecurityService.requestPasswordChange(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
export async function changePassword(req, res) {
  const result = await profileSecurityService.changePassword(makePublicServiceInput(req));
  if (result.authUser) {
    issueAuthCookie(res, result.authUser);
  }
  return res.status(result.status).json(result.body);
}
export async function resendSecurityCode(req, res) {
  const result = await profileSecurityService.resendSecurityCode(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
