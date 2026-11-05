import * as registrationOtpService from "../services/registrationOtpService.js";

export async function verifyRegistration(req, res) {
  const result = await registrationOtpService.verifyRegistration({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}

export async function resendRegistrationOtp(req, res) {
  const result = await registrationOtpService.resendRegistrationOtp({
    body: req.body,
  });
  return res.status(result.status).json(result.body);
}
