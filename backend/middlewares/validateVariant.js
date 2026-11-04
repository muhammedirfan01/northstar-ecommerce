import { validationError } from "../utils/validation.js";
import { variantOptions, optionName } from "../utils/variantSelection.js";
export function checkVariantInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      ![
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
      ].includes(field)
    ) {
      throw validationError("Unknown form field.", "form");
    }
  }
  const original = input;
  input = {};
  let name = original.name;
  if (typeof name !== "string") {
    throw validationError("Invalid name.", "name");
  }
  name = name.trim();
  if (name.length < 2) {
    throw validationError("Invalid name.", "name");
  }
  if (name.length > 120) {
    throw validationError("Invalid name.", "name");
  }
  input.name = name;
  let options = original.options;
  if (options !== undefined) {
    if (!Array.isArray(options)) {
      throw validationError("Invalid options.", "options");
    }
    options = [...options];
    for (let index = 0; index < options.length; index++) {
      let item = options[index];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw validationError("Invalid options.", "options");
      }
      for (const field of Object.keys(item)) {
        if (!["name", "value"].includes(field)) {
          throw validationError("Unknown form field.", "options");
        }
      }
      const original5 = item;
      item = {};
      let name6 = original5.name;
      if (typeof name6 !== "string") {
        throw validationError("Invalid name.", "name");
      }
      name6 = name6.trim();
      if (name6.length < 1) {
        throw validationError("Invalid name.", "name");
      }
      if (name6.length > 40) {
        throw validationError("Invalid name.", "name");
      }
      item.name = name6;
      let value = original5.value;
      if (typeof value !== "string") {
        throw validationError("Invalid value.", "value");
      }
      value = value.trim();
      if (value.length < 1) {
        throw validationError("Invalid value.", "value");
      }
      if (value.length > 80) {
        throw validationError("Invalid value.", "value");
      }
      item.value = value;
      options[index] = item;
    }
    if (options.length > 5) {
      throw validationError("Invalid options.", "options");
    }
  }
  if (options !== undefined) {
    input.options = options;
  }
  const isDefault = original.isDefault;
  if (isDefault !== undefined) {
    if (typeof isDefault !== "boolean") {
      throw validationError("Invalid isDefault.", "isDefault");
    }
  }
  if (isDefault !== undefined) {
    input.isDefault = isDefault;
  }
  let retainedImageIds = original.retainedImageIds;
  if (retainedImageIds !== undefined) {
    if (!Array.isArray(retainedImageIds)) {
      throw validationError("Invalid retainedImageIds.", "retainedImageIds");
    }
    retainedImageIds = [...retainedImageIds];
    for (let index = 0; index < retainedImageIds.length; index++) {
      const item = retainedImageIds[index];
      if (typeof item !== "string") {
        throw validationError("Invalid retainedImageIds.", "retainedImageIds");
      }
      if (!/^[a-f0-9]{24}$/i.test(item)) {
        throw validationError("Invalid catalog ID.", "retainedImageIds");
      }
      retainedImageIds[index] = item;
    }
    if (retainedImageIds.length > 6) {
      throw validationError("Invalid retainedImageIds.", "retainedImageIds");
    }
    if (!(new Set(retainedImageIds).size === retainedImageIds.length)) {
      throw validationError("Duplicate images.", "retainedImageIds");
    }
  }
  if (retainedImageIds !== undefined) {
    input.retainedImageIds = retainedImageIds;
  }
  let colorName = original.colorName;
  if (colorName === undefined) {
    colorName = "";
  } else {
    if (typeof colorName !== "string") {
      throw validationError("Invalid colorName.", "colorName");
    }
    colorName = colorName.trim();
    if (colorName.length > 40) {
      throw validationError("Invalid colorName.", "colorName");
    }
  }
  if (colorName !== undefined) {
    input.colorName = colorName;
  }
  let colorHex = original.colorHex;
  if (colorHex === undefined) {
    colorHex = "";
  } else {
    if (!(colorHex === "")) {
      if (typeof colorHex !== "string") {
        throw validationError("Invalid colorHex.", "colorHex");
      }
      if (!/^#[a-f0-9]{6}$/i.test(colorHex)) {
        throw validationError("Choose a valid colour swatch.", "colorHex");
      }
    }
  }
  if (colorHex !== undefined) {
    input.colorHex = colorHex;
  }
  let memory = original.memory;
  if (memory === undefined) {
    memory = "";
  } else {
    if (typeof memory !== "string") {
      throw validationError("Invalid memory.", "memory");
    }
    memory = memory.trim();
    if (memory.length > 80) {
      throw validationError("Invalid memory.", "memory");
    }
  }
  if (memory !== undefined) {
    input.memory = memory;
  }
  let storage = original.storage;
  if (storage === undefined) {
    storage = "";
  } else {
    if (typeof storage !== "string") {
      throw validationError("Invalid storage.", "storage");
    }
    storage = storage.trim();
    if (storage.length > 80) {
      throw validationError("Invalid storage.", "storage");
    }
  }
  if (storage !== undefined) {
    input.storage = storage;
  }
  let imageId = original.imageId;
  if (imageId === undefined) {
    imageId = "";
  } else {
    if (!(imageId === "")) {
      if (typeof imageId !== "string") {
        throw validationError("Invalid imageId.", "imageId");
      }
      if (!/^[a-f0-9]{24}$/i.test(imageId)) {
        throw validationError("Invalid catalog ID.", "imageId");
      }
    }
  }
  if (imageId !== undefined) {
    input.imageId = imageId;
  }
  let price = original.price;
  if (typeof price !== "string") {
    throw validationError("Invalid price.", "price");
  }
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(price)) {
    throw validationError(
      "Enter a valid price with at most 2 decimal places.",
      "price",
    );
  }
  price = Math.round(Number(price) * 100);
  if (!(price > 0)) {
    throw validationError("Price must be greater than zero.", "price");
  }
  input.price = price;
  let regularPrice = original.regularPrice;
  if (regularPrice === "") {
    regularPrice = null;
  } else {
    if (typeof regularPrice !== "string") {
      throw validationError("Invalid regularPrice.", "regularPrice");
    }
    if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(regularPrice)) {
      throw validationError(
        "Enter a valid price with at most 2 decimal places.",
        "regularPrice",
      );
    }
    regularPrice = Math.round(Number(regularPrice) * 100);
    if (!(regularPrice > 0)) {
      throw validationError("Price must be greater than zero.", "regularPrice");
    }
  }
  if (regularPrice !== undefined) {
    input.regularPrice = regularPrice;
  }
  let stock = original.stock;
  if (typeof stock !== "string") {
    throw validationError("Invalid stock.", "stock");
  }
  if (!/^\d{1,7}$/.test(stock)) {
    throw validationError("Stock must be a whole number.", "stock");
  }
  stock = Number(stock);
  if (!(stock <= 1000000)) {
    throw validationError("Stock cannot exceed 1,000,000.", "stock");
  }
  input.stock = stock;
  const isListed = original.isListed;
  if (typeof isListed !== "boolean") {
    throw validationError("Invalid isListed.", "isListed");
  }
  input.isListed = isListed;
  if (!(!input.regularPrice || input.regularPrice >= input.price)) {
    throw validationError(
      "Regular price must be at least the selling price.",
      "form",
    );
  }
  if (
    !(
      Boolean(
        variantOptions(input).find(
          (option) => optionName(option.name) === "colour",
        ),
      ) === Boolean(input.colorHex)
    )
  ) {
    throw validationError(
      "Add both a colour option and swatch, or leave both empty.",
      "form",
    );
  }
  {
    const names = variantOptions(input).map((option) =>
      optionName(option.name),
    );
    if (!(new Set(names).size === names.length)) {
      throw validationError("Use each option name only once.", "form");
    }
  }
  return input;
}
export default function validateVariant(req, res, next) {
  try {
    let input = req.body;
    if (typeof req.body?.data === "string") {
      input = JSON.parse(req.body.data);
    }
    const checked = checkVariantInput(input);
    req.catalogInput = checked;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof SyntaxError ? "Invalid form data." : error.message,
    });
  }
  next();
}
