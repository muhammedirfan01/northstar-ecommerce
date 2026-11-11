import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    legacyReference: String,
    requestId: { type: String, required: true, unique: true },
    fingerprint: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, maxlength: 254 },
    subject: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 3000 },
    resolutionNote: { type: String, default: "", maxlength: 1000 },
    reviewedBy: mongoose.Schema.Types.ObjectId,
    reviewedAt: Date,
    status: { type: String, enum: ["open", "in_progress", "closed"], default: "open" },
  },
  { timestamps: true },
);
export default mongoose.model("SupportRequest", schema);
