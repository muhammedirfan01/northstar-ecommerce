import ShoppingList from "../models/ShoppingList.js";
import Product from "../models/Product.js";
import { publicProduct } from "../utils/product.js";
import { httpError } from "../utils/httpError.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";

const MAX_CART_QUANTITY = 9;
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
      throw httpError(
        "Your shopping list changed. Refresh and try again.",
        409,
      );
    }
    throw error;
  }
}

function cartImage(product, variant) {
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
export function describeCartItem(item, product) {
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
    error = `Only ${maxQuantity} units can be added for this option.`;
  }
  let price;
  if (variant) {
    price = variant.pricePaise;
  } else {
    price = product?.pricePaise || 0;
  }
  return {
    id: String(item._id),
    productId: String(item.productId),
    variantId: item.variantId ? String(item.variantId) : null,
    name: product?.name || "Product unavailable",
    variantName: variant?.name || "",
    image: cartImage(product, variant),
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
    _id: {
      $in: list.cart.map((item) => item.productId),
    },
  }).populate(categoryPopulation);
  // Match each saved cart line to its current product before calculating totals.
  const items = [];
  for (const item of list.cart) {
    const product = products.find(
      (product) => String(product._id) === String(item.productId),
    );
    items.push(describeCartItem(item, product));
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

export async function wishlistData(list) {
  const products = await Product.find({
    _id: {
      $in: list.wishlist,
    },
  }).populate(categoryPopulation);
  const results = [];
  for (const id of list.wishlist) {
    const product = products.find(
      (product) => String(product._id) === String(id),
    );
    if (!product) {
      // Keep a removable placeholder if the original product no longer exists.
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
    const result = publicProduct(product);
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
