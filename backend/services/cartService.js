import { checkCatalogParams } from "../utils/validators/catalog.js";
import {
  checkShoppingAdd,
  checkShoppingQuantity,
  checkShoppingCheckout,
} from "../utils/validators/shopping.js";
// Application steps. Input is a plain object; the controller sends the response.
import {
  loadShoppingList,
  saveShoppingList,
  cartData,
  describeCartItem,
} from "../utils/shopping.js";
import { defaultVariant } from "../utils/variantSelection.js";
import Product from "../models/Product.js";
import { httpError } from "../utils/httpError.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
export async function getCart(input) {
  const userId = input.user.id;
  const list = await loadShoppingList(userId);
  const responseData = await cartData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function addToCart(input) {
  input.data = checkShoppingAdd(input.body);
  // 1. Load the customer's list and the current product from MongoDB.
  const userId = input.user.id;
  const data = input.data;
  let variantId = data.variantId;
  const list = await loadShoppingList(userId);
  const product = await Product.findById(data.productId).populate(
    categoryPopulation,
  );
  if (!productIsAvailable(product)) {
    throw httpError("This product is unavailable.", 409);
  }
  if (product.variants.length && !data.variantId) {
    const selected = defaultVariant(product);
    if (!selected) {
      throw httpError("This product is unavailable.", 409);
    }
    variantId = String(selected._id);
  }
  // 2. Adding the same product option increases its existing quantity.
  const item = list.cart.find(
    (item) =>
      String(item.productId) === data.productId &&
      String(item.variantId || "") === (variantId || ""),
  );
  const quantity = (item?.quantity || 0) + data.quantity;
  const proposed = {
    productId: data.productId,
    variantId,
    quantity,
  };
  // 3. Reuse the same stock and quantity checks used when displaying the cart.
  const checked = describeCartItem(proposed, product);
  if (!checked.valid) {
    throw httpError(checked.error, 409);
  }
  if (item) {
    item.quantity = quantity;
  } else {
    if (list.cart.length >= 50) {
      throw httpError("Your cart can contain up to 50 product options.");
    }
    list.cart.push(proposed);
  }
  // 4. Save the cart and remove this product from the wishlist together.
  list.wishlist = list.wishlist.filter((id) => String(id) !== data.productId);
  await saveShoppingList(list);
  const responseData = await cartData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function setQuantity(input) {
  input.params = checkCatalogParams(input.params);
  input.data = checkShoppingQuantity(input.body);
  const userId = input.user.id;
  const id = input.params.id;
  const quantity = input.data.quantity;
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) {
    throw httpError("Cart item not found.", 404);
  }
  const product = await Product.findById(item.productId).populate(
    categoryPopulation,
  );
  const checked = describeCartItem(
    {
      ...item.toObject(),
      quantity,
    },
    product,
  );
  if (!checked.valid) {
    throw httpError(checked.error, 409);
  }
  item.quantity = quantity;
  await saveShoppingList(list);
  const responseData = await cartData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function removeCartItem(input) {
  input.params = checkCatalogParams(input.params);
  const userId = input.user.id;
  const id = input.params.id;
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) {
    throw httpError("Cart item not found.", 404);
  }
  item.deleteOne();
  await saveShoppingList(list);
  const responseData = await cartData(list);
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function checkout(input) {
  input.data = checkShoppingCheckout(input.body);
  const userId = input.user.id;
  const expectedTotalPaise = input.data.expectedTotalPaise;
  // Rebuild the cart using today's database prices and stock before comparing totals.
  const list = await loadShoppingList(userId);
  const cart = await cartData(list);
  if (!cart.items.length) {
    throw httpError("Your cart is empty.", 400, cart);
  }
  if (!cart.canCheckout) {
    throw httpError(
      "Some items are unavailable or their quantities exceed current stock. Review your cart.",
      409,
      cart,
    );
  }
  if (cart.totalPaise !== expectedTotalPaise) {
    throw httpError(
      "Prices changed since you reviewed your cart. Return to the cart to review the current total.",
      409,
      cart,
    );
  }
  const responseData = cart;
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
