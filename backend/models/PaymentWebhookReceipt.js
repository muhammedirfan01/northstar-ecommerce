import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    digest: { type: String, required: true, immutable: true },
    event: { type: String, required: true, immutable: true },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      immutable: true,
    },
    processedAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);
export default mongoose.model("PaymentWebhookReceipt", schema);
