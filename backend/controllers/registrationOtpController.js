import { makeServiceInput } from "./makeServiceInput.js";
import * as registrationOtpService from "../services/registrationOtpService.js";

export async function verifyRegistration(req, res) {
  const result = await registrationOtpService.verifyRegistration(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}

export async function resendRegistrationOtp(req, res) {
  const result = await registrationOtpService.resendRegistrationOtp(makeServiceInput(req));
  return res.status(result.status).json(result.body);
}
