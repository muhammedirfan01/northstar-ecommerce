import Product from "../models/Product.js";
import {
  visibleCategories,
  categoryAndChildren,
  publicCategory,
} from "./categoryService.js";
import { publicProduct } from "./productService.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";

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
export async function listCategories() {
  const categories = await visibleCategories();
  return { categories: categories.map(publicCategory) };
}

export async function listProducts(query) {
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
  return {
    products: products.filter(productIsAvailable).map(customerProduct),
    pagination: { page, limit: query.limit, total, totalPages },
  };
}

export async function getProduct(id) {
  const filter = await availableProductFilter();
  const product = await Product.findOne({
    ...filter,
    _id: id,
  }).populate(categoryPopulation);
  if (!productIsAvailable(product)) return null;
  const related = await Product.find({
    ...filter,
    _id: { $ne: product._id },
    $and: [{ category: product.category._id }],
  })
    .populate(categoryPopulation)
    .sort({ createdAt: -1, _id: -1 })
    .limit(4);
  return {
    product: customerProduct(product),
    related: related.filter(productIsAvailable).map(customerProduct),
  };
}
