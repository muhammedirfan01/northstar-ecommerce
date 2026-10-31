import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import {
  productIsAvailable,
  categoryPopulation,
} from "../utils/productAvailability.js";
import { serviceError } from "../utils/serviceError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "./catalogImageService.js";

async function availableProduct(productId) {
  const product =
    await Product.findById(productId).populate(categoryPopulation);
  if (!productIsAvailable(product))
    throw serviceError("This product is unavailable.", 404);
  return product;
}
function publicReview(review) {
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
export async function listReviews(productId, requestedPage, admin = false) {
  const product = admin
    ? await Product.findById(productId)
    : await availableProduct(productId);
  if (!product) throw serviceError("Product not found.", 404);
  const filter = { productId, ...(!admin ? { isListed: true } : {}) };
  const total = await Review.countDocuments(filter);
  const limit = admin ? 10 : 3;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const reviews = await Review.find(filter)
    .populate("userId", "name")
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const [summary] = await Review.aggregate([
    {
      $match: {
        productId: new mongoose.Types.ObjectId(productId),
        isListed: true,
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        average: { $avg: "$rating" },
        recommended: { $sum: { $cond: ["$recommends", 1, 0] } },
      },
    },
  ]);
  return {
    productName: product.name,
    reviews: reviews.map(publicReview),
    summary: reviewSummary(summary),
    pagination: { page, total, totalPages },
  };
}
export async function reviewEligibility(productId, userId) {
  await availableProduct(productId);
  const review = await Review.findOne({ productId, userId });
  return {
    canReview: true,
    reason: "",
    review: review ? publicReview(review) : null,
  };
}
export async function saveReview(productId, userId, input, files = []) {
  await availableProduct(productId);
  let review = await Review.findOne({ productId, userId });
  const previous = review?.images || [];
  const { retainedImageIds, ...fields } = input;
  // Older JSON requests keep photos unless the customer explicitly removes them.
  const retained =
    retainedImageIds === undefined
      ? previous
      : previous.filter((image) =>
          retainedImageIds.includes(String(image._id)),
        );
  if (retainedImageIds && retained.length !== retainedImageIds.length)
    throw serviceError("Choose only photos from your own review.");
  if (retained.length + files.length > 3)
    throw serviceError("A review can contain up to 3 photos.");
  const uploaded = await uploadCatalogImages(files, "northstar/reviews");
  if (review)
    Object.assign(review, fields); // Keep the admin's visibility decision.
  else review = new Review({ productId, userId, ...fields });
  review.images = [...retained, ...uploaded];
  try {
    await review.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    if (error.code === 11000)
      throw serviceError(
        "Your review was already saved. Refresh to edit it.",
        409,
      );
    throw error;
  }
  await removeCatalogImages(
    previous.filter(
      (image) =>
        !retained.some((kept) => String(kept._id) === String(image._id)),
    ),
  );
  return { review: publicReview(await review.populate("userId", "name")) };
}
export async function moderateReview(productId, reviewId, isListed) {
  const review = await Review.findOneAndUpdate(
    { _id: reviewId, productId },
    { $set: { isListed }, $inc: { __v: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!review) throw serviceError("Review not found.", 404);
  return { id: String(review._id), isListed: review.isListed };
}
export async function deleteReview(productId, reviewId) {
  const review = await Review.findOneAndDelete({ _id: reviewId, productId });
  if (!review) throw serviceError("Review not found.", 404);
  await removeCatalogImages(review.images || []);
}
