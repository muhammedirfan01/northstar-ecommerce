import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    scope: { type: String, enum: ["all", "product", "category"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    startDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    updatedBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

campaignSchema.index({ isActive: 1, startDate: 1, expiryDate: 1 });

export default mongoose.model("Campaign", campaignSchema);
