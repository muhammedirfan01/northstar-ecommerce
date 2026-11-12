import { MAX_CART_QUANTITY } from "../constants/shopping.js";
import { createValidationError } from "./validation.js";
import { validateFormFields, validateId } from "./formValidation.js";

function validateQuantity(quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw createValidationError("Invalid quantity.", "quantity");
  }

  if (quantity > MAX_CART_QUANTITY) {
    throw createValidationError(
      "A product option can have at most " + MAX_CART_QUANTITY + " units.",
      "quantity",
    );
  }

  return quantity;
}

export function validateCartItem(input) {
  validateFormFields(input, ["productId", "variantId", "quantity"]);

  const productId = validateId(
    input.productId,
    "productId",
    "Invalid product or cart ID.",
  ).toLowerCase();

  let variantId = null;

  if (input.variantId !== undefined && input.variantId !== null) {
    variantId = validateId(
      input.variantId,
      "variantId",
      "Invalid product or cart ID.",
    ).toLowerCase();
  }

  return {
    productId,
    variantId,
    quantity: validateQuantity(input.quantity),
  };
}

export function validateCartQuantity(input) {
  validateFormFields(input, ["quantity"]);

  return {
    quantity: validateQuantity(input.quantity),
  };
}

export function validateWishlistItem(input) {
  validateFormFields(input, ["productId"]);

  return {
    productId: validateId(
      input.productId,
      "productId",
      "Invalid product or cart ID.",
    ).toLowerCase(),
  };
}