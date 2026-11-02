import User from "../models/User.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";

export async function dashboardSummary() {
  const [customers, products, categories, publishedProducts] = await Promise.all([
    User.countDocuments({ role: "customer", deletedAt: null }),
    Product.countDocuments({}),
    Category.countDocuments({}),
    Product.countDocuments({ isPublished: true, isListed: true }),
  ]);
  return { customers, products, categories, publishedProducts };
}
