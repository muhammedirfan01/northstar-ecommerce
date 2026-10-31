export function productIsAvailable(product) {
  return Boolean(
    product &&
    product.isListed &&
    product.isPublished &&
    product.stock > 0 &&
    product.category?.isListed &&
    (!product.category.parent || product.category.parent.isListed),
  );
}

export const categoryPopulation = {
  path: "category",
  populate: { path: "parent", select: "name isListed" },
};
