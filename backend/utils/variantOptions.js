import { serviceError } from "./serviceError.js";
import { variantOptions, optionName } from "./variantSelection.js";

function normalized(value) {
  return (value || "").trim().toLowerCase();
}
export function validateVariantOptions(product, variantId, input) {
  if (input.imageId && !product.images.id(input.imageId))
    throw serviceError("Choose an image from this product's gallery.");
  const options = variantOptions(input);
  if (!options.length) return;
  const signature = (values) =>
    values
      .map((option) => `${optionName(option.name)}:${normalized(option.value)}`)
      .sort()
      .join("|");
  const others = product.variants.filter(
    (variant) => String(variant._id) !== variantId,
  );
  if (
    others.some(
      (variant) => signature(variantOptions(variant)) === signature(options),
    )
  )
    throw serviceError("This option combination already exists.", 409);
  if (
    options.some((option) => optionName(option.name) === "colour") &&
    others.some(
      (variant) =>
        normalized(
          variantOptions(variant).find(
            (option) => optionName(option.name) === "colour",
          )?.value,
        ) ===
          normalized(
            options.find((option) => optionName(option.name) === "colour")
              ?.value,
          ) && normalized(variant.colorHex) !== normalized(input.colorHex),
    )
  )
    throw serviceError(
      "Use the same swatch for variants with the same colour name.",
    );
}
