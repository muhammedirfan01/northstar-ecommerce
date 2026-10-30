import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
const moneyField = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isSafeInteger,
};

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, max: 1000, validate: Number.isInteger },
    unitPricePaise: moneyField,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `NSO-${randomBytes(6).toString("hex").toUpperCase()}`,
    },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },
    totalAmountPaise: moneyField,
    currency: { type: String, enum: ["INR"], default: "INR" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"],
      default: "pending",
    },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    paidAt: {
      type: Date,
      required() {
        return this.paymentStatus === "paid";
      },
    },
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1, status: 1 });
orderSchema.index({ paymentStatus: 1, paidAt: -1 });
orderSchema.index({ customer: 1, status: 1 });

export default mongoose.model("Order", orderSchema);
