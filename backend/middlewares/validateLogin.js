import { validationError } from "../utils/validation.js";
export function checkLogin(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
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
  const password = original.password;
  if (typeof password !== "string") {
    throw validationError("Invalid password.", "password");
  }
  if (password.length < 1) {
    throw validationError("Invalid password.", "password");
  }
  if (password.length > 128) {
    throw validationError("Invalid password.", "password");
  }
  input.password = password;
  return input;
}
export default function validateLogin(req, res, next) {
  try {
    req.body = checkLogin(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
