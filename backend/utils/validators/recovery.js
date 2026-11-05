import { validationError } from "../validation.js";
import { checkFields } from "../formValidation.js";
import {
  readEmail,
  readPassword,
  readChallengeId,
  readCode,
} from "../accountValidation.js";
export function checkRecoveryEmail(input) {
  checkFields(input, ["email"]);
  return {
    email: readEmail(input.email),
  };
}
export function checkRecoveryResend(input) {
  checkFields(input, ["challengeId"]);
  return {
    challengeId: readChallengeId(input.challengeId, true),
  };
}
export function checkRecoveryCode(input) {
  checkFields(input, ["challengeId", "code"]);
  const challengeId = readChallengeId(input.challengeId, true);
  const code = readCode(input.code);
  return {
    challengeId,
    code,
  };
}
export function checkPasswordReset(input) {
  checkFields(input, [
    "challengeId",
    "resetToken",
    "password",
    "confirmPassword",
  ]);
  const challengeId = readChallengeId(input.challengeId, true);
  const resetToken = input.resetToken;
  if (typeof resetToken !== "string" || !/^[a-f0-9]{64}$/i.test(resetToken)) {
    throw validationError("Invalid resetToken.", "resetToken");
  }
  const password = readPassword(input.password, "password");
  const confirmPassword = readPassword(
    input.confirmPassword,
    "confirmPassword",
  );
  if (password !== confirmPassword) {
    throw validationError("Passwords do not match.", "form");
  }
  return {
    challengeId,
    resetToken,
    password,
    confirmPassword,
  };
}
