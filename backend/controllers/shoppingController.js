import {
  loadShoppingList,
  saveShoppingList,
  cartData,
  wishlistData,
  describeCartItem,
} from "../utils/shopping.js";
import { defaultVariant } from "../utils/variantSelection.js";
import Product from "../models/Product.js";
import { httpError } from "../utils/httpError.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
export async function getCart(req, res) {
  const userId = req.user.id;
  const responseData = await cartData(await loadShoppingList(userId));
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function addToCart(req, res) {
  const userId = req.user.id;
  let input = req.shoppingInput;
  const list = await loadShoppingList(userId);
  const product = await Product.findById(input.productId).populate(
    categoryPopulation,
  );
  if (!productIsAvailable(product)) {
    throw httpError("This product is unavailable.", 409);
  }
  if (product.variants.length && !input.variantId) {
    const selected = defaultVariant(product);
    if (!selected) {
      throw httpError("This product is unavailable.", 409);
    }
    input = {
      ...input,
      variantId: String(selected._id),
    };
  }
  const item = list.cart.find(
    (item) =>
      String(item.productId) === input.productId &&
      String(item.variantId || "") === (input.variantId || ""),
  );
  const quantity = (item?.quantity || 0) + input.quantity;
  const proposed = {
    productId: input.productId,
    variantId: input.variantId,
    quantity,
  };
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
  list.wishlist = list.wishlist.filter((id) => String(id) !== input.productId);
  await saveShoppingList(list);
  const responseData = await cartData(list);
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function setQuantity(req, res) {
  const userId = req.user.id;
  const id = req.params.id;
  const quantity = req.shoppingInput.quantity;
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
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function removeCartItem(req, res) {
  const userId = req.user.id;
  const id = req.params.id;
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) {
    throw httpError("Cart item not found.", 404);
  }
  item.deleteOne();
  await saveShoppingList(list);
  const responseData = await cartData(list);
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function checkout(req, res) {
  const userId = req.user.id;
  const expectedTotalPaise = req.shoppingInput.expectedTotalPaise;
  const cart = await cartData(await loadShoppingList(userId));
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
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function getWishlist(req, res) {
  const userId = req.user.id;
  const responseData = await wishlistData(await loadShoppingList(userId));
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function addWish(req, res) {
  const userId = req.user.id;
  const productId = req.shoppingInput.productId;
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
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function removeWish(req, res) {
  const userId = req.user.id;
  const productId = req.params.id;
  const list = await loadShoppingList(userId);
  list.wishlist = list.wishlist.filter((id) => String(id) !== productId);
  await saveShoppingList(list);
  const responseData = await wishlistData(list);
  return res.json({
    success: true,
    data: responseData,
  });
}
