import { nameError } from "../utils/nameValidation.js";
import { validationError } from "../utils/validation.js";
export function checkProfileDetails(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["name", "phone"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const invalidName = nameError(original.name);
  if (invalidName) {
    throw validationError(invalidName, "name");
  }
  input.name = original.name.trim();
  let phone = original.phone;
  if (typeof phone !== "string") {
    throw validationError("Invalid phone.", "phone");
  }
  phone = phone.trim();
  if (phone.length > 25) {
    throw validationError("Invalid phone.", "phone");
  }
  if (!(phone === "" || /^[+\d\s()-]{7,25}$/.test(phone))) {
    throw validationError("Invalid phone.", "phone");
  }
  input.phone = phone;
  return input;
}
export function checkProfileEmail(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["newEmail", "currentPassword"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let newEmail = original.newEmail;
  if (typeof newEmail !== "string") {
    throw validationError("Invalid newEmail.", "newEmail");
  }
  newEmail = newEmail.trim();
  newEmail = newEmail.toLowerCase();
  if (
    !/^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(
      newEmail,
    )
  ) {
    throw validationError("Enter a valid email address.", "newEmail");
  }
  input.newEmail = newEmail;
  const currentPassword = original.currentPassword;
  if (currentPassword !== undefined) {
    if (typeof currentPassword !== "string") {
      throw validationError("Invalid currentPassword.", "currentPassword");
    }
    if (currentPassword.length < 1) {
      throw validationError("Invalid currentPassword.", "currentPassword");
    }
  }
  if (currentPassword !== undefined) {
    input.currentPassword = currentPassword;
  }
  return input;
}
export function checkProfileEmailCodes(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["challengeId", "currentCode", "newCode"].includes(field)) {
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
  const currentCode = original.currentCode;
  if (typeof currentCode !== "string") {
    throw validationError("Invalid currentCode.", "currentCode");
  }
  if (!/^\d{6}$/.test(currentCode)) {
    throw validationError("Invalid currentCode.", "currentCode");
  }
  input.currentCode = currentCode;
  const newCode = original.newCode;
  if (typeof newCode !== "string") {
    throw validationError("Invalid newCode.", "newCode");
  }
  if (!/^\d{6}$/.test(newCode)) {
    throw validationError("Invalid newCode.", "newCode");
  }
  input.newCode = newCode;
  return input;
}
export function checkProfileResend(input) {
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
  const challengeId = original.challengeId;
  if (typeof challengeId !== "string") {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  if (!/^[a-f0-9]{24}$/i.test(challengeId)) {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  input.challengeId = challengeId;
  return input;
}
export function checkPasswordRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["newPassword", "confirmPassword"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const newPassword = original.newPassword;
  if (typeof newPassword !== "string") {
    throw validationError("Invalid newPassword.", "newPassword");
  }
  if (newPassword.length < 8) {
    throw validationError("Invalid newPassword.", "newPassword");
  }
  if (newPassword.length > 128) {
    throw validationError("Invalid newPassword.", "newPassword");
  }
  input.newPassword = newPassword;
  const confirmPassword = original.confirmPassword;
  if (typeof confirmPassword !== "string") {
    throw validationError("Invalid confirmPassword.", "confirmPassword");
  }
  if (confirmPassword.length < 8) {
    throw validationError("Invalid confirmPassword.", "confirmPassword");
  }
  if (confirmPassword.length > 128) {
    throw validationError("Invalid confirmPassword.", "confirmPassword");
  }
  input.confirmPassword = confirmPassword;
  if (!(input.newPassword === input.confirmPassword)) {
    throw validationError("Passwords do not match.", "form");
  }
  return input;
}
export function checkProfilePassword(input) {
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
export function validateProfileDetails(req, res, next) {
  try {
    req.body = checkProfileDetails(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateEmailChange(req, res, next) {
  try {
    req.body = checkProfileEmail(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateEmailCodes(req, res, next) {
  try {
    req.body = checkProfileEmailCodes(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateSecurityResend(req, res, next) {
  try {
    req.body = checkProfileResend(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validatePasswordChangeRequest(req, res, next) {
  try {
    req.body = checkPasswordRequest(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validatePasswordChange(req, res, next) {
  try {
    req.body = checkProfilePassword(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
