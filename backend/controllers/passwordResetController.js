import { randomBytes, createHash } from "node:crypto";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";

import sendOtpEmail from "../utils/sendOtpEmail.js";
import { generateOtp, hashOtp, matchesOtpHash } from "../utils/otp.js";
import { hashPassword } from "../utils/password.js";
import { activeAccountFilter } from "../utils/activeAccount.js";

const OTP_TIME = 5 * 60 * 1000;
const RESEND_TIME = 60 * 1000;
const MAX_AGE = 30 * 60 * 1000;

const hashToken = token =>
  createHash("sha256").update(token).digest("hex");

function fail(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    message
  });
}

function accountFilter(record) {
  return {
    ...activeAccountFilter(record.userId, record.email, record.authVersion),
    googleId: { $exists: false }
  };
}

function pendingFilter(challengeId) {
  return {
    _id: challengeId,
    usedAt: null,
    verifiedAt: null,
    createdAt: { $gt: new Date(Date.now() - MAX_AGE) }
  };
}

function timingData(record) {
  return {
    challengeId: record.id,
    expiresAt: record.expiresAt,
    expiresIn: 300,
    resendAfter: 60
  };
}

async function sendCode(record, code) {
  if (record.userId && await User.exists(accountFilter(record))) {
    await sendOtpEmail(record.email, code, "password-recovery");
  }
}

// 1. Request password recovery
export async function requestRecovery(req, res) {
  const { email } = req.body;
  const now = new Date();

  // Remove only an eligible old request.
  await PasswordReset.deleteOne({
    email,
    $or: [
      { usedAt: { $ne: null } },
      { verifiedAt: null, resendAvailableAt: { $lte: now } },
      { resetExpiresAt: { $lte: now } }
    ]
  });

  const user = await User.findOne({
    email,
    googleId: { $exists: false },
    isEmailVerified: true,
    isBlocked: false,
    deletedAt: null
  }).select("+authVersion");

  const code = generateOtp();

  const record = new PasswordReset({
    email,
    userId: user?._id,
    authVersion: user?.authVersion ?? 0,
    expiresAt: new Date(Date.now() + OTP_TIME),
    resendAvailableAt: new Date(Date.now() + RESEND_TIME)
  });

  record.otpHash = hashOtp(record.id, "password-recovery", code);

  try {
    await record.save();
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, "Please wait before requesting another code.", 429);
    }
    throw error;
  }

  try {
    await sendCode(record, code);
  } catch {
    return fail(res, "Unable to send the recovery email. Try again later.", 503);
  }

  return res.status(202).json({
    success: true,
    message: "If the account exists, a recovery code has been sent.",
    data: timingData(record)
  });
}

// 2. Resend OTP
export async function resendRecovery(req, res) {
  const { challengeId } = req.body;

  const record = await PasswordReset.findOne({
    ...pendingFilter(challengeId),
    attempts: { $lt: 5 },
    resendCount: { $lt: 3 }
  }).select("+otpHash");

  if (!record) {
    return fail(res, "Start password recovery again.");
  }

  const wait = Math.ceil(
    (record.resendAvailableAt.getTime() - Date.now()) / 1000
  );

  if (wait > 0) {
    return res.status(429).json({
      success: false,
      message: `Wait ${wait} seconds before resending.`,
      data: { resendAfter: wait }
    });
  }

  let code;
  let newHash;

  do {
    code = generateOtp();
    newHash = hashOtp(challengeId, "password-recovery", code);
  } while (newHash === record.otpHash);

  const updated = await PasswordReset.findOneAndUpdate(
    {
      ...pendingFilter(challengeId),
      attempts: { $lt: 5 },
      resendCount: { $lt: 3 },
      otpHash: record.otpHash,
      resendAvailableAt: { $lte: new Date() }
    },
    {
      $set: {
        otpHash: newHash,
        expiresAt: new Date(Date.now() + OTP_TIME),
        resendAvailableAt: new Date(Date.now() + RESEND_TIME)
      },
      $inc: { resendCount: 1 }
    },
    { new: true }
  );

  if (!updated) {
    return fail(res, "Recovery request changed. Try again.", 409);
  }

  try {
    await sendCode(updated, code);
  } catch {
    return fail(res, "Unable to send the code. Try again later.", 503);
  }

  return res.json({
    success: true,
    message: "A new code has been sent if the account is eligible.",
    data: {
      ...timingData(updated),
      sent: true
    }
  });
}

// 3. Verify OTP
export async function verifyRecovery(req, res) {
  const { challengeId, code } = req.body;

  const record = await PasswordReset.findOneAndUpdate(
    {
      ...pendingFilter(challengeId),
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 }
    },
    {
      $inc: { attempts: 1 }
    },
    { new: true }
  ).select("+otpHash");

  if (!record?.userId) {
    return fail(res, "Invalid or expired OTP.");
  }

  const submittedHash = hashOtp(
    challengeId,
    "password-recovery",
    code
  );

  const valid = matchesOtpHash(record.otpHash, submittedHash);

  if (!valid || !(await User.exists(accountFilter(record)))) {
    return fail(res, "Invalid or expired OTP.");
  }

  const resetToken = randomBytes(32).toString("hex");

  // Only one request can successfully verify this challenge.
  const verified = await PasswordReset.findOneAndUpdate(
    {
      ...pendingFilter(challengeId),
      expiresAt: { $gt: new Date() },
      otpHash: record.otpHash,
      attempts: { $lte: 5 }
    },
    {
      $set: {
        verifiedAt: new Date(),
        resetTokenHash: hashToken(resetToken),
        resetExpiresAt: new Date(Date.now() + OTP_TIME)
      }
    },
    { new: true }
  );

  if (!verified) {
    return fail(res, "OTP already verified or expired.");
  }

  return res.json({
    success: true,
    message: "OTP verified. Enter your new password.",
    data: {
      verified: true,
      challengeId,
      resetToken,
      resetExpiresAt: verified.resetExpiresAt
    }
  });
}

// 4. Reset password
export async function resetPassword(req, res) {
  const { challengeId, resetToken, password } = req.body;

  const filter = {
    _id: challengeId,
    usedAt: null,
    verifiedAt: { $ne: null },
    resetTokenHash: hashToken(resetToken),
    resetExpiresAt: { $gt: new Date() }
  };

  const record = await PasswordReset.findOne(filter);

  if (!record?.userId) {
    return fail(res, "Invalid or expired reset request.");
  }

  // Hash the new password.
  const passwordHash = await hashPassword(password);

  // Update only if the account is still eligible and unchanged.
  const user = await User.findOneAndUpdate(
    accountFilter(record),
    {
      $set: { passwordHash },
      $inc: { authVersion: 1 }
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    return fail(res, "Reset request is no longer valid.");
  }

  // Mark the reset token as used after updating the password.
  await PasswordReset.updateOne(
    { _id: record._id, usedAt: null },
    {
      $set: { usedAt: new Date() },
      $unset: { resetTokenHash: 1 }
    }
  );

  return res.json({
    success: true,
    message: "Password reset successfully. Please sign in.",
    data: { reset: true }
  });
}