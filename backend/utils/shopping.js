import ShoppingList from "../models/ShoppingList.js";
import Product from "../models/Product.js";
import { publicProduct } from "../utils/product.js";
import { httpError } from "../utils/httpError.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
const MAX_CART_QUANTITY = 5;
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
    _id: {
      $in: list.cart.map((item) => item.productId),
    },
  }).populate(categoryPopulation);
  const items = list.cart.map((item) =>
    describeCartItem(
      item,
      products.find(
        (product) => String(product._id) === String(item.productId),
      ),
    ),
  );
  let quantityTotal = 0;
  let totalPaise = 0;
  for (const item of items) {
    quantityTotal += item.quantity;
    totalPaise += item.subtotalPaise;
  }
  return {
    items,
    quantityTotal: quantityTotal,
    totalPaise: totalPaise,
    canCheckout: items.length > 0 && items.every((item) => item.valid),
  };
}
export async function wishlistData(list) {
  const products = await Product.find({
    _id: {
      $in: list.wishlist,
    },
  }).populate(categoryPopulation);
  return {
    products: list.wishlist.map((id) => {
      const product = products.find(
        (product) => String(product._id) === String(id),
      );
      if (!product) {
        return {
          id: String(id),
          name: "Product unavailable",
          category: null,
          images: [],
          pricePaise: 0,
          variants: [],
          available: false,
        };
      }
      const result = publicProduct(product);
      result.available = productIsAvailable(product);
      result.variants = result.variants.filter(
        (variant) => variant.isListed && variant.stock > 0,
      );
      return result;
    }),
  };
}
