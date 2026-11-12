import "dotenv/config";
import mongoose from "mongoose";
import { validateResetEmail } from "../src/services/passwordResetService.js";
import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";

async function makeAdmin() {
  try {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) {
      throw new Error(
        "Provide your registered email: node scripts/makeAdmin.js your@email.com",
      );
    }
    validateResetEmail({
      email,
    });
    validateResetEmail({
      email,
    });
    await connectDB();
    const user = await User.findOne({
      email,
    });
    if (!user) {
      throw new Error(
        "Account not found. Register and verify this email first.",
      );
    }
    if (user.isBlocked || !user.isEmailVerified) {
      throw new Error("The account must be verified and unblocked.");
    }
    if (user.role === "admin") {
      console.log("This account is already an admin.");
      return;
    }
    const result = await User.updateOne(
      {
        _id: user._id,
        role: "customer",
        isBlocked: false,
        isEmailVerified: true,
      },
      {
        $set: {
          role: "admin",
        },
        $inc: {
          authVersion: 1,
        },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new Error("The account changed. Please run the script again.");
    }
    console.log("Admin role assigned. Sign in again to access the dashboard.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
makeAdmin();
//makeAdmin.js — Converts an existing customer account into an admin.
