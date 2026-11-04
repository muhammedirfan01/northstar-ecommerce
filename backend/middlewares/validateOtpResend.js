import { validationError } from "../utils/validation.js";
export function checkResend(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["challengeId"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let challengeId = original.challengeId;
  if (typeof challengeId !== "string") {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  if (!/^[a-f0-9]{24}$/i.test(challengeId)) {
    throw validationError("Invalid verification ID", "challengeId");
  }
  challengeId = challengeId.toLowerCase();
  input.challengeId = challengeId;
  return input;
}
export default function validateOtpResend(req, res, next) {
  try {
    req.body = checkResend(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
