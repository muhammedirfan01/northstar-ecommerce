import { checkCatalogParams } from "../utils/validators/catalog.js";
import { checkShoppingWish } from "../utils/validators/shopping.js";
// Application steps. Input is a plain object; the controller sends the response.
import { loadShoppingList, saveShoppingList } from "../utils/shopping.js";
import Product from "../models/Product.js";
import { httpError } from "../utils/httpError.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
export async function getWishlist(input) {
  const userId = input.user.id;
  const list = await loadShoppingList(userId);
  const responseData = await wishlistData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function addWish(input) {
  input.data = checkShoppingWish(input.body);
  const userId = input.user.id;
  const productId = input.data.productId;
  const product =
    await Product.findById(productId).populate(categoryPopulation);
  if (!productIsAvailable(product)) {
    throw httpError("This product is unavailable.", 409);
  }
  const list = await loadShoppingList(userId);
  if (!list.wishlist.some((id) => String(id) === productId)) {
    if (list.wishlist.length >= 100) {
      throw httpError("Your wishlist can contain up to 100 products.");
    }
    list.wishlist.unshift(productId);
    await saveShoppingList(list);
  }
  const responseData = await wishlistData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function removeWish(input) {
  input.params = checkCatalogParams(input.params);
  const userId = input.user.id;
  const productId = input.params.id;
  const list = await loadShoppingList(userId);
  list.wishlist = list.wishlist.filter((id) => String(id) !== productId);
  await saveShoppingList(list);
  const responseData = await wishlistData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
import { wishlistData } from "../utils/shopping.js";
