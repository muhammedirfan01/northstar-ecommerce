import { variantOptions, defaultVariant } from "./variantSelection.js";

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
    options: variantOptions(variant),
    images: formatImages(variant.images || []),
    pricePaise: variant.pricePaise,
    regularPricePaise: variant.regularPricePaise,
    stock: variant.stock,
    isListed: variant.isListed,
  };
}

// Explicit response fields keep password/storage/internal fields out of the API.
export function publicProduct(product) {
  const selected = defaultVariant(product);
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
  let selected = defaultVariant(product);
  if (!selected) selected = listed[0];
  if (!selected) selected = product.variants[0];
  if (selected) {
    product.pricePaise = selected.pricePaise;
    product.regularPricePaise = selected.regularPricePaise;
  }
}
