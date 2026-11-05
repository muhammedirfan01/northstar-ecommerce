import { validationError } from "./validation.js";

export function checkObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
}

export function checkFields(input, allowedFields, field = "form") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError(`Invalid ${field}.`, field);
  }
  for (const key of Object.keys(input)) {
    if (!allowedFields.includes(key)) {
      throw validationError("Unknown form field.", field);
    }
  }
}

export function readText(value, field, minLength, maxLength, shortMessage) {
  if (typeof value !== "string") {
    throw validationError(`Invalid ${field}.`, field);
  }
  const text = value.trim();
  if (text.length < minLength) {
    throw validationError(shortMessage || `Invalid ${field}.`, field);
  }
  if (text.length > maxLength) {
    throw validationError(`Invalid ${field}.`, field);
  }
  return text;
}

export function readBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw validationError(`Invalid ${field}.`, field);
  }
  return value;
}

export function readChoice(value, field, choices) {
  if (!choices.includes(value)) {
    throw validationError(`Invalid ${field}.`, field);
  }
  return value;
}

export function readId(value, field, message = "Invalid catalog ID.") {
  if (typeof value !== "string") {
    throw validationError(`Invalid ${field}.`, field);
  }
  if (!/^[a-f0-9]{24}$/i.test(value)) {
    throw validationError(message, field);
  }
  return value;
}

// Admin forms send rupees as text: "123.45" becomes 12345 paise.

export function checkArray(value, field, maxLength) {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw validationError(`Invalid ${field}.`, field);
  }
}

// Query strings contain text, so convert them before checking number limits.
export function readQueryNumber(value, field, min, max, wholeNumber = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw validationError(`Invalid ${field}.`, field);
  }
  if (wholeNumber && !Number.isSafeInteger(number)) {
    throw validationError(`Invalid ${field}.`, field);
  }
  return number;
}

export function readFormBody(body) {
  if (typeof body?.data !== "string") return body;
  try {
    return JSON.parse(body.data);
  } catch {
    throw validationError("Invalid form data.", "form");
  }
}
