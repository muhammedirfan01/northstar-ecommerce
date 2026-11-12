export function createError(message, statusCode = 400, extraDetails) {
  const error = new Error(message);
  error.status = statusCode;
  error.data = extraDetails;
  error.expose = true; // Allow this message to be shown to the user.
  return error;
}
