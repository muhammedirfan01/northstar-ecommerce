import mongoose from "mongoose";
const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    authVersion: Number,
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    resendCount: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: Date,
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 1800 });
export default mongoose.model(
  "PasswordReset",
  passwordResetSchema,
  "passwordresetchallenges",
);
