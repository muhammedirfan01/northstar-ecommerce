// Check common form values before a service uses them.
import { createValidationError } from "./validation.js";

export function validateForm(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createValidationError("Invalid form.", "form");
  }
}

export function validateFormFields(input, allowedFields, field = "form") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  for (const key of Object.keys(input)) {
    if (!allowedFields.includes(key)) {
      throw createValidationError("Unknown form field.", field);
    }
  }
}

export function validateText(value, field, min, max, shortMessage) {
  if (typeof value !== "string") {
    throw createValidationError("Invalid " + field + ".", field);
  }

  const text = value.trim();

  if (text.length < min) {
    throw createValidationError(
      shortMessage || "Invalid " + field + ".",
      field,
    );
  }
  if (text.length > max) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return text;
}

export function validateBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return value;
}

export function validateChoice(value, field, choices) {
  if (!choices.includes(value)) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return value;
}

export function validateId(value, field, message = "Invalid catalog ID.") {
  if (typeof value !== "string") {
    throw createValidationError("Invalid " + field + ".", field);
  }
  if (!/^[a-f0-9]{24}$/i.test(value)) {
    throw createValidationError(message, field);
  }

  return value;
}

export function validateArray(value, field, max) {
  if (!Array.isArray(value) || value.length > max) {
    throw createValidationError("Invalid " + field + ".", field);
  }
}

export function validateQueryNumber(value, field, min, max, wholeNumber = false) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createValidationError("Invalid " + field + ".", field);
  }
  if (wholeNumber && !Number.isSafeInteger(number)) {
    throw createValidationError("Invalid " + field + ".", field);
  }

  return number;
}

export function getFormData(body) {
  if (typeof body?.data !== "string") {
    return body;
  }

  try {
    return JSON.parse(body.data);
  } catch {
    throw createValidationError("Invalid form data.", "form");
  }
}