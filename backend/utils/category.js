import Category from "../models/Category.js";
export function publicCategory(category) {
  let parentId = null;
  let parentName = "";
  let parentListed = true;
  if (category.parent) {
    parentId = String(category.parent._id || category.parent);
    parentName = category.parent.name || "";
    parentListed = category.parent.isListed && !category.parent.deletedAt;
  }
  let image = null;
  if (category.image) {
    image = {
      id: String(category.image._id),
      url: category.image.url,
    };
  }
  return {
    id: String(category._id),
    name: category.name,
    parentId,
    parentName,
    parentListed,
    isListed: category.isListed,
    deletedAt: category.deletedAt || null,
    createdAt: category.createdAt,
    image,
  };
}
export async function categoryAndChildren(id) {
  const children = await Category.find({
    parent: id,
    deletedAt: null,
  }).select("_id");
  const ids = [id];
  for (const child of children) {
    ids.push(child._id);
  }
  return ids;
}
export async function visibleCategories() {
  const categories = await Category.find({
    isListed: true,
    deletedAt: null,
  })
    .populate("parent", "name isListed deletedAt")
    .sort({
      name: 1,
    });
  const visible = [];
  for (const category of categories) {
    if (category.deletedAt) {
      continue;
    }
    if (
      category.parent &&
      (!category.parent.isListed || category.parent.deletedAt)
    ) {
      continue;
    }
    visible.push(category);
  }
  return visible;
}
