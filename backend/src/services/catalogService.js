// Share product checks, display details, option selection and offer calculations.

import { createValidationError } from "../utils/validation.js";
import {
  validateArray,
  validateId,
  validateFormFields,
  validateBoolean,
  validateText,
  validateQueryNumber,
  validateChoice,
} from "../utils/formValidation.js";
import { ProductStatus } from "../constants/statuses.js";

// Admin forms send rupees as text: "123.45" becomes 12345 paise.
export function validatePrice(value, fieldName) {
  if (typeof value !== "string") {
    throw createValidationError(`Invalid ${fieldName}.`, fieldName);
  }
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value)) {
    throw createValidationError(
      "Enter a valid price with at most 2 decimal places.",
      fieldName,
    );
  }
  const paise = Math.round(Number(value) * 100);
  if (paise <= 0) {
    throw createValidationError("Price must be greater than zero.", fieldName);
  }
  return paise;
}

export function validateStock(value) {
  if (typeof value !== "string") {
    throw createValidationError("Invalid stock.", "stock");
  }
  if (!/^\d{1,7}$/.test(value)) {
    throw createValidationError("Stock must be a whole number.", "stock");
  }
  const stock = Number(value);
  if (stock > 1000000) {
    throw createValidationError("Stock cannot exceed 1,000,000.", "stock");
  }
  return stock;
}

export function validateImageIds(value, duplicateMessage) {
  const fieldName = "retainedImageIds";
  validateArray(value, fieldName, 6);
  const ids = [];
  for (const id of value) {
    ids.push(validateId(id, fieldName));
  }
  if (new Set(ids).size !== ids.length) {
    throw createValidationError(duplicateMessage, fieldName);
  }
  return ids;
}

// Values from a URL are text. Convert number values before checking their limits.

// Preserve catalog base prices for stock comparisons; only discounts change totals.
// Compare the matching offers and keep the one that saves the most money.
export function findBestOffer(
  product,
  unitPrice,
  quantity,
  offers = [],
  now = new Date(),
) {
  let bestOffer = null,
    bestDiscount = 0;
  for (const offer of offers) {
    if (
      !offer.isActive ||
      +new Date(offer.startDate) > +now ||
      +new Date(offer.expiryDate) <= +now
    )
      continue;
    const matches =
      offer.scope === "all" ||
      (offer.scope === "product" && String(offer.targetId) === String(product._id)) ||
      (offer.scope === "category" &&
        [product.category?._id, product.category?.parent?._id]
          .filter(Boolean)
          .some((id) => String(id) === String(offer.targetId)));
    if (!matches) continue;
    const discountPerItem =
      offer.discountType === "percentage"
        ? Math.floor((unitPrice * offer.discountValue) / 100)
        : offer.discountValue;
    const discount = Math.min(unitPrice, discountPerItem) * quantity;
    if (
      discount > bestDiscount ||
      (discount > 0 && discount === bestDiscount && String(offer._id) < String(bestOffer?._id))
    ) {
      bestOffer = offer;
      bestDiscount = discount;
    }
  }
  return bestOffer
    ? {
        campaignId: bestOffer._id,
        name: bestOffer.name,
        productId: product._id,
        discount: bestDiscount,
        discountType: bestOffer.discountType,
        discountValue: bestOffer.discountValue,
        discountPaise: bestDiscount / quantity,
        quantity,
        variantId: null,
      }
    : null;
}

function formatImages(images) {
  const result = [];
  for (const image of images) {
    result.push({
      id: String(image._id),
      url: image.url,
    });
  }
  return result;
}

function formatCategory(category) {
  if (!category) {
    return {
      id: "",
      name: "Category unavailable",
      isListed: false,
    };
  }
  let parentId = null;
  if (category.parent) {
    parentId = String(category.parent._id || category.parent);
  }
  return {
    id: String(category._id),
    name: category.name,
    isListed: category.isListed && !category.deletedAt,
    parentId,
    parentName: category.parent?.name || "",
  };
}

function formatVariant(variant) {
  let imageId = null;
  if (variant.imageId) imageId = String(variant.imageId);
  return {
    id: String(variant._id),
    name: variant.name,
    colorName: variant.colorName || "",
    colorHex: variant.colorHex || "",
    memory: variant.memory || "",
    storage: variant.storage || "",
    imageId,
    options: getVariantOptions(variant),
    images: formatImages(variant.images || []),
    pricePaise: variant.pricePaise,
    regularPricePaise: variant.regularPricePaise,
    stock: variant.stock,
    isListed: variant.isListed,
  };
}

// Choose the product details the frontend needs. Leave database-only details out.
export function formatAdminProduct(product) {
  const selected = getDefaultVariant(product);
  let pricePaise = product.pricePaise;
  let regularPricePaise = product.regularPricePaise;
  if (selected) {
    if (selected.pricePaise !== null && selected.pricePaise !== undefined) {
      pricePaise = selected.pricePaise;
    }
    regularPricePaise = selected.regularPricePaise;
  }
  let defaultVariantId = null;
  if (product.defaultVariantId)
    defaultVariantId = String(product.defaultVariantId);
  const variants = [];
  for (const variant of product.variants) variants.push(formatVariant(variant));
  const quickSpecs = [];
  for (const spec of product.quickSpecs || []) {
    quickSpecs.push({
      label: spec.label,
      value: spec.value,
      note: spec.note,
    });
  }
  return {
    id: String(product._id),
    version: product.__v ?? 0,
    deletedAt: product.deletedAt || null,
    name: product.name,
    description: product.description,
    series: product.series || "",
    subtitle: product.subtitle || "",
    badge: product.badge || "",
    priceNote: product.priceNote || "",
    quickSpecs,
    category: formatCategory(product.category),
    images: formatImages(product.images),
    pricePaise,
    regularPricePaise,
    stock: product.stock,
    isPublished: product.isPublished,
    isListed: product.isListed,
    highlights: product.highlights,
    specifications: product.specifications,
    defaultVariantId,
    variants,
    createdAt: product.createdAt,
  };
}

