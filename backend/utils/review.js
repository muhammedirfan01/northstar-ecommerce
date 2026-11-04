import Product from "../models/Product.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
import { httpError } from "../utils/httpError.js";
export async function availableProduct(productId) {
  const product =
    await Product.findById(productId).populate(categoryPopulation);
  if (!productIsAvailable(product)) {
    throw httpError("This product is unavailable.", 404);
  }
  return product;
}
export function publicReview(review) {
  return {
    id: String(review._id),
    customerName: review.userId?.name || "Northstar customer",
    rating: review.rating,
    title: review.title,
    text: review.text,
    recommends: review.recommends,
    images: (review.images || []).map((image) => ({
      id: String(image._id),
      url: image.url,
    })),
    isListed: review.isListed,
    createdAt: review.createdAt,
  };
}
export function reviewSummary(result) {
  return {
    count: result?.count || 0,
    average: result?.average || 0,
    recommendPercent: result?.count
      ? Math.round((result.recommended / result.count) * 100)
      : 0,
  };
}
