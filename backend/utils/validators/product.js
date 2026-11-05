import { validationError } from "../validation.js";
import {
  checkFields,
  readText,
  readBoolean,
  readChoice,
  readId,
  checkArray,
} from "../formValidation.js";
import { readPrice, readStock, readImageIds } from "../catalogValidation.js";
function readQuickSpecs(specs) {
  checkArray(specs, "quickSpecs", 6);
  const result = [];
  for (const spec of specs) {
    checkFields(spec, ["label", "value", "note"], "quickSpecs");
    result.push({
      label: readText(spec.label, "label", 1, 60),
      value: readText(spec.value, "value", 1, 120),
      note: spec.note === undefined ? "" : readText(spec.note, "note", 0, 200),
    });
  }
  return result;
}
function readTextList(values, field, maxTextLength) {
  checkArray(values, field, 20);
  const result = [];
  for (const value of values) {
    result.push(readText(value, field, 1, maxTextLength));
  }
  return result;
}
export function checkProductInput(input) {
  checkFields(input, [
    "name",
    "description",
    "series",
    "subtitle",
    "badge",
    "priceNote",
    "quickSpecs",
    "categoryId",
    "price",
    "regularPrice",
    "stock",
    "isPublished",
    "isListed",
    "highlights",
    "specifications",
    "retainedImageIds",
  ]);

  // Build a separate object: validation must not change the submitted form.
  const product = {};
  product.name = readText(input.name, "name", 2, 160);
  product.description = readText(
    input.description,
    "description",
    10,
    5000,
    "Description must have at least 10 characters.",
  );
  if (input.series === undefined) {
    product.series = "";
  } else {
    product.series = readText(input.series, "series", 0, 80);
  }
  if (input.subtitle === undefined) {
    product.subtitle = "";
  } else {
    product.subtitle = readText(input.subtitle, "subtitle", 0, 240);
  }
  product.badge = readChoice(
    input.badge === undefined ? "" : input.badge,
    "badge",
    ["", "Best seller", "Deal of the day", "Most purchased", "New arrival"],
  );
  if (input.priceNote === undefined) {
    product.priceNote = "";
  } else {
    product.priceNote = readText(input.priceNote, "priceNote", 0, 180);
  }
  product.quickSpecs = readQuickSpecs(
    input.quickSpecs === undefined ? [] : input.quickSpecs,
  );
  product.categoryId = readId(input.categoryId, "categoryId"); // Products with variants manage their price and stock on the variants page.
  if (input.price !== undefined) {
    product.price = readPrice(input.price, "price");
  }
  if (input.regularPrice !== undefined) {
    if (input.regularPrice === "") {
      product.regularPrice = null;
    } else {
      product.regularPrice = readPrice(input.regularPrice, "regularPrice");
    }
  }
  if (input.stock !== undefined) {
    product.stock = readStock(input.stock);
  }
  product.isPublished = readBoolean(input.isPublished, "isPublished");
  product.isListed = readBoolean(input.isListed, "isListed");
  product.highlights = readTextList(input.highlights, "highlights", 200);
  product.specifications = readTextList(
    input.specifications,
    "specifications",
    500,
  );
  product.retainedImageIds = readImageIds(
    input.retainedImageIds,
    "Duplicate retained images.",
  );
  if (
    product.regularPrice &&
    product.price &&
    product.regularPrice < product.price
  ) {
    throw validationError(
      "Regular price must be at least the selling price.",
      "form",
    );
  }
  return product;
}