export function updateVariantTotals(product) {
  const listed = [];
  product.stock = 0;
  for (const variant of product.variants) {
    if (variant.isListed) {
      listed.push(variant);
      product.stock += variant.stock;
    }
  }
  let selected = getDefaultVariant(product);
  if (!selected) selected = listed[0];
  if (!selected) selected = product.variants[0];
  if (selected) {
    product.pricePaise = selected.pricePaise;
    product.regularPricePaise = selected.regularPricePaise;
  }
}

// Customer prices use checkout's per-unit campaign calculation. Admin prices stay unchanged.
export function formatStoreProduct(product, offers = [], now = new Date()) {
  const productDetails = formatAdminProduct(product);
  function pricing(option) {
    const offer = findBestOffer(product, option.pricePaise, 1, offers, now);
    if (!offer) return option;
    return {
      ...option,
      basePricePaise: option.pricePaise,
      pricePaise: option.pricePaise - offer.discount,
      regularPricePaise: Math.max(option.regularPricePaise || 0, option.pricePaise),
      offer: { id: String(offer.campaignId), name: offer.name, discountType: offer.discountType, discountValue: offer.discountValue, discountPaise: offer.discount },
    };
  }
  return {
    ...pricing(productDetails),
    variants: productDetails.variants.filter((variant) => variant.isListed).map(pricing),
  };
}

export function productIsAvailable(product) {
  // Check the product, then its category, then the category's parent.
  if (!product || product.deletedAt) {
    return false;
  }
  if (!product.isListed || !product.isPublished) {
    return false;
  }
  if (!Number.isFinite(product.stock) || product.stock <= 0) {
    return false;
  }
  const category = product.category;
  if (!category || !category.isListed || category.deletedAt) {
    return false;
  }
  if (
    category.parent &&
    (!category.parent.isListed || category.parent.deletedAt)
  ) {
    return false;
  }
  return true;
}

export const categoryDetails = {
  path: "category",
  populate: {
    path: "parent",
    select: "name isListed deletedAt",
  },
};

export function checkCatalogStatus(formData) {
  validateFormFields(formData, ["isListed"]);
  return {
    isListed: validateBoolean(formData.isListed, "isListed"),
  };
}
export function checkCatalogQuery(searchOptions) {
  validateFormFields(searchOptions, [
    "search",
    "page",
    "limit",
    "status",
    "category",
    "options",
    "sort",
  ]);
  const query = {};
  if (searchOptions.search === undefined) {
    query.search = "";
  } else {
    query.search = validateText(searchOptions.search, "search", 0, 100);
  }
  if (searchOptions.page === undefined) {
    query.page = 1;
  } else {
    query.page = validateQueryNumber(searchOptions.page, "page", 1, 10000, true);
  }
  if (searchOptions.limit === undefined) {
    query.limit = 10;
  } else {
    query.limit = validateQueryNumber(searchOptions.limit, "limit", 1, 50, true);
  }
  query.status = validateChoice(
    searchOptions.status === undefined ? ProductStatus.ALL : searchOptions.status,
    "status",
    Object.values(ProductStatus),
  );
  query.sort = validateChoice(searchOptions.sort ?? "latest", "sort", ["latest", "status-asc", "status-desc"]);
  query.category = "";
  if (searchOptions.category !== undefined && searchOptions.category !== "") {
    query.category = validateId(searchOptions.category, "category");
  }
  if (searchOptions.options !== undefined) {
    query.options = validateChoice(searchOptions.options, "options", ["true", "false"]);
  }
  return query;
}

export function checkCatalogParams(params) {
  const id = params?.id;
  const variantId = params?.variantId;
  if (
    !/^[a-f0-9]{24}$/i.test(id) ||
    (variantId && !/^[a-f0-9]{24}$/i.test(variantId))
  ) {
    throw createValidationError("Invalid catalog ID.", "form");
  }
  const result = { ...params, id: id.toLowerCase() };
  if (variantId) result.variantId = variantId.toLowerCase();
  return result;
}

// Older products use the colour/memory/storage fields. Keep them working while
// new products use editable option names such as Size, Capacity or Processor.
export function getVariantOptions(variant) {
  if (variant.options?.length) {
    return variant.options.map((option) => ({
      name: option.name,
      value: option.value,
    }));
  }
  const options = [];
  if (variant.colorName) {
    options.push({
      name: "Colour",
      value: variant.colorName,
    });
  }
  if (variant.memory) {
    options.push({
      name: "RAM",
      value: variant.memory,
    });
  }
  if (variant.storage) {
    options.push({
      name: "Storage",
      value: variant.storage,
    });
  }
  return options;
}

export function normalizeOptionName(value) {
  const name = value.trim().toLowerCase();
  if (name === "color" || name === "colour") {
    return "colour";
  }
  if (name === "memory" || name === "ram") {
    return "ram";
  }
  return name;
}

export function getDefaultVariant(product) {
  const available = product.variants.filter(
    (variant) => variant.isListed && variant.stock > 0,
  );
  // Prefer the admin's default only while it is listed and in stock.
  const selected = available.find(
    (variant) => String(variant._id) === String(product.defaultVariantId),
  );
  if (selected) {
    return selected;
  }
  if (available.length > 0) {
    return available[0];
  }
  return null;
}
