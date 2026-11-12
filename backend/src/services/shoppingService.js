// Load cart and wishlist details using current products, stock and prices.

import ShoppingList from "../models/ShoppingList.js";
import Product from "../models/Product.js";
import { getActiveOffers } from "./campaignService.js";
import { findBestOffer, formatStoreProduct, productIsAvailable, categoryDetails } from "./catalogService.js";
import { createError } from "../utils/httpError.js";
import { MAX_CART_QUANTITY } from "../constants/shopping.js";

export async function loadShoppingList(userId) {
  let list = await ShoppingList.findOne({
    userId,
  });
  if (!list) {
    list = new ShoppingList({
      userId,
    });
  }
  return list;
}

export async function saveShoppingList(list) {
  try {
    await list.save();
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        "Your shopping list changed. Refresh and try again.",
        409,
      );
    }
    throw error;
  }
}

function getCartImage(product, variant) {
  if (variant?.images?.[0]?.url) {
    return variant.images[0].url;
  }
  if (!product) {
    return "";
  }
  const selectedImage = product.images.find(
    (image) => String(image._id) === String(variant?.imageId),
  );
  if (selectedImage?.url) {
    return selectedImage.url;
  }
  return product.images[0]?.url || "";
}

// Prices and stock always come from Product, not a price supplied by the browser or cart.
export function getCartItemDetails(item, product, offers = [], now = new Date()) {
  const variant = product?.variants.id(item.variantId);
  let available = productIsAvailable(product);
  let error = "";
  if (!available) {
    error = "This product is unavailable.";
  }
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
  let stock;
  if (variant) {
    stock = variant.stock;
  } else {
    stock = product?.stock || 0;
  }
  let maxQuantity;
  if (available) {
    maxQuantity = Math.min(stock, MAX_CART_QUANTITY);
  } else {
    maxQuantity = 0;
  }
  if (available && item.quantity > maxQuantity) {
    error = stock < MAX_CART_QUANTITY
      ? `Only ${stock} units are available for this option.`
      : `Maximum ${MAX_CART_QUANTITY} units per option, including units already in your cart.`;
  }
  let price;
  if (variant) {
    price = variant.pricePaise;
  } else {
    price = product?.pricePaise || 0;
  }
  const offer = available ? findBestOffer(product, price, 1, offers, now) : null;
  const basePrice = price;
  price -= offer?.discount || 0;
  const regularPrice = variant ? variant.regularPricePaise : product?.regularPricePaise || null;
  return {
    basePricePaise: basePrice,
    offer: offer ? { id: String(offer.campaignId), name: offer.name, discountType: offer.discountType, discountValue: offer.discountValue, discountPaise: offer.discount } : null,
    id: String(item._id),
    productId: String(item.productId),
    variantId: item.variantId ? String(item.variantId) : null,
    name: product?.name || "Product unavailable",
    variantName: variant?.name || "",
    image: getCartImage(product, variant),
    quantity: item.quantity,
    unitPricePaise: price,
    regularPricePaise: offer ? Math.max(regularPrice || 0, basePrice) : regularPrice,
    subtotalPaise: price * item.quantity,
    maxQuantity,
    available,
    valid: available && !error,
    error: error || null,
  };
}

export async function getCartDetails(list) {
  const products = await Product.find({
    _id: {
      $in: list.cart.map((item) => item.productId),
    },
  }).populate(categoryDetails);
  const offers = await getActiveOffers();
  const now = new Date();
  // Match each saved cart line to its current product before calculating totals.
  const items = [];
  for (const item of list.cart) {
    const product = products.find(
      (product) => String(product._id) === String(item.productId),
    );
    items.push(getCartItemDetails(item, product, offers, now));
  }
  let quantityTotal = 0;
  let totalPaise = 0;
  for (const item of items) {
    quantityTotal += item.quantity;
    totalPaise += item.subtotalPaise;
  }
  return {
    items,
    quantityTotal,
    totalPaise,
    canCheckout: items.length > 0 && items.every((item) => item.valid),
  };
}

export async function getWishlistDetails(list) {
  const products = await Product.find({
    _id: {
      $in: list.wishlist,
    },
  }).populate(categoryDetails);
  const offers = await getActiveOffers();
  const now = new Date();
  const results = [];
  for (const id of list.wishlist) {
    const product = products.find(
      (product) => String(product._id) === String(id),
    );
    if (!product) {
      // Keep the cart item visible for removal if its product has been deleted.
      results.push({
        id: String(id),
        name: "Product unavailable",
        category: null,
        images: [],
        pricePaise: 0,
        variants: [],
        available: false,
      });
      continue;
    }
    const result = formatStoreProduct(product, offers, now);
    result.available = productIsAvailable(product);
    result.variants = result.variants.filter(
      (variant) => variant.isListed && variant.stock > 0,
    );
    results.push(result);
  }
  return {
    products: results,
  };
}
