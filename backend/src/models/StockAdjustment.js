
import mongoose from "mongoose";

const stockAdjustmentSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    requestId: { type: String, required: true, immutable: true },
    version: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, immutable: true },
    quantity: { type: Number, required: true, immutable: true },
    before: { type: Number, required: true, immutable: true },
    after: { type: Number, required: true, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockAdjustmentSchema.index({ requestId: 1 }, { unique: true });

export default mongoose.model("StockAdjustment", stockAdjustmentSchema);
