// Manage products and check the details submitted by the admin.

import mongoose from "mongoose";
import { ProductStatus } from "../constants/statuses.js";
import { getFormData, validateFormFields, validateText, validateBoolean, validateChoice, validateId, validateArray } from "../utils/formValidation.js";
import {
  checkCatalogQuery,
  checkCatalogParams,
  checkCatalogStatus,
  formatAdminProduct,
  categoryDetails,
  validatePrice,
  validateStock,
  validateImageIds,
} from "./catalogService.js";
import { getCategoryIdsWithChildren } from "./categoryService.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { createError } from "../utils/httpError.js";
import { uploadCatalogImages, removeCatalogImages } from "./catalogImageService.js";
import { createValidationError } from "../utils/validation.js";

// The controller passes request data here and sends the result back to the browser.

export async function listProducts(requestData) {
  requestData.filters = checkCatalogQuery(requestData.query);
  const query = requestData.filters;
  const filter = {
    deletedAt: null,
  };
  if (query.status === ProductStatus.DELETED) {
    filter.deletedAt = {
      $ne: null,
    };
  }
  if (query.search) {
    filter.name = new RegExp(
      query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  }
  if (query.category) {
    filter.category = {
      $in: (await getCategoryIdsWithChildren(query.category)).map((id) => new mongoose.Types.ObjectId(String(id))),
    };
  }
  if (query.status === ProductStatus.PUBLISHED) {
    filter.isPublished = true;
    filter.isListed = true;
  }
  if (query.status === ProductStatus.DRAFT) {
    filter.isPublished = false;
  }
  if (query.status === ProductStatus.LISTED) filter.isListed = true;
  if (query.status === ProductStatus.UNLISTED) {
    filter.isListed = false;
  }
  if (query.status === ProductStatus.OUT_OF_STOCK) {
    filter.stock = 0;
  }
  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const products = query.sort.startsWith("status-")
    ? await Product.populate(await Product.aggregate(getProductStatusSortSteps(filter, query.sort, page, query.limit)), categoryDetails)
    : await Product.find(filter)
    .populate(categoryDetails)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  const all = await Product.countDocuments({
    deletedAt: null,
  });
  const published = await Product.countDocuments({
    isPublished: true,
    isListed: true,
    deletedAt: null,
  });
  const lowStock = await Product.countDocuments({
    stock: {
      $gt: 0,
      $lte: 5,
    },
    deletedAt: null,
  });
  const responseData = {
    products: products.map(formatAdminProduct),
    summary: {
      total: all,
      published,
      lowStock,
    },
    pagination: {
      page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
  return {
    status: 200,
    body: {
      success: true,
      data: responseData,
    },
  };
}
export async function getProduct(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const id = requestData.params.id;
  const product = await Product.findById(id).populate(categoryDetails);
  if (!product || product.deletedAt) {
    throw createError("Product not found.", 404);
  }
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
export async function saveProduct(requestData) {
  if (requestData.params?.id) requestData.params = checkCatalogParams(requestData.params);
  requestData.data = validateProductForm(getFormData(requestData.body), Boolean(requestData.params?.id));
  // Validate ownership/category, upload new images, save, then clean up old images.
  const id = requestData.params.id;
  const productData = requestData.data;
  const files = requestData.files || [];
  let product;
  if (id) {
    product = await Product.findById(id);
  } else {
    product = new Product();
  }
  if (!product || product.deletedAt) {
    throw createError("Product not found.", 404);
  }
  if (id && (product.__v ?? 0) !== productData.version) {
    throw createError("This product changed while you were editing. Reload and try again.", 409);
  }
  const categoryExists = await Category.exists({
    _id: productData.categoryId,
    deletedAt: null,
  });
  if (!categoryExists) {
    throw createError("Choose an existing category.");
  }
  if (
    !product.variants.length &&
    (productData.price === undefined || productData.stock === undefined)
  ) {
    throw createError("Enter a price and stock quantity.");
  }
  if (
    product.variants.length &&
    (productData.price !== undefined ||
      productData.stock !== undefined ||
      productData.regularPrice !== undefined)
  ) {
    throw createError("Manage price and stock on the variants page.");
  }
  // Only this product's existing images may be kept by the submitted form.
  const retained = productData.retainedImageIds.map((id) => product.images.id(id));
  if (retained.some((image) => !image)) {
    throw createError(
      "An image was changed or does not belong to this product. Reload and try again.",
      409,
    );
  }
  const count = retained.length + files.length;
  if (count < 3 || count > 6) {
    throw createError("A product needs between 3 and 6 images.");
  }
  const removed = product.images.filter(
    (image) => !productData.retainedImageIds.includes(String(image._id)),
  );
  const uploaded = await uploadCatalogImages(files);
  product.name = productData.name;
  product.description = productData.description;
  product.series = productData.series;
  product.subtitle = productData.subtitle;
  product.badge = productData.badge;
  product.priceNote = productData.priceNote;
  product.quickSpecs = productData.quickSpecs;
  product.category = productData.categoryId;
  product.isPublished = productData.isPublished;
  product.isListed = productData.isListed;
  product.highlights = productData.highlights;
  product.specifications = productData.specifications;
  product.images = [...retained, ...uploaded];
  // Clear a variant image choice if that gallery image was removed.
  for (const variant of product.variants) {
    if (variant.imageId && !product.images.id(variant.imageId)) {
      variant.imageId = null;
    }
  }
  if (!product.variants.length) {
    product.pricePaise = productData.price;
    product.regularPricePaise = productData.regularPrice ?? null;
    product.stock = productData.stock;
  }
  try {
    await product.save();
  } catch (error) {
    // New uploads must not be left unused when the database save fails.
    await removeCatalogImages(uploaded);
    throw error;
  }
  await removeCatalogImages(removed);
  await product.populate(categoryDetails);
  const responseData = formatAdminProduct(product);
  return {
    status: requestData.params.id ? 200 : 201,
    body: {
      success: true,
      message: "Product saved.",
      data: {
        product: responseData,
      },
    },
  };
}
export async function setProductListed(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  requestData.data = checkCatalogStatus(requestData.body);
  const id = requestData.params.id;
  const isListed = requestData.data.isListed;
  const product = await Product.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      $set: {
        isListed,
      },
      $inc: {
        __v: 1,
      },
    },
    {
      returnDocument: "after",
    },
  ).populate(categoryDetails);
  if (!product || product.deletedAt) {
    throw createError("Product not found.", 404);
  }
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
export async function deleteProduct(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const product = await Product.findById(requestData.params.id);
  if (!product) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Product not found.",
      },
    };
  }
  // Mark the product as deleted. Keep its options and images so it can be restored.
  product.deletedAt = new Date();
  // Older option images should not prevent deleting or restoring the product.
  await product.save({ validateModifiedOnly: true });
  return {
    status: 200,
    body: {
      success: true,
      message:
        "Product deleted. Its images and variants are kept for restoration.",
    },
  };
}
export async function restoreProduct(requestData) {
  requestData.params = checkCatalogParams(requestData.params);
  const product = await Product.findById(requestData.params.id);
  if (!product) {
    return {
      status: 404,
      body: {
        success: false,
        message: "Product not found.",
      },
    };
  }
  product.deletedAt = null;
  await product.save({ validateModifiedOnly: true });
  return {
    status: 200,
    body: {
      success: true,
      message:
        "Product restored. It will appear to customers when its category, publication status and stock allow it.",
    },
  };
}

