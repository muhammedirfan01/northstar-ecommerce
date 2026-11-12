
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productName: { type: String, required: true },
    variantName: { type: String, default: "" },
    productImage: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPricePaise: { type: Number, required: true, min: 0 },
    lineTotalPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    requestId: { type: String },
    legacyOrderId: { type: String, index: true },
    requestFingerprint: { type: String },

    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paymentSetupUntil: { type: Date, default: null },

    statusHistory: { type: [{ status: String, at: Date }], default: [] },
    paymentHistory: { type: [{ status: String, at: Date, reference: String, note: String }], default: [] },

    customer: { name: String, email: String, phone: String },
    inventoryRestoredAt: { type: Date, default: null },
    returnHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },

    returnRequest: {
      cycle: { type: Number, min: 1, default: 1 },
      replacementReleasedAt: Date,
      resolution: { type: String, enum: ["refund", "replacement"], default: "refund" },
      replacementStatus: {
        type: String,
        enum: ["none", "ready_to_ship", "shipped", "out_for_delivery", "delivered", "cancelled"],
        default: "none",
      },
      replacementReservedAt: Date,
      replacementShippedAt: Date,
      replacementDeliveredAt: Date,
      requestFingerprint: { type: String },
      reference: { type: String, default: "" },
      description: { type: String, default: "", maxlength: 500 },
      pickupAddress: { type: shippingAddressSchema },
      packagingConfirmed: { type: Boolean, default: false },
      photos: { type: [{ id: String, name: String }], default: [] },
      status: {
        type: String,
        enum: ["none", "requested", "accepted", "rejected", "completed", "cancelled"],
        default: "none",
      },
      reason: { type: String, default: "" },
      cancelledAt: Date,
      requestedAt: Date,
      reviewedAt: Date,
      completedAt: Date,
      reviewNote: { type: String, default: "" },
    },

    refund: {
      reason: { type: String, enum: ["", "duplicate_payment"], default: "" },
      status: {
        type: String,
        enum: ["none", "pending", "processing", "completed", "failed"],
        default: "none",
      },
      amount: { type: Number, default: 0, min: 0 },
      method: { type: String, enum: ["", "cash", "razorpay", "wallet"], default: "" },
      reference: { type: String, default: "" },
      requestedAt: Date,
      completedAt: Date,
    },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: String, required: true, unique: true },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },

    shippingAddress: { type: shippingAddressSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    offerDiscount: { type: Number, default: 0, min: 0 },
    couponDiscount: { type: Number, default: 0, min: 0 },

    appliedOffers: {
      type: [{
        campaignId: mongoose.Schema.Types.ObjectId,
        name: String,
        productId: mongoose.Schema.Types.ObjectId,
        discount: Number,
        discountType: { type: String, enum: ["fixed", "percentage"] },
        discountValue: Number,
        discountPaise: Number,
        quantity: Number,
        variantId: mongoose.Schema.Types.ObjectId,
      }],
      default: [],
    },

    shippingCharge: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentMethod: { type: String, enum: ["cod", "razorpay", "wallet"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled"],
      default: "pending",
    },

    cancellationReason: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });

orderSchema.index(
  { userId: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: "string" } } }
);

orderSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, partialFilterExpression: { razorpayOrderId: { $type: "string" } } }
);

orderSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string" } } }
);

export default mongoose.model("Order", orderSchema);
