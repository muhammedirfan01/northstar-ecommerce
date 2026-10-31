// Older products use the colour/memory/storage fields. Keep them working while
// new products use editable option names such as Size, Capacity or Processor.
export function variantOptions(variant) {
  if (variant.options?.length)
    return variant.options.map((option) => ({
      name: option.name,
      value: option.value,
    }));
  const options = [];
  if (variant.colorName)
    options.push({ name: "Colour", value: variant.colorName });
  if (variant.memory) options.push({ name: "RAM", value: variant.memory });
  if (variant.storage)
    options.push({ name: "Storage", value: variant.storage });
  return options;
}
export function optionName(value) {
  const name = value.trim().toLowerCase();
  if (name === "color" || name === "colour") return "colour";
  if (name === "memory" || name === "ram") return "ram";
  return name;
}
export function defaultVariant(product) {
  const available = product.variants.filter(
    (variant) => variant.isListed && variant.stock > 0,
  );
  return (
    available.find(
      (variant) => String(variant._id) === String(product.defaultVariantId),
    ) ||
    available[0] ||
    null
  );
}
