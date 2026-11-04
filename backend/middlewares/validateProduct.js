import { validationError } from "../utils/validation.js";
export function checkProductInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw validationError("Invalid form.", "form");
  }
  for (const field of Object.keys(input)) {
    if (
      ![
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
  if (name.length > 160) {
    throw validationError("Invalid name.", "name");
  }
  input.name = name;
  let description = original.description;
  if (typeof description !== "string") {
    throw validationError("Invalid description.", "description");
  }
  description = description.trim();
  if (description.length < 10) {
    throw validationError(
      "Description must have at least 10 characters.",
      "description",
    );
  }
  if (description.length > 5000) {
    throw validationError("Invalid description.", "description");
  }
  input.description = description;
  let series = original.series;
  if (series === undefined) {
    series = "";
  } else {
    if (typeof series !== "string") {
      throw validationError("Invalid series.", "series");
    }
    series = series.trim();
    if (series.length > 80) {
      throw validationError("Invalid series.", "series");
    }
  }
  if (series !== undefined) {
    input.series = series;
  }
  let subtitle = original.subtitle;
  if (subtitle === undefined) {
    subtitle = "";
  } else {
    if (typeof subtitle !== "string") {
      throw validationError("Invalid subtitle.", "subtitle");
    }
    subtitle = subtitle.trim();
    if (subtitle.length > 240) {
      throw validationError("Invalid subtitle.", "subtitle");
    }
  }
  if (subtitle !== undefined) {
    input.subtitle = subtitle;
  }
  let badge = original.badge;
  if (badge === undefined) {
    badge = "";
  } else {
    if (
      ![
        "",
        "Best seller",
        "Deal of the day",
        "Most purchased",
        "New arrival",
      ].includes(badge)
    ) {
      throw validationError("Invalid badge.", "badge");
    }
  }
  if (badge !== undefined) {
    input.badge = badge;
  }
  let priceNote = original.priceNote;
  if (priceNote === undefined) {
    priceNote = "";
  } else {
    if (typeof priceNote !== "string") {
      throw validationError("Invalid priceNote.", "priceNote");
    }
    priceNote = priceNote.trim();
    if (priceNote.length > 180) {
      throw validationError("Invalid priceNote.", "priceNote");
    }
  }
  if (priceNote !== undefined) {
    input.priceNote = priceNote;
  }
  let quickSpecs = original.quickSpecs;
  if (quickSpecs === undefined) {
    quickSpecs = [];
  } else {
    if (!Array.isArray(quickSpecs)) {
      throw validationError("Invalid quickSpecs.", "quickSpecs");
    }
    quickSpecs = [...quickSpecs];
    for (let index = 0; index < quickSpecs.length; index++) {
      let item = quickSpecs[index];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw validationError("Invalid quickSpecs.", "quickSpecs");
      }
      for (const field of Object.keys(item)) {
        if (!["label", "value", "note"].includes(field)) {
          throw validationError("Unknown form field.", "quickSpecs");
        }
      }
      const original10 = item;
      item = {};
      let label = original10.label;
      if (typeof label !== "string") {
        throw validationError("Invalid label.", "label");
      }
      label = label.trim();
      if (label.length < 1) {
        throw validationError("Invalid label.", "label");
      }
      if (label.length > 60) {
        throw validationError("Invalid label.", "label");
      }
      item.label = label;
      let value = original10.value;
      if (typeof value !== "string") {
        throw validationError("Invalid value.", "value");
      }
      value = value.trim();
      if (value.length < 1) {
        throw validationError("Invalid value.", "value");
      }
      if (value.length > 120) {
        throw validationError("Invalid value.", "value");
      }
      item.value = value;
      let note = original10.note;
      if (note === undefined) {
        note = "";
      } else {
        if (typeof note !== "string") {
          throw validationError("Invalid note.", "note");
        }
        note = note.trim();
        if (note.length > 200) {
          throw validationError("Invalid note.", "note");
        }
      }
      if (note !== undefined) {
        item.note = note;
      }
      quickSpecs[index] = item;
    }
    if (quickSpecs.length > 6) {
      throw validationError("Invalid quickSpecs.", "quickSpecs");
    }
  }
  if (quickSpecs !== undefined) {
    input.quickSpecs = quickSpecs;
  }
  const categoryId = original.categoryId;
  if (typeof categoryId !== "string") {
    throw validationError("Invalid categoryId.", "categoryId");
  }
  if (!/^[a-f0-9]{24}$/i.test(categoryId)) {
    throw validationError("Invalid catalog ID.", "categoryId");
  }
  input.categoryId = categoryId;
  let price = original.price;
  if (price !== undefined) {
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
  }
  if (price !== undefined) {
    input.price = price;
  }
  let regularPrice = original.regularPrice;
  if (regularPrice !== undefined) {
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
        throw validationError(
          "Price must be greater than zero.",
          "regularPrice",
        );
      }
    }
  }
  if (regularPrice !== undefined) {
    input.regularPrice = regularPrice;
  }
  let stock = original.stock;
  if (stock !== undefined) {
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
  }
  if (stock !== undefined) {
    input.stock = stock;
  }
  const isPublished = original.isPublished;
  if (typeof isPublished !== "boolean") {
    throw validationError("Invalid isPublished.", "isPublished");
  }
  input.isPublished = isPublished;
  const isListed = original.isListed;
  if (typeof isListed !== "boolean") {
    throw validationError("Invalid isListed.", "isListed");
  }
  input.isListed = isListed;
  let highlights = original.highlights;
  if (!Array.isArray(highlights)) {
    throw validationError("Invalid highlights.", "highlights");
  }
  highlights = [...highlights];
  for (let index = 0; index < highlights.length; index++) {
    let item = highlights[index];
    if (typeof item !== "string") {
      throw validationError("Invalid highlights.", "highlights");
    }
    item = item.trim();
    if (item.length < 1) {
      throw validationError("Invalid highlights.", "highlights");
    }
    if (item.length > 200) {
      throw validationError("Invalid highlights.", "highlights");
    }
    highlights[index] = item;
  }
  if (highlights.length > 20) {
    throw validationError("Invalid highlights.", "highlights");
  }
  if (highlights !== undefined) {
    input.highlights = highlights;
  }
  let specifications = original.specifications;
  if (!Array.isArray(specifications)) {
    throw validationError("Invalid specifications.", "specifications");
  }
  specifications = [...specifications];
  for (let index = 0; index < specifications.length; index++) {
    let item = specifications[index];
    if (typeof item !== "string") {
      throw validationError("Invalid specifications.", "specifications");
    }
    item = item.trim();
    if (item.length < 1) {
      throw validationError("Invalid specifications.", "specifications");
    }
    if (item.length > 500) {
      throw validationError("Invalid specifications.", "specifications");
    }
    specifications[index] = item;
  }
  if (specifications.length > 20) {
    throw validationError("Invalid specifications.", "specifications");
  }
  if (specifications !== undefined) {
    input.specifications = specifications;
  }
  let retainedImageIds = original.retainedImageIds;
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
    throw validationError("Duplicate retained images.", "retainedImageIds");
  }
  if (retainedImageIds !== undefined) {
    input.retainedImageIds = retainedImageIds;
  }
  if (
    !(!input.regularPrice || !input.price || input.regularPrice >= input.price)
  ) {
    throw validationError(
      "Regular price must be at least the selling price.",
      "form",
    );
  }
  return input;
}
export default function validateProduct(req, res, next) {
  try {
    let input = req.body;
    if (typeof req.body?.data === "string") {
      input = JSON.parse(req.body.data);
    }
    const checked = checkProductInput(input);
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
