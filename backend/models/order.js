
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  productName: { type: String, required: true },
  variantName: { type: String, default: "" },
  productImage: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  unitPricePaise: { type: Number, required: true, min: 0 },
  lineTotalPaise: { type: Number, required: true, min: 0 }
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String, default: "" },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: items => items.length > 0,
      message: "Order must contain at least one item"
    }
  },
  shippingAddress: { type: shippingAddressSchema, required: true },
  subtotal: { type: Number, required: true, min: 0 },
  shippingCharge: { type: Number, required: true, min: 0, default: 0 },
  tax: { type: Number, required: true, min: 0, default: 0 },
  discount: { type: Number, required: true, min: 0, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ["cod", "razorpay"], required: true },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  orderStatus: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled"],
    default: "pending"
  },
  cancellationReason: { type: String, default: "" },
  cancelledAt: { type: Date, default: null }
}, { timestamps: true });


orderSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.model("Order", orderSchema);
