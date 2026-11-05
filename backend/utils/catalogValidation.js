import { validationError } from "./validation.js";
import { checkArray, readId } from "./formValidation.js";

// Admin forms send rupees as text: "123.45" becomes 12345 paise.
export function readPrice(value, field) {
  if (typeof value !== "string") {
    throw validationError(`Invalid ${field}.`, field);
  }
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value)) {
    throw validationError(
      "Enter a valid price with at most 2 decimal places.",
      field,
    );
  }
  const paise = Math.round(Number(value) * 100);
  if (paise <= 0) {
    throw validationError("Price must be greater than zero.", field);
  }
  return paise;
}

export function readStock(value) {
  if (typeof value !== "string") {
    throw validationError("Invalid stock.", "stock");
  }
  if (!/^\d{1,7}$/.test(value)) {
    throw validationError("Stock must be a whole number.", "stock");
  }
  const stock = Number(value);
  if (stock > 1000000) {
    throw validationError("Stock cannot exceed 1,000,000.", "stock");
  }
  return stock;
}

export function readImageIds(value, duplicateMessage) {
  const field = "retainedImageIds";
  checkArray(value, field, 6);
  const ids = [];
  for (const id of value) {
    ids.push(readId(id, field));
  }
  if (new Set(ids).size !== ids.length) {
    throw validationError(duplicateMessage, field);
  }
  return ids;
}

// Query strings contain text, so convert them before checking number limits.
