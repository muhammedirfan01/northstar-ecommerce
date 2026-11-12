// Send a reset code, verify it and save the new password.

import { randomBytes, createHash } from "node:crypto";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import sendOtpEmail from "./emailService.js";
import { generateOtp, hashOtp, otpHashesMatch } from "../utils/otp.js";
import { hashPassword } from "../utils/password.js";
import { getActiveUserFilter } from "../utils/activeAccount.js";
import { createValidationError } from "../utils/validation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { validateEmail, validatePassword, validateVerificationId, validateOtp } from "../utils/accountValidation.js";

// The controller passes request data here and sends the result back to the browser.

const OTP_VALID_FOR_MS = 5 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const VERIFICATION_VALID_FOR_MS = 30 * 60 * 1000;
const hashResetToken = (token) => createHash("sha256").update(token).digest("hex");
function errorResponse(message, status = 400) {
  return {
    status: status,
    body: {
      success: false,
      message,
    },
  };
}
function getResetUserFilter(verification) {
  return {
    ...getActiveUserFilter(verification.userId, verification.email, verification.authVersion),
    googleId: {
      $exists: false,
    },
  };
}
function getUnusedResetFilter(challengeId) {
  return {
    _id: challengeId,
    usedAt: null,
    verifiedAt: null,
    createdAt: {
      $gt: new Date(Date.now() - VERIFICATION_VALID_FOR_MS),
    },
  };
}
function getResetTimes(verification) {
  return {
    challengeId: verification.id,
    expiresAt: verification.expiresAt,
    expiresIn: 300,
    resendAfter: 60,
  };
}
async function sendResetCode(verification, code) {
  if (verification.userId && (await User.exists(getResetUserFilter(verification)))) {
    await sendOtpEmail(verification.email, code, "password-recovery");
  }
}

// 1. Request password recovery
export async function requestPasswordReset(requestData) {
  requestData.body = validateResetEmail(requestData.body);
  const { email } = requestData.body;
  const now = new Date();

  // Remove an old reset request only when its saved dates and status allow it.
  await PasswordReset.deleteOne({
    email,
    $or: [
      {
        usedAt: {
          $ne: null,
        },
      },
      {
        verifiedAt: null,
        resendAvailableAt: {
          $lte: now,
        },
      },
      {
        resetExpiresAt: {
          $lte: now,
        },
      },
    ],
  });
  const user = await User.findOne({
    email,
    googleId: {
      $exists: false,
    },
    isEmailVerified: true,
    isBlocked: false,
    deletedAt: null,
  }).select("+authVersion");
  const code = generateOtp();
  const verification = new PasswordReset({
    email,
    userId: user?._id,
    authVersion: user?.authVersion ?? 0,
    expiresAt: new Date(Date.now() + OTP_VALID_FOR_MS),
    resendAvailableAt: new Date(Date.now() + OTP_RESEND_WAIT_MS),
  });
  verification.otpHash = hashOtp(verification.id, "password-recovery", code);
  try {
    await verification.save();
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse("Please wait before requesting another code.", 429);
    }
    throw error;
  }
  try {
    await sendResetCode(verification, code);
  } catch {
    return errorResponse("Unable to send the recovery email. Try again later.", 503);
  }
  return {
    status: 202,
    body: {
      success: true,
      message: "If the account exists, a recovery code has been sent.",
      data: getResetTimes(verification),
    },
  };
}

