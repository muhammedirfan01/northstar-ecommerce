import mongoose from "mongoose"; // This schema does not create a separate collection.Temporary signup details are embedded in the OTP record.
const registrationDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { _id: false },
);

const registrationOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ["registration"], default: "registration", required: true },
    otpHash: { type: String, required: true, select: false },
    pendingRegistration: { type: registrationDetailsSchema, select: false },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    resendCount: { type: Number, default: 0, min: 0 },
    attempts: { type: Number, default: 0, min: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
registrationOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });
registrationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 1800 });
export default mongoose.model("RegistrationOtp", registrationOtpSchema, "otpchallenges");
