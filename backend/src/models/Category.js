import mongoose from "mongoose";
import catalogImageSchema from "../schemas/catalogImageSchema.js";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  nameKey: { type: String, required: true, unique: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  image: { type: catalogImageSchema, default: null },
  isListed: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null },
}, { timestamps: true, optimisticConcurrency: true });

categorySchema.index({ createdAt: -1, _id: -1 });

export default mongoose.model("Category", categorySchema);