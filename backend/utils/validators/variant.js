import { validationError } from "../validation.js";
import { variantOptions, optionName } from "../variantSelection.js";
import {
  checkFields,
  readText,
  readBoolean,
  readId,
  checkArray,
} from "../formValidation.js";
import { readPrice, readStock, readImageIds } from "../catalogValidation.js";
export function checkVariantInput(input) {
  checkFields(input, [
    "name",
    "options",
    "isDefault",
    "retainedImageIds",
    "colorName",
    "colorHex",
    "memory",
    "storage",
    "imageId",
    "price",
    "regularPrice",
    "stock",
    "isListed",
  ]);
  const variant = {
    name: readText(input.name, "name", 2, 120),
  };
  if (input.options !== undefined) {
    checkArray(input.options, "options", 5);
    variant.options = [];
    for (const option of input.options) {
      checkFields(option, ["name", "value"], "options");
      variant.options.push({
        name: readText(option.name, "name", 1, 40),
        value: readText(option.value, "value", 1, 80),
      });
    }
  }
  if (input.isDefault !== undefined) {
    variant.isDefault = readBoolean(input.isDefault, "isDefault");
  }
  if (input.retainedImageIds !== undefined) {
    variant.retainedImageIds = readImageIds(
      input.retainedImageIds,
      "Duplicate images.",
    );
  }
  if (input.colorName === undefined) {
    variant.colorName = "";
  } else {
    variant.colorName = readText(input.colorName, "colorName", 0, 40);
  }
  if (input.colorHex === undefined) {
    variant.colorHex = "";
  } else {
    variant.colorHex = input.colorHex;
  }
  if (variant.colorHex !== "") {
    if (typeof variant.colorHex !== "string") {
      throw validationError("Invalid colorHex.", "colorHex");
    }
    if (!/^#[a-f0-9]{6}$/i.test(variant.colorHex)) {
      throw validationError("Choose a valid colour swatch.", "colorHex");
    }
  }
  if (input.memory === undefined) {
    variant.memory = "";
  } else {
    variant.memory = readText(input.memory, "memory", 0, 80);
  }
  if (input.storage === undefined) {
    variant.storage = "";
  } else {
    variant.storage = readText(input.storage, "storage", 0, 80);
  }
  variant.imageId = "";
  if (input.imageId !== undefined && input.imageId !== "") {
    variant.imageId = readId(input.imageId, "imageId");
  }
  variant.price = readPrice(input.price, "price");
  if (input.regularPrice === "") {
    variant.regularPrice = null;
  } else {
    variant.regularPrice = readPrice(input.regularPrice, "regularPrice");
  }
  variant.stock = readStock(input.stock);
  variant.isListed = readBoolean(input.isListed, "isListed");
  if (variant.regularPrice && variant.regularPrice < variant.price) {
    throw validationError(
      "Regular price must be at least the selling price.",
      "form",
    );
  }
  // "Color" and "Colour" are the same option. "Memory" and "RAM" are too.
  const names = variantOptions(variant).map((option) =>
    optionName(option.name),
  );
  const hasColour = names.includes("colour");
  const hasSwatch = Boolean(variant.colorHex);
  if (hasColour !== hasSwatch) {
    throw validationError(
      "Add both a colour option and swatch, or leave both empty.",
      "form",
    );
  }
  if (new Set(names).size !== names.length) {
    throw validationError("Use each option name only once.", "form");
  }
  return variant;
}
