import * as registrationOtpService from "../services/registrationOtpService.js";

export async function verifyRegistration(req, res) {
  const result = await registrationOtpService.verifyRegistration(req.body);
  return res.status(201).json({
    success: true,
    message: "Registration completed. Please sign in.",
    data: result
  });
}

export async function resendRegistrationOtp(req, res) {
  const challenge = await registrationOtpService.resendRegistrationOtp(req.body);
  return res.json({
    success: true,
    message: "A new verification code has been sent.",
    data: challenge
  });
}
