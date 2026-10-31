import { serviceError } from "../utils/serviceError.js";
import sendOtpEmail from "../utils/sendOtpEmail.js";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import { generateOtp, hashOtp, matchesOtpHash } from "../utils/otp.js";

const OTP_TIME = 5 * 60 * 1000;
const COOLDOWN = 60 * 1000;
const MAX_AGE = 30 * 60 * 1000;

// Verify registration OTP
export async function verifyRegistration(body) {
  const { challengeId, code } = body;

  const filter = {
    _id: challengeId,
    purpose: "registration",
    usedAt: null,
    expiresAt: { $gt: new Date() },
    createdAt: { $gt: new Date(Date.now() - MAX_AGE) }
  };

  // Count every verification attempt
  const record = await RegistrationOtp.findOneAndUpdate(
    { ...filter, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  ).select("+otpHash");

  if (!record) {
    throw serviceError("Invalid or expired OTP.");
  }

  const submittedHash = hashOtp(record.id, "registration", code);

  if (!matchesOtpHash(record.otpHash, submittedHash)) {
    throw serviceError("Invalid or expired OTP.");
  }

  // Prevent the same OTP from being used twice
  const verified = await RegistrationOtp.findOneAndUpdate(
    { ...filter, otpHash: record.otpHash },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" }
  ).select("+pendingRegistration");

  if (!verified?.pendingRegistration) {
    throw serviceError("Invalid or expired OTP.");
  }

  const { name, passwordHash } = verified.pendingRegistration;

  try {
    const user = await User.create({
      name,
      email: verified.email,
      passwordHash,
      role: "customer",
      isEmailVerified: true
    });

    return {
      verified: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  } catch (error) {
    if (error.code === 11000) {
      throw serviceError("This email is already registered.", 409);
    }

    console.error("Registration failed:", error);
    throw serviceError("Registration failed. Please try again.", 503);
  }
}

// Resend registration OTP
export async function resendRegistrationOtp(body) {
  const { challengeId } = body;
  const filter = {
    _id: challengeId,
    purpose: "registration",
    usedAt: null,
    attempts: { $lt: 5 },
    createdAt: { $gt: new Date(Date.now() - 25 * 60 * 1000) }
  };

  const record = await RegistrationOtp.findOne(filter)
    .select("+otpHash");

  if (!record || (record.resendCount ?? 0) >= 3) {
    throw serviceError("Start registration again.");
  }

  const wait = Math.ceil(
    (record.resendAvailableAt.getTime() - Date.now()) / 1000
  );

  if (wait > 0) {
    throw serviceError(`Wait ${wait} seconds before resending.`, 429, { resendAfter: wait });
  }

  let code;
  let newHash;

  do {
    code = generateOtp();
    newHash = hashOtp(challengeId, "registration", code);
  } while (newHash === record.otpHash);

  const updated = await RegistrationOtp.findOneAndUpdate(
    {
      ...filter,
      otpHash: record.otpHash,
      resendAvailableAt: { $lte: new Date() },
      $or: [
        { resendCount: { $lt: 3 } },
        { resendCount: { $exists: false } }
      ]
    },
    {
      $set: {
        otpHash: newHash,
        expiresAt: new Date(Date.now() + OTP_TIME),
        resendAvailableAt: new Date(Date.now() + COOLDOWN)
      },
      $inc: { resendCount: 1 }
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw serviceError("Please wait before trying again.", 429);
  }

  try {
    await sendOtpEmail(updated.email, code, "registration");
  } catch (error) {
    console.error("OTP email failed:", error);
    throw serviceError("Unable to send OTP. Try again later.", 503);
  }

  return {
    challengeId,
    expiresAt: updated.expiresAt,
    expiresIn: 300,
    resendAfter: 60
  };
}
