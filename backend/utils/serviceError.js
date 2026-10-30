export function serviceError(message, status = 400, data) {
  const error = new Error(message);
  error.status = status;
  error.data = data;
  error.expose = true;
  return error;
}
