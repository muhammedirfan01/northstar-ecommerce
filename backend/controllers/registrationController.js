import { registerAccount } from "../services/registrationService.js";

export async function register(req, res) {
  const challenge = await registerAccount(req.body);
  return res.status(202).json({
    success: true,
    message: "If this email can be registered, a verification code has been sent.",
    data: challenge
  });
}
