import { validationError } from "../validation.js";
import { checkFields, readId } from "../formValidation.js";

// Cart quantities are JSON numbers. Do not convert text like "2" into a number.
function readQuantity(quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (quantity > 9) {
    throw validationError(
      "A product option can have at most 5 units.",
      "quantity",
    );
  }
  return quantity;
}
export function checkShoppingAdd(input) {
  checkFields(input, ["productId", "variantId", "quantity"]);
  const productId = readId(
    input.productId,
    "productId",
    "Invalid product or cart ID.",
  ).toLowerCase();
  let variantId = null;
  if (input.variantId !== undefined && input.variantId !== null) {
    variantId = readId(
      input.variantId,
      "variantId",
      "Invalid product or cart ID.",
    ).toLowerCase();
  }
  return {
    productId,
    variantId,
    quantity: readQuantity(input.quantity),
  };
}
export function checkShoppingQuantity(input) {
  checkFields(input, ["quantity"]);
  return {
    quantity: readQuantity(input.quantity),
  };
}
export function checkShoppingWish(input) {
  checkFields(input, ["productId"]);
  return {
    productId: readId(
      input.productId,
      "productId",
      "Invalid product or cart ID.",
    ).toLowerCase(),
  };
}
export function checkShoppingCheckout(input) {
  checkFields(input, ["expectedTotalPaise"]);
  const total = input.expectedTotalPaise;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw validationError("Invalid expectedTotalPaise.", "expectedTotalPaise");
  }
  return {
    expectedTotalPaise: total,
  };
}
