import { validationError } from "../utils/validation.js";
export function checkRecoveryEmail(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["email"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let email = original.email;
  if (typeof email !== "string") {
    throw validationError("Invalid email.", "email");
  }
  email = email.trim();
  email = email.toLowerCase();
  if (
    !/^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/.test(
      email,
    )
  ) {
    throw validationError("Enter a valid email address.", "email");
  }
  if (email.length > 254) {
    throw validationError("Invalid email.", "email");
  }
  input.email = email;
  return input;
}
export function checkRecoveryResend(input) {
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
    throw validationError("Invalid challengeId.", "challengeId");
  }
  challengeId = challengeId.toLowerCase();
  input.challengeId = challengeId;
  return input;
}
export function checkRecoveryCode(input) {
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
  let challengeId = original.challengeId;
  if (typeof challengeId !== "string") {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  if (!/^[a-f0-9]{24}$/i.test(challengeId)) {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  challengeId = challengeId.toLowerCase();
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
export function checkPasswordReset(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      !["challengeId", "resetToken", "password", "confirmPassword"].includes(
        field,
      )
    ) {
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
    throw validationError("Invalid challengeId.", "challengeId");
  }
  challengeId = challengeId.toLowerCase();
  input.challengeId = challengeId;
  const resetToken = original.resetToken;
  if (typeof resetToken !== "string") {
    throw validationError("Invalid resetToken.", "resetToken");
  }
  if (!/^[a-f0-9]{64}$/i.test(resetToken)) {
    throw validationError("Invalid resetToken.", "resetToken");
  }
  input.resetToken = resetToken;
  const password = original.password;
  if (typeof password !== "string") {
    throw validationError("Invalid password.", "password");
  }
  if (password.length < 8) {
    throw validationError("Invalid password.", "password");
  }
  if (password.length > 128) {
    throw validationError("Invalid password.", "password");
  }
  input.password = password;
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
  if (!(input.password === input.confirmPassword)) {
    throw validationError("Passwords do not match.", "form");
  }
  return input;
}
export function validateRecoveryEmail(req, res, next) {
  try {
    req.body = checkRecoveryEmail(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateRecoveryResend(req, res, next) {
  try {
    req.body = checkRecoveryResend(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateRecoveryCode(req, res, next) {
  try {
    req.body = checkRecoveryCode(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validatePasswordReset(req, res, next) {
  try {
    req.body = checkPasswordReset(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
