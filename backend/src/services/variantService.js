// Manage product options and check their names, images, prices and stock.

import { getFormData, validateFormFields, validateText, validateBoolean, validateId, validateArray } from "../utils/formValidation.js";
import {
  checkCatalogParams,
  formatAdminProduct,
  categoryDetails,
  getVariantOptions,
  normalizeOptionName,
  updateVariantTotals,
  validatePrice,
  validateStock,
  validateImageIds,
} from "./catalogService.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { createError } from "../utils/httpError.js";
import { uploadCatalogImages, removeCatalogImages } from "./catalogImageService.js";
import { createValidationError } from "../utils/validation.js";

// The controller passes request data here and sends the result back to the browser.

export async function saveVariant(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  requestData.data = validateVariantForm(getFormData(requestData.body), Boolean(requestData.params.variantId));
  const productId = requestData.params.id;
  const variantId = requestData.params.variantId;
  const variantData = requestData.data;
  const files = requestData.files || [];
  const product = await Product.findById(productId);
  if (!product || product.deletedAt) {
    throw createError("Product not found.", 404);
  }
  if (variantId && (product.__v ?? 0) !== variantData.version) {
    throw createError("This product changed while you were editing. Reload and try again.", 409);
  }
  if (!variantId && product.variants.length >= 100) {
    throw createError("A product can have up to 100 variants.");
  }
  if (
    product.variants.some(
      (variant) =>
        String(variant._id) !== variantId &&
        variant.name.toLowerCase() === variantData.name.toLowerCase(),
    )
  ) {
    throw createError("A variant with this name already exists.", 409);
  }
  let variant;
  if (variantId) {
    variant = product.variants.id(variantId);
  } else {
    variant = null;
  }
  if (variantId && !variant) {
    throw createError("Variant not found.", 404);
  }
  validateVariantOptions(product, variantId, variantData);
  if (!variant && variantData.retainedImageIds?.length) {
    throw createError("New variants cannot retain another variant’s images.");
  }
  const previous = variant?.images || [];
  let retained;
  if (variantData.retainedImageIds === undefined) {
    retained = [...previous];
  } else {
    retained = variantData.retainedImageIds.map((id) => previous.id(id));
  }
  if (retained.some((image) => !image)) {
    throw createError(
      "A variant image changed or belongs to another variant. Reload and try again.",
      409,
    );
  }
  if (retained.length + files.length < 3) {
    throw createError("Each variant requires at least three images.");
  }
  if (retained.length + files.length > 6) {
    throw createError("A variant can have up to six images.");
  }
  const options = getVariantOptions(variantData);
  function optionValue(name) {
    const option = options.find((option) => normalizeOptionName(option.name) === name);
    return option?.value || "";
  }
  const uploaded = await uploadCatalogImages(files);
  const details = {
    name: variantData.name,
    options,
    colorName: optionValue("colour"),
    colorHex: variantData.colorHex,
    memory: optionValue("ram"),
    storage: optionValue("storage"),
    imageId: variantData.imageId || null,
    images: [...retained, ...uploaded],
    pricePaise: variantData.price,
    regularPricePaise: variantData.regularPrice,
    stock: variantData.stock,
    isListed: variantData.isListed,
  };
  if (variant) {
    variant.name = details.name;
    variant.options = details.options;
    variant.colorName = details.colorName;
    variant.colorHex = details.colorHex;
    variant.memory = details.memory;
    variant.storage = details.storage;
    variant.imageId = details.imageId;
    variant.images = details.images;
    variant.pricePaise = details.pricePaise;
    variant.regularPricePaise = details.regularPricePaise;
    variant.stock = details.stock;
    variant.isListed = details.isListed;
  } else {
    product.variants.push(details);
    variant = product.variants.at(-1);
  }
  if (variantData.isDefault) {
    product.defaultVariantId = variant._id;
  } else if (
    variantData.isDefault === false &&
    String(product.defaultVariantId) === String(variant._id)
  ) {
    product.defaultVariantId = null;
  }
  updateVariantTotals(product);
  try {
    await product.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    throw error;
  }
  await removeCatalogImages(
    previous.filter(
      (image) =>
        !retained.some((kept) => String(kept._id) === String(image._id)),
    ),
  );
  await product.populate(categoryDetails);
  const responseData = formatAdminProduct(product);
  return {
    status: requestData.params.variantId ? 200 : 201,
    body: {
      success: true,
      data: {
        product: responseData,
      },
    },
  };
}
export async function deleteVariant(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const productId = requestData.params.id;
  const variantId = requestData.params.variantId;
  const product = await Product.findById(productId);
  if (!product || product.deletedAt) {
    throw createError("Product not found.", 404);
  }
  const variant = product.variants.id(variantId);
  if (!variant) {
    throw createError("Variant not found.", 404);
  }
  const purchased = await Order.exists({
    items: { $elemMatch: { productId, variantId } },
  });
  if (purchased) {
    throw createError("This variant is used in an order. Unlist it instead so cancellations and returns can restore its stock.", 409);
  }
  const images = [...variant.images];
  variant.deleteOne();
  if (String(product.defaultVariantId) === variantId) {
    product.defaultVariantId = null;
  }
  updateVariantTotals(product);
  await product.save();
  await removeCatalogImages(images);
  await product.populate(categoryDetails);
  const responseData = formatAdminProduct(product);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        product: responseData,
      },
    },
  };
}

