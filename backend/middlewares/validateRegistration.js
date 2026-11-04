import { nameError } from "../utils/nameValidation.js";
import { validationError } from "../utils/validation.js";
export function checkRegistration(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["name", "email", "password", "acceptedTerms"].includes(field)) {
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
  const acceptedTerms = original.acceptedTerms;
  if (acceptedTerms !== true) {
    throw validationError("Invalid acceptedTerms.", "acceptedTerms");
  }
  if (acceptedTerms !== undefined) {
    input.acceptedTerms = acceptedTerms;
  }
  return input;
}
export default function validateRegistration(req, res, next) {
  try {
    req.body = checkRegistration(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
