import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import ShoppingList from "../models/ShoppingList.js";
import { removeCatalogImages } from "./catalogImageService.js";
import { serviceError } from "../utils/serviceError.js";

// Product and category deletion share the same order protection and cleanup.
export async function deleteProducts(products) {
  const ids = products.map((product) => product._id);
  if (!ids.length) return;
  // Check every product before deleting any of them.
  if (await Order.exists({ "items.productId": { $in: ids } }))
    throw serviceError(
      "A product is used in an order. Unlist this category or product instead.",
      409,
    );
  const reviews = await Review.find({ productId: { $in: ids } }).select(
    "images",
  );
  await Product.deleteMany({ _id: { $in: ids } });
  await Review.deleteMany({ productId: { $in: ids } });
  await ShoppingList.updateMany(
    {},
    {
      $pull: {
        cart: { productId: { $in: ids } },
        wishlist: { $in: ids },
      },
      $inc: { __v: 1 },
    },
  );
  await removeCatalogImages([
    ...products.flatMap((product) => [
      ...product.images,
      ...product.variants.flatMap((variant) => variant.images || []),
    ]),
    ...reviews.flatMap((review) => review.images || []),
  ]);
}