export function validateVariantForm(formData, editing = false) {
  validateFormFields(formData, [
    "version",
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
    name: validateText(formData.name, "name", 2, 120),
  };
  if (formData.options !== undefined) {
    validateArray(formData.options, "options", 5);
    variant.options = [];
    for (const option of formData.options) {
      validateFormFields(option, ["name", "value"], "options");
      variant.options.push({
        name: validateText(option.name, "name", 1, 40),
        value: validateText(option.value, "value", 1, 80),
      });
    }
  }
  if (formData.isDefault !== undefined) {
    variant.isDefault = validateBoolean(formData.isDefault, "isDefault");
  }
  if (formData.retainedImageIds !== undefined) {
    variant.retainedImageIds = validateImageIds(
      formData.retainedImageIds,
      "Duplicate images.",
    );
  }
  if (formData.colorName === undefined) {
    variant.colorName = "";
  } else {
    variant.colorName = validateText(formData.colorName, "colorName", 0, 40);
  }
  if (formData.colorHex === undefined) {
    variant.colorHex = "";
  } else {
    variant.colorHex = formData.colorHex;
  }
  if (variant.colorHex !== "") {
    if (typeof variant.colorHex !== "string") {
      throw createValidationError("Invalid colorHex.", "colorHex");
    }
    if (!/^#[a-f0-9]{6}$/i.test(variant.colorHex)) {
      throw createValidationError("Choose a valid colour swatch.", "colorHex");
    }
  }
  if (formData.memory === undefined) {
    variant.memory = "";
  } else {
    variant.memory = validateText(formData.memory, "memory", 0, 80);
  }
  if (formData.storage === undefined) {
    variant.storage = "";
  } else {
    variant.storage = validateText(formData.storage, "storage", 0, 80);
  }
  variant.imageId = "";
  if (formData.imageId !== undefined && formData.imageId !== "") {
    variant.imageId = validateId(formData.imageId, "imageId");
  }
  variant.price = validatePrice(formData.price, "price");
  if (formData.regularPrice === "") {
    variant.regularPrice = null;
  } else {
    variant.regularPrice = validatePrice(formData.regularPrice, "regularPrice");
  }
  variant.stock = validateStock(formData.stock);
  variant.isListed = validateBoolean(formData.isListed, "isListed");
  if (variant.regularPrice && variant.regularPrice < variant.price) {
    throw createValidationError(
      "Regular price must be at least the selling price.",
      "form",
    );
  }
  // "Color" and "Colour" are the same option. "Memory" and "RAM" are too.
  const names = getVariantOptions(variant).map((option) =>
    normalizeOptionName(option.name),
  );
  const hasColour = names.includes("colour");
  const hasSwatch = Boolean(variant.colorHex);
  if (hasColour !== hasSwatch) {
    throw createValidationError(
      "Add both a colour option and swatch, or leave both empty.",
      "form",
    );
  }
  if (new Set(names).size !== names.length) {
    throw createValidationError("Use each option name only once.", "form");
  }
  if (editing) {
    if (!Number.isSafeInteger(formData.version) || formData.version < 0) {
      throw createValidationError("Reload the product before saving changes.", "version");
    }
    variant.version = formData.version;
  }
  return variant;
}

function cleanOptionText(value) {
  return (value || "").trim().toLowerCase();
}

// Sorting makes Size=Large + Colour=Black match the same options in reverse order.
function getOptionKey(options) {
  const parts = [];
  for (const option of options) {
    parts.push(`${normalizeOptionName(option.name)}:${cleanOptionText(option.value)}`);
  }
  return parts.sort().join("|");
}

function getColourValue(options) {
  const colour = options.find((option) => normalizeOptionName(option.name) === "colour");
  return cleanOptionText(colour?.value);
}

export function validateVariantOptions(product, variantId, variantData) {
  if (variantData.imageId && !product.images.id(variantData.imageId)) {
    throw createError("Choose an image from this product's gallery.");
  }
  const options = getVariantOptions(variantData);
  if (!options.length) {
    return;
  }
  const others = product.variants.filter(
    (variant) => String(variant._id) !== variantId,
  );
  if (
    others.some(
      (variant) =>
        getOptionKey(getVariantOptions(variant)) === getOptionKey(options),
    )
  ) {
    throw createError("This option combination already exists.", 409);
  }
  const hasColour = options.some(
    (option) => normalizeOptionName(option.name) === "colour",
  );
  if (hasColour) {
    for (const variant of others) {
      const sameColour =
        getColourValue(getVariantOptions(variant)) === getColourValue(options);
      const sameSwatch =
        cleanOptionText(variant.colorHex) === cleanOptionText(variantData.colorHex);
      if (sameColour && !sameSwatch) {
        throw createError(
          "Use the same swatch for variants with the same colour name.",
        );
      }
    }
  }
}
