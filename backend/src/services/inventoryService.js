// Show inventory and update or restore product stock.

import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { validateOrderId, validateOrderFilters } from "../utils/orderValidation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

export async function listInventory(requestData) {
  const query = validateInventoryFilters(requestData.query),
    filter = getInventoryFilter(query);
  const [total, all, lowStock, outOfStock, categories] = await Promise.all([
    Product.countDocuments(filter),
    Product.countDocuments({ deletedAt: null }),
    Product.countDocuments({ deletedAt: null, stock: { $gte: 1, $lte: 5 } }),
    Product.countDocuments({ deletedAt: null, stock: 0 }),
    Category.find({ deletedAt: null }).select("name").sort({ name: 1 }).lean(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / query.limit)),
    page = Math.min(query.page, totalPages);
  const rows = await Product.find(filter)
    .select("name stock variants __v category images updatedAt")
    .populate("category", "name")
    .sort(getInventorySort(query))
    .skip((page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  const products = rows.map((product) => ({
    id: String(product._id),
    name: product.name,
    stock: product.stock,
    version: product.__v ?? 0,
    image: product.images?.[0]?.url || "",
    category: product.category
      ? { id: String(product.category._id), name: product.category.name }
      : null,
    updatedAt: product.updatedAt,
    variants: product.variants.map((variant) => ({
      id: String(variant._id),
      name: variant.name,
      stock: variant.stock,
    })),
  }));
  return {
    status: 200,
    body: {
      success: true,
      data: {
        products,
        categories: categories.map((category) => ({
          id: String(category._id),
          name: category.name,
        })),
        summary: { total: all, lowStock, outOfStock },
        pagination: { total, totalPages, page, limit: query.limit },
      },
    },
  };
}
export async function updateStock(requestData, session = null) {
  validateFormFields(requestData.body, ["variantId", "stock", "version"]);
  const { stock, version, variantId } = requestData.body;
  if (
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    stock > 100000000 ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    throw createError(
      "Enter a whole stock quantity and the current version.",
      400,
    );
  if (variantId !== null && !/^[a-f0-9]{24}$/i.test(variantId || ""))
    throw createError("Invalid variant ID.", 400);
  const filter = { _id: validateOrderId(requestData.params), deletedAt: null, __v: version };
  let stockUpdate;
  if (variantId) {
    filter["variants._id"] = variantId;
    stockUpdate = await Product.updateOne(
      filter,
      [
        {
          $set: {
            variants: {
              $map: {
                input: "$variants",
                as: "variant",
                in: {
                  $cond: [
                    { $eq: ["$$variant._id", { $toObjectId: variantId }] },
                    { $mergeObjects: ["$$variant", { stock }] },
                    "$$variant",
                  ],
                },
              },
            },
          },
        },
        { $set: { stock: variantStockTotal, __v: { $add: ["$__v", 1] } } },
      ],
      { updatePipeline: true, session },
    );
  } else {
    filter["variants.0"] = { $exists: false };
    stockUpdate = await Product.updateOne(
      filter,
      { $set: { stock }, $inc: { __v: 1 } },
      { session },
    );
  }
  if (stockUpdate.modifiedCount !== 1)
    throw createError(
      "Stock changed or product option was not found. Refresh before saving.",
      409,
    );
  return { status: 200, body: { success: true, message: "Stock updated." } };
}

// Catalog availability uses the sum of listed variants as the product stock.
export const variantStockTotal = {
  $sum: {
    $map: {
      input: {
        $filter: {
          input: "$variants",
          as: "variant",
          cond: { $eq: ["$$variant.isListed", true] },
        },
      },
      as: "variant",
      in: "$$variant.stock",
    },
  },
};
// Add the stock of listed product options and save the total on the product.
export async function updateProductStockTotal(productId, session) {
  await Product.updateOne(
    { _id: productId },
    [{ $set: { stock: variantStockTotal } }],
    { session, updatePipeline: true },
  );
}
// Put purchased quantities back into stock after cancellation or a return.
export async function restorePurchasedStock(order, session) {
  if (order.inventoryRestoredAt) return;
  for (const item of order.items) {
    const filter = { _id: item.productId };
    const increment = { __v: 1 };
    if (item.variantId) {
      filter["variants._id"] = item.variantId;
      increment["variants.$.stock"] = item.quantity;
    } else increment.stock = item.quantity;
    const restored = await Product.updateOne(
      filter,
      { $inc: increment },
      { session },
    );
    if (restored.modifiedCount !== 1) {
      const error = new Error(
        "Inventory could not be restored. Contact support.",
      );
      error.status = 409;
      error.expose = true;
      throw error;
    }
    if (item.variantId) await updateProductStockTotal(item.productId, session);
  }
  order.inventoryRestoredAt = new Date();
}

export function validateInventoryFilters(searchOptions = {}) {
  validateFormFields(searchOptions, [
    "page",
    "limit",
    "search",
    "category",
    "stockStatus",
    "sort",
  ]);
  const base = validateOrderFilters({
    page: searchOptions.page,
    limit: searchOptions.limit,
    search: searchOptions.search,
  });
  if (searchOptions.category && !/^[a-f0-9]{24}$/i.test(searchOptions.category))
    throw createError("Invalid category.", 400);
  if (
    searchOptions.stockStatus &&
    !["in_stock", "low_stock", "out_of_stock"].includes(searchOptions.stockStatus)
  )
    throw createError("Invalid stock status.", 400);
  if (
    searchOptions.sort &&
    !["stock-asc", "stock-desc", "name", "updated"].includes(searchOptions.sort)
  )
    throw createError("Invalid inventory sort.", 400);
  return {
    ...base,
    category: searchOptions.category,
    stockStatus: searchOptions.stockStatus,
    sort: searchOptions.sort || "stock-asc",
  };
}
export function getInventoryFilter(query) {
  const filter = { deletedAt: null };
  if (query.search) {
    const pattern = {
      $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    filter.$or = [{ name: pattern }];
    if (/^[a-f0-9]{24}$/i.test(query.search))
      filter.$or.push({ _id: query.search });
  }
  if (query.category) filter.category = query.category;
  if (query.stockStatus === "out_of_stock") filter.stock = 0;
  if (query.stockStatus === "low_stock") filter.stock = { $gte: 1, $lte: 5 };
  if (query.stockStatus === "in_stock") filter.stock = { $gt: 5 };
  return filter;
}
export const getInventorySort = (query) =>
  ({
    "stock-asc": { stock: 1, _id: 1 },
    "stock-desc": { stock: -1, _id: 1 },
    name: { name: 1, _id: 1 },
    updated: { updatedAt: -1, _id: -1 },
  })[query.sort];
