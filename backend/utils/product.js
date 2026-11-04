import { variantOptions, defaultVariant } from "../utils/variantSelection.js";
export function publicProduct(product) {
  const selected = defaultVariant(product);
  return {
    id: String(product._id),
    deletedAt: product.deletedAt || null,
    name: product.name,
    description: product.description,
    series: product.series || "",
    subtitle: product.subtitle || "",
    badge: product.badge || "",
    priceNote: product.priceNote || "",
    quickSpecs: (product.quickSpecs || []).map((spec) => ({
      label: spec.label,
      value: spec.value,
      note: spec.note,
    })),
    category: product.category
      ? {
          id: String(product.category._id),
          name: product.category.name,
          isListed: product.category.isListed && !product.category.deletedAt,
          parentId: product.category.parent
            ? String(product.category.parent._id || product.category.parent)
            : null,
          parentName: product.category.parent?.name || "",
        }
      : {
          id: "",
          name: "Category unavailable",
          isListed: false,
        },
    images: product.images.map((image) => ({
      id: String(image._id),
      url: image.url,
    })),
    pricePaise: selected?.pricePaise ?? product.pricePaise,
    regularPricePaise: selected
      ? selected.regularPricePaise
      : product.regularPricePaise,
    stock: product.stock,
    isPublished: product.isPublished,
    isListed: product.isListed,
    highlights: product.highlights,
    specifications: product.specifications,
    defaultVariantId: product.defaultVariantId
      ? String(product.defaultVariantId)
      : null,
    variants: product.variants.map((variant) => ({
      id: String(variant._id),
      name: variant.name,
      colorName: variant.colorName || "",
      colorHex: variant.colorHex || "",
      memory: variant.memory || "",
      storage: variant.storage || "",
      imageId: variant.imageId ? String(variant.imageId) : null,
      options: variantOptions(variant),
      images: (variant.images || []).map((image) => ({
        id: String(image._id),
        url: image.url,
      })),
      pricePaise: variant.pricePaise,
      regularPricePaise: variant.regularPricePaise,
      stock: variant.stock,
      isListed: variant.isListed,
    })),
    createdAt: product.createdAt,
  };
}
export function updateVariantTotals(product) {
  const listed = product.variants.filter((variant) => variant.isListed);
  product.stock = 0;
  for (const variant of listed) {
    product.stock += variant.stock;
  }
  const selected = defaultVariant(product) || listed[0] || product.variants[0];
  if (selected) {
    product.pricePaise = selected.pricePaise;
    product.regularPricePaise = selected.regularPricePaise;
  }
}
