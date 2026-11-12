
import mongoose from "mongoose";

const returnPhotoSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true, immutable: true },
    name: { type: String, required: true, immutable: true },
    publicId: { type: String, required: true, immutable: true },
    url: { type: String, required: true, immutable: true },
  },
  { timestamps: true }
);

export default mongoose.model("ReturnPhoto", returnPhotoSchema);
