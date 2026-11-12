// Add products to the cart, change quantities and remove cart items.

import { checkCatalogParams, getDefaultVariant, productIsAvailable, categoryDetails } from "./catalogService.js";
import { validateCartItem, validateCartQuantity } from "../utils/shoppingValidation.js";
import { loadShoppingList, saveShoppingList, getCartDetails, getCartItemDetails } from "./shoppingService.js";
import Product from "../models/Product.js";
import { createError } from "../utils/httpError.js";

// The controller passes request data here and sends the result back to the browser.

export async function getCart(requestData) {
  const userId = requestData.user.id;
  const list = await loadShoppingList(userId);
  const responseData = await getCartDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function addToCart(requestData) {
  requestData.data = validateCartItem(requestData.body);
  // 1. Load the customer's list and the current product from MongoDB.
  const userId = requestData.user.id;
  const cartItem = requestData.data;
  let variantId = cartItem.variantId;
  const list = await loadShoppingList(userId);
  const product = await Product.findById(cartItem.productId).populate(
    categoryDetails,
  );
  if (!productIsAvailable(product)) {
    throw createError("This product is unavailable.", 409);
  }
  if (product.variants.length && !cartItem.variantId) {
    const selected = getDefaultVariant(product);
    if (!selected) {
      throw createError("This product is unavailable.", 409);
    }
    variantId = String(selected._id);
  }
  // 2. Adding the same product option increases its existing quantity.
  const item = list.cart.find(
    (item) =>
      String(item.productId) === cartItem.productId &&
      String(item.variantId || "") === (variantId || ""),
  );
  const quantity = (item?.quantity || 0) + cartItem.quantity;
  const proposed = {
    productId: cartItem.productId,
    variantId,
    quantity,
  };
  // 3. Reuse the same stock and quantity checks used when displaying the cart.
  const checked = getCartItemDetails(proposed, product);
  if (!checked.valid) {
    throw createError(checked.error, 409);
  }
  if (item) {
    item.quantity = quantity;
  } else {
    if (list.cart.length >= 50) {
      throw createError("Your cart can contain up to 50 product options.");
    }
    list.cart.push(proposed);
  }
  // 4. Save the cart and remove this product from the wishlist together.
  list.wishlist = list.wishlist.filter((id) => String(id) !== cartItem.productId);
  await saveShoppingList(list);
  const responseData = await getCartDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function updateCartItem(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  requestData.data = validateCartQuantity(requestData.body);
  const userId = requestData.user.id;
  const id = requestData.params.id;
  const quantity = requestData.data.quantity;
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) {
    throw createError("Cart item not found.", 404);
  }
  const product = await Product.findById(item.productId).populate(
    categoryDetails,
  );
  const checked = getCartItemDetails(
    {
      ...item.toObject(),
      quantity,
    },
    product,
  );
  if (!checked.valid) {
    throw createError(checked.error, 409);
  }
  item.quantity = quantity;
  await saveShoppingList(list);
  const responseData = await getCartDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function removeCartItem(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const userId = requestData.user.id;
  const id = requestData.params.id;
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) {
    throw createError("Cart item not found.", 404);
  }
  item.deleteOne();
  await saveShoppingList(list);
  const responseData = await getCartDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
