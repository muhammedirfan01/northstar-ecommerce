import { validationError } from "./validation.js";

export function readEmail(value, field = "email", maxLength = 254) {
  if (typeof value !== "string") {
    throw validationError("Invalid " + field + ".", field);
  }
  const email = value.trim().toLowerCase();
  const pattern =
    /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
  if (!pattern.test(email)) {
    throw validationError("Enter a valid email address.", field);
  }
  if (email.length > maxLength) {
    throw validationError("Invalid " + field + ".", field);
  }
  return email;
}

export function readPassword(value, field, minLength = 8) {
  // Password spaces are significant. Do not trim or lowercase passwords.
  if (
    typeof value !== "string" ||
    value.length < minLength ||
    value.length > 128
  ) {
    throw validationError("Invalid " + field + ".", field);
  }
  return value;
}

export function readChallengeId(value, lowercase = false) {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) {
    throw validationError("Invalid challengeId.", "challengeId");
  }
  if (lowercase) return value.toLowerCase();
  return value;
}

export function readCode(value, field = "code") {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw validationError("Invalid " + field + ".", field);
  }
  return value;
}

export function readAddressVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw validationError("Invalid version.", "version");
  }
  return value;
}
