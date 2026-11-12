// Create an error when a submitted form value is invalid.
export function createValidationError(message, fieldName) {
  const error = new Error(message);
  error.field = fieldName; // Record which input caused the error, such as "email".
  error.status = 400;
  error.expose = true; // Allow the error middleware to show this message.
  return error;
}
