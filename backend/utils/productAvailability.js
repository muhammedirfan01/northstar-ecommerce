export function productIsAvailable(product) {
  if (!product || product.deletedAt) {
    return false;
  }
  if (!product.isListed || !product.isPublished) {
    return false;
  }
  if (!Number.isFinite(product.stock) || product.stock <= 0) {
    return false;
  }
  const category = product.category;
  if (!category || !category.isListed || category.deletedAt) {
    return false;
  }
  if (
    category.parent &&
    (!category.parent.isListed || category.parent.deletedAt)
  ) {
    return false;
  }
  return true;
}
export const categoryPopulation = {
  path: "category",
  populate: {
    path: "parent",
    select: "name isListed deletedAt",
  },
};
