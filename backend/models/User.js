import mongoose from "mongoose";
import addressSchema from "./addressSchema.js";
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: {
      type: String,
      required() {
        return !this.googleId;
      },
      select: false,
    },
    googleId: { type: String, unique: true, sparse: true, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    authVersion: { type: Number, default: 0, min: 0, select: false },
    isBlocked: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isEmailVerified: { type: Boolean, default: false },
    profileImage: String,
    profilePhoto: { type: Buffer, select: false },
    phone: { type: String, default: "", trim: true },
    walletBalancePaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
      select: false,
    },
    addresses: { type: [addressSchema], select: false },
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, default: null, select: false },
    // Prevent two address edits from overwriting one another.
    addressVersion: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true },
);
userSchema.index({ role: 1, deletedAt: 1, createdAt: -1, _id: -1 });
export default mongoose.model("User", userSchema);
