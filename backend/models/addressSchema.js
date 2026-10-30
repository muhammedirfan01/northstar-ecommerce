import mongoose from "mongoose";
const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, match: /^\+91[6-9]\d{9}$/ },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, match: /^[1-9]\d{5}$/ },
    country: { type: String, enum: ["IN"], default: "IN" },
    label: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
  },
  { timestamps: true },
);
export default addressSchema;
