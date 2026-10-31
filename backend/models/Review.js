import mongoose from "mongoose";
import { catalogImageSchema } from "./Category.js";

const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    recommends: { type: Boolean, required: true },
    images: {
      type: [catalogImageSchema],
      default: [],
      validate: (images) => images.length <= 3,
    },
    isListed: { type: Boolean, default: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, isListed: 1, createdAt: -1 });
export default mongoose.model("Review", reviewSchema);
