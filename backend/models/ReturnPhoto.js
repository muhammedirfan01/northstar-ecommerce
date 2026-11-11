import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
      immutable: true,
    },
    name: { type: String, required: true, immutable: true },
    bytes: { type: Buffer, required: true, select: false, immutable: true },
  },
  { timestamps: true },
);
export default mongoose.model("ReturnPhoto", schema);
