import { createValidationError } from "./validation.js";

export function validateEmail(value, field = "email", maxLength = 254) {
  if (typeof value !== "string") {
    throw createValidationError("Invalid " + field + ".", field);
  }

  const email = value.trim().toLowerCase();
  const pattern =
    /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

  if (!pattern.test(email)) {
    throw createValidationError("Enter a valid email address.", field);
  }
  if (email.length > maxLength) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return email;
}

export function validatePassword(value, field, minLength = 8) {
  if (
    typeof value !== "string" ||
    value.length < minLength ||
    value.length > 128
  ) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return value;
}

export function validateVerificationId(value, lowercase = false) {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) {
    throw createValidationError("Invalid challengeId.", "challengeId");
  }

  if (lowercase) {
    return value.toLowerCase();
  }

  return value;
}

export function validateOtp(value, field = "code") {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return value;
}

export function validateAddressVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createValidationError("Invalid version.", "version");
  }

  return value;
}