import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { serviceError } from "../utils/serviceError.js";
import { deleteProducts } from "./catalogDeletionService.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "./catalogImageService.js";

export function publicCategory(category) {
  return {
    id: String(category._id),
    name: category.name,
    parentId: category.parent
      ? String(category.parent._id || category.parent)
      : null,
    parentName: category.parent?.name || "",
    parentListed: category.parent ? category.parent.isListed : true,
    isListed: category.isListed,
    createdAt: category.createdAt,
    image: category.image
      ? { id: String(category.image._id), url: category.image.url }
      : null,
  };
}

export async function listCategories(query) {
  const filter = {};
  if (query.search)
    filter.name = new RegExp(
      query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
  if (query.status === "listed" || query.status === "unlisted")
    filter.isListed = query.status === "listed";
  if (query.options === "true") {
    const categories = await Category.find({})
      .populate("parent", "name isListed")
      .sort({ name: 1 })
      .lean();
    return { categories: categories.map(publicCategory) };
  }
  const total = await Category.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const categories = await Category.find(filter)
    .populate("parent", "name isListed")
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * query.limit)
    .limit(query.limit)
    .lean();
  const results = [];
  for (const category of categories)
    results.push({
      ...publicCategory(category),
      productCount: await Product.countDocuments({
        category: { $in: await categoryAndChildren(category._id) },
      }),
      subcategoryCount: await Category.countDocuments({ parent: category._id }),
    });
  const all = await Category.countDocuments({});
  const listed = await Category.countDocuments({ isListed: true });
  return {
    categories: results,
    summary: { total: all, listed, unlisted: all - listed },
    pagination: { page, limit: query.limit, total, totalPages },
  };
}

export async function saveCategory(id, input, files) {
  const category = id ? await Category.findById(id) : new Category();
  if (!category) throw serviceError("Category not found.", 404);
  if (files.length > 1) throw serviceError("Choose only one category image.");
  if (input.parentId) {
    if (input.parentId === id)
      throw serviceError("A category cannot be its own parent.");
    const parent = await Category.findById(input.parentId);
    if (!parent || parent.parent)
      throw serviceError("Choose an existing main category as the parent.");
    if (id && (await Category.exists({ parent: id })))
      throw serviceError(
        "Move this category's subcategories before making it a subcategory.",
      );
  }
  const nameKey = input.name.replace(/\s+/g, " ").toLowerCase();
  if (await Category.exists({ nameKey, ...(id ? { _id: { $ne: id } } : {}) }))
    throw serviceError("A category with this name already exists.", 409);
  const previousImage = category.image;
  const uploaded = await uploadCatalogImages(files);
  category.name = input.name;
  category.nameKey = nameKey;
  category.parent = input.parentId || null;
  category.isListed = input.isListed;
  category.image = uploaded[0] || (input.keepImage ? previousImage : null);
  try {
    await category.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    throw error;
  }
  if (
    previousImage &&
    String(previousImage._id) !== String(category.image?._id)
  )
    await removeCatalogImages([previousImage]);
  await category.populate("parent", "name isListed");
  return publicCategory(category);
}

export async function setCategoryListed(id, isListed) {
  const category = await Category.findByIdAndUpdate(
    id,
    { $set: { isListed }, $inc: { __v: 1 } },
    { returnDocument: "after" },
  ).populate("parent", "name isListed");
  if (!category) throw serviceError("Category not found.", 404);
  return publicCategory(category);
}

export async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) throw serviceError("Category not found.", 404);
  const categories = await Category.find({
    _id: { $in: await categoryAndChildren(id) },
  });
  const ids = categories.map((item) => item._id);
  const products = await Product.find({ category: { $in: ids } });
  await deleteProducts(products);
  await Category.deleteMany({ _id: { $in: ids } });
  await removeCatalogImages(
    categories.flatMap((item) => (item.image ? [item.image] : [])),
  );
}

// One main category and one subcategory level keeps navigation easy to manage.
export async function categoryAndChildren(id) {
  const children = await Category.find({ parent: id }).select("_id");
  return [id, ...children.map((child) => child._id)];
}
export async function visibleCategories() {
  const categories = await Category.find({ isListed: true })
    .populate("parent", "name isListed")
    .sort({ name: 1 });
  return categories.filter(
    (category) => !category.parent || category.parent.isListed,
  );
}
