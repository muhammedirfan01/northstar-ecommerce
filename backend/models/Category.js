import mongoose from "mongoose";

export const catalogImageSchema = new mongoose.Schema({
  publicId: { type: String, required: true },
  url: { type: String, required: true },
});

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    image: { type: catalogImageSchema, default: null },
    isListed: { type: Boolean, default: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

categorySchema.index({ createdAt: -1, _id: -1 });
export default mongoose.model("Category", categorySchema);