// 2. Resend OTP
export async function resendPasswordResetOtp(requestData) {
  requestData.body = validateResetResend(requestData.body);
  const { challengeId } = requestData.body;
  const verification = await PasswordReset.findOne({
    ...getUnusedResetFilter(challengeId),
    attempts: {
      $lt: 5,
    },
    resendCount: {
      $lt: 3,
    },
  }).select("+otpHash");
  if (!verification) {
    return errorResponse("Start password recovery again.");
  }
  const wait = Math.ceil(
    (verification.resendAvailableAt.getTime() - Date.now()) / 1000,
  );
  if (wait > 0) {
    return {
      status: 429,
      body: {
        success: false,
        message: `Wait ${wait} seconds before resending.`,
        data: {
          resendAfter: wait,
        },
      },
    };
  }
  let code;
  let newHash;
  do {
    code = generateOtp();
    newHash = hashOtp(challengeId, "password-recovery", code);
  } while (newHash === verification.otpHash);
  const updated = await PasswordReset.findOneAndUpdate(
    {
      ...getUnusedResetFilter(challengeId),
      attempts: {
        $lt: 5,
      },
      resendCount: {
        $lt: 3,
      },
      otpHash: verification.otpHash,
      resendAvailableAt: {
        $lte: new Date(),
      },
    },
    {
      $set: {
        otpHash: newHash,
        expiresAt: new Date(Date.now() + OTP_VALID_FOR_MS),
        resendAvailableAt: new Date(Date.now() + OTP_RESEND_WAIT_MS),
      },
      $inc: {
        resendCount: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );
  if (!updated) {
    return errorResponse("Recovery request changed. Try again.", 409);
  }
  try {
    await sendResetCode(updated, code);
  } catch {
    return errorResponse("Unable to send the code. Try again later.", 503);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "A new code has been sent if the account is eligible.",
      data: {
        ...getResetTimes(updated),
        sent: true,
      },
    },
  };
}

// 3. Verify OTP
export async function verifyPasswordResetOtp(requestData) {
  requestData.body = validateResetOtp(requestData.body);
  const { challengeId, code } = requestData.body;
  const verification = await PasswordReset.findOneAndUpdate(
    {
      ...getUnusedResetFilter(challengeId),
      expiresAt: {
        $gt: new Date(),
      },
      attempts: {
        $lt: 5,
      },
    },
    {
      $inc: {
        attempts: 1,
      },
    },
    {
      returnDocument: "after",
    },
  ).select("+otpHash");
  if (!verification?.userId) {
    return errorResponse("Invalid or expired OTP.");
  }
  const submittedHash = hashOtp(challengeId, "password-recovery", code);
  const valid = otpHashesMatch(verification.otpHash, submittedHash);
  if (!valid || !(await User.exists(getResetUserFilter(verification)))) {
    return errorResponse("Invalid or expired OTP.");
  }
  const resetToken = randomBytes(32).toString("hex");

  // Allow this reset request to be verified only once.
  const verified = await PasswordReset.findOneAndUpdate(
    {
      ...getUnusedResetFilter(challengeId),
      expiresAt: {
        $gt: new Date(),
      },
      otpHash: verification.otpHash,
      attempts: {
        $lte: 5,
      },
    },
    {
      $set: {
        verifiedAt: new Date(),
        resetTokenHash: hashResetToken(resetToken),
        resetExpiresAt: new Date(Date.now() + OTP_VALID_FOR_MS),
      },
    },
    {
      returnDocument: "after",
    },
  );
  if (!verified) {
    return errorResponse("OTP already verified or expired.");
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "OTP verified. Enter your new password.",
      data: {
        verified: true,
        challengeId,
        resetToken,
        resetExpiresAt: verified.resetExpiresAt,
      },
    },
  };
}

// 4. Reset password
export async function resetPassword(requestData) {
  requestData.body = validateNewPasswordForm(requestData.body);
  const { challengeId, resetToken, password } = requestData.body;
  const filter = {
    _id: challengeId,
    usedAt: null,
    verifiedAt: {
      $ne: null,
    },
    resetTokenHash: hashResetToken(resetToken),
    resetExpiresAt: {
      $gt: new Date(),
    },
  };
  const verification = await PasswordReset.findOne(filter);
  if (!verification?.userId) {
    return errorResponse("Invalid or expired reset request.");
  }

  // Hash the new password.
  const passwordHash = await hashPassword(password);

  // Update only if the account is still active and its login version has not changed.
  const user = await User.findOneAndUpdate(
    getResetUserFilter(verification),
    {
      $set: {
        passwordHash,
      },
      $inc: {
        authVersion: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );
  if (!user) {
    return errorResponse("Reset request is no longer valid.");
  }

  // Mark the reset token as used after updating the password.
  await PasswordReset.updateOne(
    {
      _id: verification._id,
      usedAt: null,
    },
    {
      $set: {
        usedAt: new Date(),
      },
      $unset: {
        resetTokenHash: 1,
      },
    },
  );
  return {
    status: 200,
    body: {
      success: true,
      message: "Password reset successfully. Please sign in.",
      data: {
        reset: true,
      },
    },
  };
}

export function validateResetEmail(formData) {
  validateFormFields(formData, ["email"]);
  return {
    email: validateEmail(formData.email),
  };
}
export function validateResetResend(formData) {
  validateFormFields(formData, ["challengeId"]);
  return {
    challengeId: validateVerificationId(formData.challengeId, true),
  };
}
export function validateResetOtp(formData) {
  validateFormFields(formData, ["challengeId", "code"]);
  const challengeId = validateVerificationId(formData.challengeId, true);
  const code = validateOtp(formData.code);
  return {
    challengeId,
    code,
  };
}
export function validateNewPasswordForm(formData) {
  validateFormFields(formData, [
    "challengeId",
    "resetToken",
    "password",
    "confirmPassword",
  ]);
  const challengeId = validateVerificationId(formData.challengeId, true);
  const resetToken = formData.resetToken;
  if (typeof resetToken !== "string" || !/^[a-f0-9]{64}$/i.test(resetToken)) {
    throw createValidationError("Invalid resetToken.", "resetToken");
  }
  const password = validatePassword(formData.password, "password");
  const confirmPassword = validatePassword(
    formData.confirmPassword,
    "confirmPassword",
  );
  if (password !== confirmPassword) {
    throw createValidationError("Passwords do not match.", "form");
  }
  return {
    challengeId,
    resetToken,
    password,
    confirmPassword,
  };
}
