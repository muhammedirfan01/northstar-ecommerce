import Category from "../models/Category.js";
import {
  inventoryQuery,
  inventoryFilter,
  inventorySort,
} from "../utils/inventoryQuery.js";
import Product from "../models/Product.js";
import { orderId } from "../utils/validators/order.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
import { variantStockTotal } from "../utils/inventory.js";

export async function listInventory(input) {
  const query = inventoryQuery(input.query),
    filter = inventoryFilter(query);
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
    .sort(inventorySort(query))
    .skip((page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  const products = rows.map((p) => ({
    id: String(p._id),
    name: p.name,
    stock: p.stock,
    version: p.__v ?? 0,
    image: p.images?.[0]?.url || "",
    category: p.category
      ? { id: String(p.category._id), name: p.category.name }
      : null,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: String(v._id),
      name: v.name,
      stock: v.stock,
    })),
  }));
  return {
    status: 200,
    body: {
      success: true,
      data: {
        products,
        categories: categories.map((c) => ({
          id: String(c._id),
          name: c.name,
        })),
        summary: { total: all, lowStock, outOfStock },
        pagination: { total, totalPages, page, limit: query.limit },
      },
    },
  };
}
export async function updateStock(input, session = null) {
  checkFields(input.body, ["variantId", "stock", "version"]);
  const { stock, version, variantId } = input.body;
  if (
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    stock > 100000000 ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    throw httpError(
      "Enter a whole stock quantity and the current version.",
      400,
    );
  if (variantId !== null && !/^[a-f0-9]{24}$/i.test(variantId || ""))
    throw httpError("Invalid variant ID.", 400);
  const filter = { _id: orderId(input.params), deletedAt: null, __v: version };
  let result;
  if (variantId) {
    filter["variants._id"] = variantId;
    result = await Product.updateOne(
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
    result = await Product.updateOne(
      filter,
      { $set: { stock }, $inc: { __v: 1 } },
      { session },
    );
  }
  if (result.modifiedCount !== 1)
    throw httpError(
      "Stock changed or product option was not found. Refresh before saving.",
      409,
    );
  return { status: 200, body: { success: true, message: "Stock updated." } };
}
