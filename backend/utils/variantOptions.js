import { httpError } from "./httpError.js";
import { variantOptions, optionName } from "./variantSelection.js";

function normalized(value) {
  return (value || "").trim().toLowerCase();
}

// Sorting makes Size=Large + Colour=Black match the same options in reverse order.
function optionSignature(options) {
  const parts = [];
  for (const option of options) {
    parts.push(`${optionName(option.name)}:${normalized(option.value)}`);
  }
  return parts.sort().join("|");
}

function colourValue(options) {
  const colour = options.find((option) => optionName(option.name) === "colour");
  return normalized(colour?.value);
}

export function validateVariantOptions(product, variantId, input) {
  if (input.imageId && !product.images.id(input.imageId)) {
    throw httpError("Choose an image from this product's gallery.");
  }
  const options = variantOptions(input);
  if (!options.length) {
    return;
  }
  const others = product.variants.filter(
    (variant) => String(variant._id) !== variantId,
  );
  if (
    others.some(
      (variant) =>
        optionSignature(variantOptions(variant)) === optionSignature(options),
    )
  ) {
    throw httpError("This option combination already exists.", 409);
  }
  const hasColour = options.some(
    (option) => optionName(option.name) === "colour",
  );
  if (hasColour) {
    for (const variant of others) {
      const sameColour =
        colourValue(variantOptions(variant)) === colourValue(options);
      const sameSwatch =
        normalized(variant.colorHex) === normalized(input.colorHex);
      if (sameColour && !sameSwatch) {
        throw httpError(
          "Use the same swatch for variants with the same colour name.",
        );
      }
    }
  }
}
