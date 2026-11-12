// Add products to the wishlist or remove them.

import { checkCatalogParams, productIsAvailable, categoryDetails } from "./catalogService.js";
import { validateWishlistItem } from "../utils/shoppingValidation.js";
import { loadShoppingList, saveShoppingList, getWishlistDetails } from "./shoppingService.js";
import Product from "../models/Product.js";
import { createError } from "../utils/httpError.js";

// The controller passes request data here and sends the result back to the browser.

export async function getWishlist(requestData) {
  const userId = requestData.user.id;
  const list = await loadShoppingList(userId);
  const responseData = await getWishlistDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function addToWishlist(requestData) {
  requestData.data = validateWishlistItem(requestData.body);
  const userId = requestData.user.id;
  const productId = requestData.data.productId;
  const product =
    await Product.findById(productId).populate(categoryDetails);
  if (!productIsAvailable(product)) {
    throw createError("This product is unavailable.", 409);
  }
  const list = await loadShoppingList(userId);
  if (!list.wishlist.some((id) => String(id) === productId)) {
    if (list.wishlist.length >= 100) {
      throw createError("Your wishlist can contain up to 100 products.");
    }
    list.wishlist.unshift(productId);
    await saveShoppingList(list);
  }
  const responseData = await getWishlistDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function removeFromWishlist(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const userId = requestData.user.id;
  const productId = requestData.params.id;
  const list = await loadShoppingList(userId);
  list.wishlist = list.wishlist.filter((id) => String(id) !== productId);
  await saveShoppingList(list);
  const responseData = await getWishlistDetails(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
