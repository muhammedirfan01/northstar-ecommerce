import mongoose from "mongoose";
const profileVerificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["email-change", "password-change"], required: true },
    currentEmail: { type: String, required: true },
    newEmail: String,
    pendingPasswordHash: { type: String, select: false },
    authVersion: { type: Number, required: true },
    currentCodeHash: { type: String, required: true, select: false },
    newCodeHash: { type: String, select: false },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resendCount: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
profileVerificationSchema.index({ userId: 1, purpose: 1 }, { unique: true });
profileVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 1800 });

export default mongoose.model("ProfileVerification", profileVerificationSchema, "profilechallenges");
