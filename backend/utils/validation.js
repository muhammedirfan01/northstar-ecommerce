// A small error object lets middleware return a consistent message and field name.
export function validationError(message, field) {
  const error = new Error(message);
  error.field = field;
  return error;
}
