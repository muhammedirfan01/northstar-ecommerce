import { inputFrom } from "./requestInput.js";
import * as registrationOtpService from "../services/registrationOtpService.js";

export async function verifyRegistration(req, res) {
  const result = await registrationOtpService.verifyRegistration(inputFrom(req));
  return res.status(result.status).json(result.body);
}

export async function resendRegistrationOtp(req, res) {
  const result = await registrationOtpService.resendRegistrationOtp(inputFrom(req));
  return res.status(result.status).json(result.body);
}
