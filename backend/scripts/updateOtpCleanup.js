import "dotenv/config";
import mongoose from "mongoose";
import RegistrationOtp from "../models/RegistrationOtp.js";

async function updateOtpCleanup() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: "northstar",
      autoIndex: false,
      autoCreate: false,
    });

    await mongoose.connection.db.command({
      collMod: RegistrationOtp.collection.collectionName,

      index: {
        name: "expiresAt_1",
        expireAfterSeconds: 1800,
      },
    });

    console.log(
      "OTP cleanup index updated successfully to 1800 seconds."
    );
  } catch (error) {
    console.error(
      "OTP cleanup update failed:",
      error.code || error.name
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

updateOtpCleanup();
//updateOtpCleanup.js — Updates the MongoDB TTL index to automatically clean up expired OTP records