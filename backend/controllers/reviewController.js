import {
  availableProduct,
  publicReview,
  reviewSummary,
} from "../utils/review.js";
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import { httpError } from "../utils/httpError.js";
import {
  uploadCatalogImages,
  removeCatalogImages,
} from "../services/catalogImageService.js";
export async function list(req, res) {
  const productId = req.params.id;
  const requestedPage = req.reviewPage;
  const admin = false;
  let product;
  if (admin) {
    product = await Product.findById(productId);
  } else {
    product = await availableProduct(productId);
  }
  if (!product) {
    throw httpError("Product not found.", 404);
  }
  const filter = {
    productId,
    ...(!admin
      ? {
          isListed: true,
        }
      : {}),
  };
  const total = await Review.countDocuments(filter);
  let limit;
  if (admin) {
    limit = 10;
  } else {
    limit = 3;
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const reviews = await Review.find(filter)
    .populate("userId", "name")
    .sort({
      createdAt: -1,
      _id: -1,
    })
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
        count: {
          $sum: 1,
        },
        average: {
          $avg: "$rating",
        },
        recommended: {
          $sum: {
            $cond: ["$recommends", 1, 0],
          },
        },
      },
    },
  ]);
  const responseData = {
    productName: product.name,
    reviews: reviews.map(publicReview),
    summary: reviewSummary(summary),
    pagination: {
      page,
      total,
      totalPages,
    },
  };
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function adminList(req, res) {
  const productId = req.params.id;
  const requestedPage = req.reviewPage;
  const admin = true;
  let product;
  if (admin) {
    product = await Product.findById(productId);
  } else {
    product = await availableProduct(productId);
  }
  if (!product) {
    throw httpError("Product not found.", 404);
  }
  const filter = {
    productId,
    ...(!admin
      ? {
          isListed: true,
        }
      : {}),
  };
  const total = await Review.countDocuments(filter);
  let limit;
  if (admin) {
    limit = 10;
  } else {
    limit = 3;
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const reviews = await Review.find(filter)
    .populate("userId", "name")
    .sort({
      createdAt: -1,
      _id: -1,
    })
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
        count: {
          $sum: 1,
        },
        average: {
          $avg: "$rating",
        },
        recommended: {
          $sum: {
            $cond: ["$recommends", 1, 0],
          },
        },
      },
    },
  ]);
  const responseData = {
    productName: product.name,
    reviews: reviews.map(publicReview),
    summary: reviewSummary(summary),
    pagination: {
      page,
      total,
      totalPages,
    },
  };
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function eligibility(req, res) {
  const productId = req.params.id;
  const userId = req.user.id;
  await availableProduct(productId);
  const review = await Review.findOne({
    productId,
    userId,
  });
  const responseData = {
    canReview: true,
    reason: "",
    review: review ? publicReview(review) : null,
  };
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function save(req, res) {
  const productId = req.params.id;
  const userId = req.user.id;
  const input = req.reviewInput;
  const files = req.files || [];
  await availableProduct(productId);
  let review = await Review.findOne({
    productId,
    userId,
  });
  const previous = review?.images || [];
  const { retainedImageIds, ...fields } = input;
  // Older JSON requests keep photos unless the customer explicitly removes them.
  let retained;
  if (retainedImageIds === undefined) {
    retained = previous;
  } else {
    retained = previous.filter((image) =>
      retainedImageIds.includes(String(image._id)),
    );
  }
  if (retainedImageIds && retained.length !== retainedImageIds.length) {
    throw httpError("Choose only photos from your own review.");
  }
  if (retained.length + files.length > 3) {
    throw httpError("A review can contain up to 3 photos.");
  }
  const uploaded = await uploadCatalogImages(files, "northstar/reviews");
  if (review) {
    review.rating = fields.rating;
    review.title = fields.title;
    review.text = fields.text;
    review.recommends = fields.recommends; // Keep the admin's visibility decision.
  } else {
    review = new Review({
      productId,
      userId,
      ...fields,
    });
  }
  review.images = [...retained, ...uploaded];
  try {
    await review.save();
  } catch (error) {
    await removeCatalogImages(uploaded);
    if (error.code === 11000) {
      throw httpError(
        "Your review was already saved. Refresh to edit it.",
        409,
      );
    }
    throw error;
  }
  await removeCatalogImages(
    previous.filter(
      (image) =>
        !retained.some((kept) => String(kept._id) === String(image._id)),
    ),
  );
  const responseData = {
    review: publicReview(await review.populate("userId", "name")),
  };
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function moderate(req, res) {
  const productId = req.params.id;
  const reviewId = req.params.reviewId;
  const isListed = req.catalogInput.isListed;
  const review = await Review.findOneAndUpdate(
    {
      _id: reviewId,
      productId,
    },
    {
      $set: {
        isListed,
      },
      $inc: {
        __v: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );
  if (!review) {
    throw httpError("Review not found.", 404);
  }
  const responseData = {
    id: String(review._id),
    isListed: review.isListed,
  };
  return res.json({
    success: true,
    data: responseData,
  });
}
export async function remove(req, res) {
  const productId = req.params.id;
  const reviewId = req.params.reviewId;
  const review = await Review.findOneAndDelete({
    _id: reviewId,
    productId,
  });
  if (!review) {
    throw httpError("Review not found.", 404);
  }
  await removeCatalogImages(review.images || []);
  return res.json({
    success: true,
    data: {},
  });
}
