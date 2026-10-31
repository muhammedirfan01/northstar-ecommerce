import { Router } from "express";
import { z } from "zod";
import Product from "../models/Product.js";
import {
  visibleCategories,
  categoryAndChildren,
  publicCategory,
} from "../services/categoryService.js";
import { publicProduct } from "../services/productService.js";
import { validateCatalogId } from "../middlewares/validateCatalog.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const querySchema = z
  .strictObject({
    search: z.string().trim().max(100).default(""),
    category: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    minPrice: z.coerce.number().min(0).max(99999999.99).optional(),
    maxPrice: z.coerce.number().min(0).max(99999999.99).optional(),
    sort: z
      .enum(["latest", "price-asc", "price-desc", "name-asc", "name-desc"])
      .default("latest"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
  );

// Use this rule for customer-facing catalog requests. Admin lists intentionally show hidden items.
export async function availableProductFilter() {
  const categories = await visibleCategories();
  return {
    isListed: true,
    isPublished: true,
    stock: { $gt: 0 },
    category: { $in: categories.map((category) => category._id) },
  };
}
function customerProduct(product) {
  const data = publicProduct(product);
  data.variants = data.variants.filter((variant) => variant.isListed);
  return data;
}
router.get("/categories", async (_req, res) => {
  const categories = await visibleCategories();
  return res.json({
    success: true,
    data: {
      categories: categories.map(publicCategory),
    },
  });
});
router.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success)
    return res
      .status(400)
      .json({ success: false, message: "Invalid catalog filters." });
  const query = parsed.data;
  const filter = await availableProductFilter();
  if (query.category)
    filter.$and = [
      { category: { $in: await categoryAndChildren(query.category) } },
    ];
  if (query.search)
    filter.name = new RegExp(
      query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.pricePaise = {};
    if (query.minPrice !== undefined)
      filter.pricePaise.$gte = Math.round(query.minPrice * 100);
    if (query.maxPrice !== undefined)
      filter.pricePaise.$lte = Math.round(query.maxPrice * 100);
  }
  const sorts = {
    latest: { createdAt: -1, _id: -1 },
    "price-asc": { pricePaise: 1, _id: 1 },
    "price-desc": { pricePaise: -1, _id: 1 },
    "name-asc": { name: 1, _id: 1 },
    "name-desc": { name: -1, _id: 1 },
  };
  const total = await Product.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const products = await Product.find(filter)
    .populate(categoryPopulation)
    .collation({ locale: "en", strength: 2 })
    .sort(sorts[query.sort])
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  return res.json({
    success: true,
    data: {
      products: products.filter(productIsAvailable).map(customerProduct),
      pagination: { page, limit: query.limit, total, totalPages },
    },
  });
});
router.get("/:id", validateCatalogId, async (req, res) => {
  const filter = await availableProductFilter();
  const product = await Product.findOne({
    ...filter,
    _id: req.params.id,
  }).populate(categoryPopulation);
  if (!productIsAvailable(product))
    return res.status(404).json({
      success: false,
      message: "This product is unavailable. Browse other products.",
    });
  const related = await Product.find({
    ...filter,
    _id: { $ne: product._id },
    $and: [{ category: product.category._id }],
  })
    .populate(categoryPopulation)
    .sort({ createdAt: -1, _id: -1 })
    .limit(4);
  return res.json({
    success: true,
    data: {
      product: customerProduct(product),
      related: related.filter(productIsAvailable).map(customerProduct),
    },
  });
});
export default router;