// Check product statuses in the same order as the admin table.
export const productStatusRules = Object.freeze([
  { status: ProductStatus.DELETED, condition: { $ne: [{ $ifNull: ['$deletedAt', null] }, null] } },
  { status: ProductStatus.UNLISTED, condition: { $eq: ['$isListed', false] } },
  { status: ProductStatus.DRAFT, condition: { $eq: ['$isPublished', false] } },
  { status: ProductStatus.OUT_OF_STOCK, condition: { $eq: ['$stock', 0] } },
]);
export const productStatusOrder = Object.freeze([ProductStatus.PUBLISHED, ProductStatus.OUT_OF_STOCK, ProductStatus.DRAFT, ProductStatus.UNLISTED, ProductStatus.DELETED]);
export function getProductStatusSortSteps(filter, sort, page, limit) {
  return [
    { $match: filter },
    { $addFields: { statusRank: { $switch: {
      branches: productStatusRules.map((rule) => ({ case: rule.condition, then: productStatusOrder.indexOf(rule.status) })),
      default: 0,
    } } } },
    { $sort: { statusRank: sort === 'status-desc' ? -1 : 1, createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { statusRank: 0 } },
  ];
}

function validateQuickSpecs(specs) {
  validateArray(specs, "quickSpecs", 6);
  const result = [];
  for (const spec of specs) {
    validateFormFields(spec, ["label", "value", "note"], "quickSpecs");
    result.push({
      label: validateText(spec.label, "label", 1, 60),
      value: validateText(spec.value, "value", 1, 120),
      note: spec.note === undefined ? "" : validateText(spec.note, "note", 0, 200),
    });
  }
  return result;
}
function validateTextList(values, fieldName, maxTextLength) {
  validateArray(values, fieldName, 20);
  const result = [];
  for (const value of values) {
    result.push(validateText(value, fieldName, 1, maxTextLength));
  }
  return result;
}
export function validateProductForm(formData, editing = false) {
  validateFormFields(formData, [
    "version",
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
  product.name = validateText(formData.name, "name", 2, 160);
  product.description = validateText(
    formData.description,
    "description",
    10,
    5000,
    "Description must have at least 10 characters.",
  );
  if (formData.series === undefined) {
    product.series = "";
  } else {
    product.series = validateText(formData.series, "series", 0, 80);
  }
  if (formData.subtitle === undefined) {
    product.subtitle = "";
  } else {
    product.subtitle = validateText(formData.subtitle, "subtitle", 0, 240);
  }
  product.badge = validateChoice(
    formData.badge === undefined ? "" : formData.badge,
    "badge",
    ["", "Best seller", "Deal of the day", "Most purchased", "New arrival"],
  );
  if (formData.priceNote === undefined) {
    product.priceNote = "";
  } else {
    product.priceNote = validateText(formData.priceNote, "priceNote", 0, 180);
  }
  product.quickSpecs = validateQuickSpecs(
    formData.quickSpecs === undefined ? [] : formData.quickSpecs,
  );
  product.categoryId = validateId(formData.categoryId, "categoryId"); // Products with variants manage their price and stock on the variants page.
  if (formData.price !== undefined) {
    product.price = validatePrice(formData.price, "price");
  }
  if (formData.regularPrice !== undefined) {
    if (formData.regularPrice === "") {
      product.regularPrice = null;
    } else {
      product.regularPrice = validatePrice(formData.regularPrice, "regularPrice");
    }
  }
  if (formData.stock !== undefined) {
    product.stock = validateStock(formData.stock);
  }
  product.isPublished = validateBoolean(formData.isPublished, "isPublished");
  product.isListed = validateBoolean(formData.isListed, "isListed");
  product.highlights = validateTextList(formData.highlights, "highlights", 200);
  product.specifications = validateTextList(
    formData.specifications,
    "specifications",
    500,
  );
  product.retainedImageIds = validateImageIds(
    formData.retainedImageIds,
    "Duplicate retained images.",
  );
  if (
    product.regularPrice &&
    product.price &&
    product.regularPrice < product.price
  ) {
    throw createValidationError(
      "Regular price must be at least the selling price.",
      "form",
    );
  }
  if (editing) {
    if (!Number.isSafeInteger(formData.version) || formData.version < 0) {
      throw createValidationError("Reload the product before saving changes.", "version");
    }
    product.version = formData.version;
  }
  return product;
}
