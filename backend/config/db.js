import { backfillOrderNumbers } from "../services/orderNumberService.js";
import { backfillRequestReferences } from "../services/requestNumberService.js";
import WalletTransaction from "../models/WalletTransaction.js";
import SupportRequest from "../models/SupportRequest.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import ProfileVerification from "../models/ProfileVerification.js";
import PasswordReset from "../models/PasswordReset.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import ShoppingList from "../models/ShoppingList.js";

export default async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "northstar",
  });
  await Promise.all([
    WalletTransaction.init(),
    SupportRequest.init(),
    User.init(),
    RegistrationOtp.init(),
    ProfileVerification.init(),
    PasswordReset.init(),
    Category.init(),
    Product.init(),
    ShoppingList.init(),
  ]);
  await backfillOrderNumbers();
  await backfillRequestReferences();
  console.log("MongoDB connected and models ready");
}
