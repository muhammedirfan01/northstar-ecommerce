
export function productIsAvailable(product) {
  if (!product) return false;

  if (!product.isListed || !product.isPublished || product.stock <= 0) {
    return false;
  }
  if (!product.category?.isListed) return false;

  if (product.category.parent && !product.category.parent.isListed) {
    return false;
  }
  return true;
}
export const categoryPopulation = {
  path: "category",
  populate: {
    path: "parent",
    select: "name isListed"
  }
};
  