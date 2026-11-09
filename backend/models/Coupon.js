import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true, min: 1 },
  minPurchasePaise: { type: Number, default: 0, min: 0 },
  maxDiscountPaise: { type: Number, default: null },
  usageLimit: { type: Number, default: null, min: 1 },
  usedCount: { type: Number, default: 0, min: 0 },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema);
