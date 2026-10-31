export function variantConfiguration(variant) {
  return (
    variantOptions(variant)
      .map((option) => option.value)
      .join(" / ") || variant.name
  );
}

export function variantOptions(variant) {
  if (!variant) return [];
  if (variant.options?.length) return variant.options;
  const options = [];
  if (variant.colorName)
    options.push({ name: "Colour", value: variant.colorName });
  if (variant.memory) options.push({ name: "RAM", value: variant.memory });
  if (variant.storage)
    options.push({ name: "Storage", value: variant.storage });
  return options;
}
export function optionKey(name) {
  const key = name.trim().toLowerCase();
  if (key === "color" || key === "colour") return "colour";
  if (key === "memory" || key === "ram") return "ram";
  return key;
}
export function selectedVariant(product) {
  const available = product.variants.filter(
    (variant) => variant.isListed && variant.stock > 0,
  );
  return (
    available.find((variant) => variant.id === product.defaultVariantId) ||
    available[0] ||
    null
  );
}
export function variantImage(product, variant) {
  return (
    variant?.images?.[0]?.url ||
    product.images.find((image) => image.id === variant?.imageId)?.url ||
    product.images[0]?.url ||
    "/favicon.png"
  );
}
