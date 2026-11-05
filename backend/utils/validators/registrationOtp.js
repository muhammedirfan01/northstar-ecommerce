import { validationError } from "../validation.js";
export function checkRegistrationCode(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["challengeId", "code"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const challengeId = original.challengeId;
  if (typeof challengeId !== "string") {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  if (!/^[a-f0-9]{24}$/i.test(challengeId)) {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  input.challengeId = challengeId;
  const code = original.code;
  if (typeof code !== "string") {
    throw validationError("Invalid code.", "code");
  }
  if (!/^\d{6}$/.test(code)) {
    throw validationError("Invalid code.", "code");
  }
  input.code = code;
  return input;
}
