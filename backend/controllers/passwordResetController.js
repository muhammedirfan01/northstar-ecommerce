import { makeServiceInput } from "./makeServiceInput.js";
import * as passwordResetService from "../services/passwordResetService.js";

export async function requestRecovery(req, res) {
  const result = await passwordResetService.requestRecovery(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function resendRecovery(req, res) {
  const result = await passwordResetService.resendRecovery(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function verifyRecovery(req, res) {
  const result = await passwordResetService.verifyRecovery(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function resetPassword(req, res) {
  const result = await passwordResetService.resetPassword(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
