import { validationError } from "../utils/validation.js";
export function checkShoppingAdd(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["productId", "variantId", "quantity"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let productId = original.productId;
  if (typeof productId !== "string") {
    throw validationError("Invalid productId.", "productId");
  }
  if (!/^[a-f0-9]{24}$/i.test(productId)) {
    throw validationError("Invalid product or cart ID.", "productId");
  }
  productId = productId.toLowerCase();
  input.productId = productId;
  let variantId = original.variantId;
  if (variantId === undefined) {
    variantId = null;
  } else {
    if (variantId !== null) {
      if (typeof variantId !== "string") {
        throw validationError("Invalid variantId.", "variantId");
      }
      if (!/^[a-f0-9]{24}$/i.test(variantId)) {
        throw validationError("Invalid product or cart ID.", "variantId");
      }
      variantId = variantId.toLowerCase();
    }
  }
  if (variantId !== undefined) {
    input.variantId = variantId;
  }
  const quantity = original.quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (!Number.isSafeInteger(quantity)) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (quantity < 1) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (quantity > 5) {
    throw validationError(
      "A product option can have at most 5 units.",
      "quantity",
    );
  }
  if (quantity !== undefined) {
    input.quantity = quantity;
  }
  return input;
}
export function checkShoppingQuantity(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["quantity"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const quantity = original.quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (!Number.isSafeInteger(quantity)) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (quantity < 1) {
    throw validationError("Invalid quantity.", "quantity");
  }
  if (quantity > 5) {
    throw validationError(
      "A product option can have at most 5 units.",
      "quantity",
    );
  }
  if (quantity !== undefined) {
    input.quantity = quantity;
  }
  return input;
}
export function checkShoppingWish(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["productId"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let productId = original.productId;
  if (typeof productId !== "string") {
    throw validationError("Invalid productId.", "productId");
  }
  if (!/^[a-f0-9]{24}$/i.test(productId)) {
    throw validationError("Invalid product or cart ID.", "productId");
  }
  productId = productId.toLowerCase();
  input.productId = productId;
  return input;
}
export function checkShoppingCheckout(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (!["expectedTotalPaise"].includes(field)) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  const expectedTotalPaise = original.expectedTotalPaise;
  if (
    typeof expectedTotalPaise !== "number" ||
    !Number.isFinite(expectedTotalPaise)
  ) {
    throw validationError("Invalid expectedTotalPaise.", "expectedTotalPaise");
  }
  if (!Number.isSafeInteger(expectedTotalPaise)) {
    throw validationError("Invalid expectedTotalPaise.", "expectedTotalPaise");
  }
  if (expectedTotalPaise < 0) {
    throw validationError("Invalid expectedTotalPaise.", "expectedTotalPaise");
  }
  if (expectedTotalPaise > Number.MAX_SAFE_INTEGER) {
    throw validationError("Invalid expectedTotalPaise.", "expectedTotalPaise");
  }
  if (expectedTotalPaise !== undefined) {
    input.expectedTotalPaise = expectedTotalPaise;
  }
  return input;
}
export function validateCartAdd(req, res, next) {
  try {
    req.shoppingInput = checkShoppingAdd(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateCartQuantity(req, res, next) {
  try {
    req.shoppingInput = checkShoppingQuantity(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateWishlistAdd(req, res, next) {
  try {
    req.shoppingInput = checkShoppingWish(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
export function validateCheckout(req, res, next) {
  try {
    req.shoppingInput = checkShoppingCheckout(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
  next();
}
