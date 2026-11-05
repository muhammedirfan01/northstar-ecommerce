import { validationError } from "../validation.js";
import { nameError } from "../nameValidation.js";
import { checkFields } from "../formValidation.js";
import {
  readEmail,
  readPassword,
  readChallengeId,
  readCode,
} from "../accountValidation.js";
export function checkProfileDetails(input) {
  checkFields(input, ["name", "phone"]);
  const invalidName = nameError(input.name);
  if (invalidName) throw validationError(invalidName, "name");
  const name = input.name.trim();
  if (typeof input.phone !== "string")
    throw validationError("Invalid phone.", "phone");
  const phone = input.phone.trim();
  if (
    phone.length > 25 ||
    (phone !== "" && !/^[+\d\s()-]{7,25}$/.test(phone))
  ) {
    throw validationError("Invalid phone.", "phone");
  }
  return {
    name,
    phone,
  };
}
export function checkProfileEmail(input) {
  checkFields(input, ["newEmail", "currentPassword"]);
  const result = {
    newEmail: readEmail(input.newEmail, "newEmail", Infinity),
  };
  if (input.currentPassword !== undefined) {
    if (
      typeof input.currentPassword !== "string" ||
      input.currentPassword.length < 1
    ) {
      throw validationError("Invalid currentPassword.", "currentPassword");
    }
    result.currentPassword = input.currentPassword;
  }
  return result;
}
export function checkProfileEmailCodes(input) {
  checkFields(input, ["challengeId", "currentCode", "newCode"]);
  return {
    challengeId: readChallengeId(input.challengeId),
    currentCode: readCode(input.currentCode, "currentCode"),
    newCode: readCode(input.newCode, "newCode"),
  };
}
export function checkProfileResend(input) {
  checkFields(input, ["challengeId"]);
  return {
    challengeId: readChallengeId(input.challengeId),
  };
}
export function checkPasswordRequest(input) {
  checkFields(input, ["newPassword", "confirmPassword"]);
  const newPassword = readPassword(input.newPassword, "newPassword");
  const confirmPassword = readPassword(
    input.confirmPassword,
    "confirmPassword",
  );
  if (newPassword !== confirmPassword)
    throw validationError("Passwords do not match.", "form");
  return {
    newPassword,
    confirmPassword,
  };
}
export function checkProfilePassword(input) {
  checkFields(input, ["challengeId", "code"]);
  return {
    challengeId: readChallengeId(input.challengeId),
    code: readCode(input.code),
  };
}
