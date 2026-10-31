import ShoppingList from "../models/ShoppingList.js";
import { defaultVariant } from "../utils/variantSelection.js";
import Product from "../models/Product.js";
import { publicProduct } from "./productService.js";
import { serviceError } from "../utils/serviceError.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
export { productIsAvailable } from "../utils/productAvailability.js";

export const MAX_CART_QUANTITY = 5;
export async function loadShoppingList(userId) {
  return (
    (await ShoppingList.findOne({ userId })) || new ShoppingList({ userId })
  );
}
async function saveShoppingList(list) {
  try {
    await list.save();
  } catch (error) {
    if (error.code === 11000)
      throw serviceError(
        "Your shopping list changed. Refresh and try again.",
        409,
      );
    throw error;
  }
}

// Prices and stock always come from Product, not a price supplied by the browser or cart.
export function describeCartItem(item, product) {
  const variant = product?.variants.id(item.variantId);
  let available = productIsAvailable(product);
  let error = "";
  if (!available) error = "This product is unavailable.";
  if (
    available &&
    product.variants.length &&
    (!variant || !variant.isListed || variant.stock <= 0)
  ) {
    available = false;
    error = "This variant is unavailable. Remove it and choose another option.";
  }
  if (available && !product.variants.length && item.variantId) {
    available = false;
    error =
      "This variant no longer exists. Remove it and add the product again.";
  }
  const stock = variant ? variant.stock : product?.stock || 0;
  const maxQuantity = available ? Math.min(stock, MAX_CART_QUANTITY) : 0;
  if (available && item.quantity > maxQuantity)
    error = `Only ${maxQuantity} units can be ordered for this option.`;
  const price = variant ? variant.pricePaise : product?.pricePaise || 0;
  return {
    id: String(item._id),
    productId: String(item.productId),
    variantId: item.variantId ? String(item.variantId) : null,
    name: product?.name || "Product unavailable",
    variantName: variant?.name || "",
    image:
      variant?.images?.[0]?.url ||
      product?.images.find(
        (image) => String(image._id) === String(variant?.imageId),
      )?.url ||
      product?.images[0]?.url ||
      "",
    quantity: item.quantity,
    unitPricePaise: price,
    regularPricePaise: variant
      ? variant.regularPricePaise
      : product?.regularPricePaise || null,
    subtotalPaise: price * item.quantity,
    maxQuantity,
    available,
    valid: available && !error,
    error: error || null,
  };
}
export async function cartData(list) {
  const products = await Product.find({
    _id: { $in: list.cart.map((item) => item.productId) },
  }).populate(categoryPopulation);
  const items = list.cart.map((item) =>
    describeCartItem(
      item,
      products.find(
        (product) => String(product._id) === String(item.productId),
      ),
    ),
  );
  return {
    items,
    quantityTotal: items.reduce((total, item) => total + item.quantity, 0),
    totalPaise: items.reduce((total, item) => total + item.subtotalPaise, 0),
    canCheckout: items.length > 0 && items.every((item) => item.valid),
  };
}
export async function getCart(userId) {
  return cartData(await loadShoppingList(userId));
}
export async function addToCart(userId, input) {
  const list = await loadShoppingList(userId);
  const product = await Product.findById(input.productId).populate(
    categoryPopulation,
  );
  if (!productIsAvailable(product))
    throw serviceError("This product is unavailable.", 409);
  if (product.variants.length && !input.variantId) {
    const selected = defaultVariant(product);
    if (!selected) throw serviceError("This product is unavailable.", 409);
    input = { ...input, variantId: String(selected._id) };
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
  if (!checked.valid) throw serviceError(checked.error, 409);
  if (item) item.quantity = quantity;
  else {
    if (list.cart.length >= 50)
      throw serviceError("Your cart can contain up to 50 product options.");
    list.cart.push(proposed);
  }
  list.wishlist = list.wishlist.filter((id) => String(id) !== input.productId);
  await saveShoppingList(list);
  return cartData(list);
}
export async function setCartQuantity(userId, id, quantity) {
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) throw serviceError("Cart item not found.", 404);
  const product = await Product.findById(item.productId).populate(
    categoryPopulation,
  );
  const checked = describeCartItem({ ...item.toObject(), quantity }, product);
  if (!checked.valid) throw serviceError(checked.error, 409);
  item.quantity = quantity;
  await saveShoppingList(list);
  return cartData(list);
}
export async function removeCartItem(userId, id) {
  const list = await loadShoppingList(userId);
  const item = list.cart.id(id);
  if (!item) throw serviceError("Cart item not found.", 404);
  item.deleteOne();
  await saveShoppingList(list);
  return cartData(list);
}
export async function validateCheckout(userId, expectedTotalPaise) {
  const cart = await getCart(userId);
  if (!cart.items.length) throw serviceError("Your cart is empty.", 400, cart);
  if (!cart.canCheckout)
    throw serviceError(
      "Some items are unavailable or their quantities exceed current stock. Review your cart.",
      409,
      cart,
    );
  if (cart.totalPaise !== expectedTotalPaise)
    throw serviceError(
      "Prices changed since you reviewed your cart. Return to the cart to review the current total.",
      409,
      cart,
    );
  return cart;
}
export async function wishlistData(list) {
  const products = await Product.find({ _id: { $in: list.wishlist } }).populate(
    categoryPopulation,
  );
  return {
    products: list.wishlist.map((id) => {
      const product = products.find(
        (product) => String(product._id) === String(id),
      );
      if (!product)
        return {
          id: String(id),
          name: "Product unavailable",
          category: null,
          images: [],
          pricePaise: 0,
          variants: [],
          available: false,
        };
      const result = publicProduct(product);
      result.available = productIsAvailable(product);
      result.variants = result.variants.filter(
        (variant) => variant.isListed && variant.stock > 0,
      );
      return result;
    }),
  };
}
export async function getWishlist(userId) {
  return wishlistData(await loadShoppingList(userId));
}
export async function addWish(userId, productId) {
  const product =
    await Product.findById(productId).populate(categoryPopulation);
  if (!productIsAvailable(product))
    throw serviceError("This product is unavailable.", 409);
  const list = await loadShoppingList(userId);
  if (!list.wishlist.some((id) => String(id) === productId)) {
    if (list.wishlist.length >= 100)
      throw serviceError("Your wishlist can contain up to 100 products.");
    list.wishlist.unshift(productId);
    await saveShoppingList(list);
  }
  return wishlistData(list);
}
export async function removeWish(userId, productId) {
  const list = await loadShoppingList(userId);
  list.wishlist = list.wishlist.filter((id) => String(id) !== productId);
  await saveShoppingList(list);
  return wishlistData(list);
}
