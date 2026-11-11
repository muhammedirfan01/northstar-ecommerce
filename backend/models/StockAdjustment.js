import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      immutable: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    requestId: { type: String, required: true, immutable: true },
    fingerprint: { type: String, required: true, immutable: true },
    type: {
      type: String,
      enum: ["received", "correction", "loss"],
      required: true,
      immutable: true,
    },
    quantity: { type: Number, required: true, immutable: true },
    before: { type: Number, required: true, immutable: true },
    after: { type: Number, required: true, immutable: true },
    reason: { type: String, required: true, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
schema.index({ adminId: 1, requestId: 1 }, { unique: true });
export default mongoose.model("StockAdjustment", schema);
