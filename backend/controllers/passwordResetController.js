import * as passwordResetService from "../services/passwordResetService.js";

export async function requestRecovery(req, res) {
  const result = await passwordResetService.requestRecovery({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function resendRecovery(req, res) {
  const result = await passwordResetService.resendRecovery({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function verifyRecovery(req, res) {
  const result = await passwordResetService.verifyRecovery({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function resetPassword(req, res) {
  const result = await passwordResetService.resetPassword({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}
