import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    operation: { type: String, enum: ["purchase", "refund"], required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    balanceAfterPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    description: { type: String, required: true },
  },
  { timestamps: true },
);
schema.index({ orderId: 1, operation: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
export default mongoose.model("WalletTransaction", schema);
