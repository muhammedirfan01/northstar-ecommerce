import mongoose from "mongoose";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import ProfileVerification from "../models/ProfileVerification.js";
import PasswordReset from "../models/PasswordReset.js";
import Order from "../models/Order.js";

export default async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "northstar" });
  await Promise.all([
    User.init(), RegistrationOtp.init(), ProfileVerification.init(),
    PasswordReset.init(), Order.init(),
  ]);
  console.log("MongoDB connected and models ready");
}
