// Verify registration codes and send a new code when allowed.

import { createError } from "../utils/httpError.js";
import sendOtpEmail from "./emailService.js";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import { generateOtp, hashOtp, otpHashesMatch } from "../utils/otp.js";
import { createValidationError } from "../utils/validation.js";

// The controller passes request data here and sends the result back to the browser.

export async function verifyRegistration(requestData) {
  requestData.body = validateRegistrationOtp(requestData.body);
  const body = requestData.body;
  const { challengeId, code } = body;
  const filter = {
    _id: challengeId,
    purpose: "registration",
    usedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
    createdAt: {
      $gt: new Date(Date.now() - VERIFICATION_VALID_FOR_MS),
    },
  };

  // Count every verification attempt
  const verification = await RegistrationOtp.findOneAndUpdate(
    {
      ...filter,
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
  if (!verification) {
    throw createError("Invalid or expired OTP.");
  }
  const submittedHash = hashOtp(verification.id, "registration", code);
  if (!otpHashesMatch(verification.otpHash, submittedHash)) {
    throw createError("Invalid or expired OTP.");
  }

  // Prevent the same OTP from being used twice
  const verified = await RegistrationOtp.findOneAndUpdate(
    {
      ...filter,
      otpHash: verification.otpHash,
    },
    {
      $set: {
        usedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    },
  ).select("+pendingRegistration");
  if (!verified?.pendingRegistration) {
    throw createError("Invalid or expired OTP.");
  }
  const { name, passwordHash } = verified.pendingRegistration;
  try {
    const user = await User.create({
      name,
      email: verified.email,
      passwordHash,
      role: "customer",
      isEmailVerified: true,
    });
    const responseData = {
      verified: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
    return {
      status: 201,
      body: {
        success: true,
        message: "Registration completed. Please sign in.",
        data: responseData,
      },
    };
  } catch (error) {
    if (error.code === 11000) {
      throw createError("This email is already registered.", 409);
    }
    console.error("Registration failed:", error);
    throw createError("Registration failed. Please try again.", 503);
  }
}
export async function resendRegistrationOtp(requestData) {
  requestData.body = validateOtpResend(requestData.body);
  const body = requestData.body;
  const { challengeId } = body;
  const filter = {
    _id: challengeId,
    purpose: "registration",
    usedAt: null,
    attempts: {
      $lt: 5,
    },
    createdAt: {
      $gt: new Date(Date.now() - 25 * 60 * 1000),
    },
  };
  const verification = await RegistrationOtp.findOne(filter).select("+otpHash");
  if (!verification || (verification.resendCount ?? 0) >= 3) {
    throw createError("Start registration again.");
  }
  const wait = Math.ceil(
    (verification.resendAvailableAt.getTime() - Date.now()) / 1000,
  );
  if (wait > 0) {
    throw createError(`Wait ${wait} seconds before resending.`, 429, {
      resendAfter: wait,
    });
  }
  let code;
  let newHash;
  do {
    code = generateOtp();
    newHash = hashOtp(challengeId, "registration", code);
  } while (newHash === verification.otpHash);
  const updated = await RegistrationOtp.findOneAndUpdate(
    {
      ...filter,
      otpHash: verification.otpHash,
      resendAvailableAt: {
        $lte: new Date(),
      },
      $or: [
        {
          resendCount: {
            $lt: 3,
          },
        },
        {
          resendCount: {
            $exists: false,
          },
        },
      ],
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
    throw createError("Please wait before trying again.", 429);
  }
  try {
    await sendOtpEmail(updated.email, code, "registration");
  } catch (error) {
    console.error("OTP email failed:", error);
    throw createError("Unable to send OTP. Try again later.", 503);
  }
  const responseData = {
    challengeId,
    expiresAt: updated.expiresAt,
    expiresIn: 300,
    resendAfter: 60,
  };
  return {
    status: 200,
    body: {
      success: true,
      message: "A new verification code has been sent.",
      data: responseData,
    },
  };
}
const OTP_VALID_FOR_MS = 5 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const VERIFICATION_VALID_FOR_MS = 30 * 60 * 1000;

// Verify registration OTP

export function validateOtpResend(formData) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    throw createValidationError("Invalid form.", "form");
  }
  for (const fieldName of Object.keys(formData)) {
    if (!["challengeId"].includes(fieldName)) {
      throw createValidationError("Unknown form field.", "form");
    }
  }
  const original = formData;
  formData = {};
  let challengeId = original.challengeId;
  if (typeof challengeId !== "string") {
    throw createValidationError("Invalid challengeId.", "challengeId");
  }
  if (!/^[a-f0-9]{24}$/i.test(challengeId)) {
    throw createValidationError("Invalid verification ID", "challengeId");
  }
  challengeId = challengeId.toLowerCase();
  formData.challengeId = challengeId;
  return formData;
}

export function validateRegistrationOtp(formData) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    throw createValidationError("Invalid form.", "form");
  }
  for (const fieldName of Object.keys(formData)) {
    if (!["challengeId", "code"].includes(fieldName)) {
      throw createValidationError("Unknown form field.", "form");
    }
  }
  const original = formData;
  formData = {};
  const challengeId = original.challengeId;
  if (typeof challengeId !== "string") {
    throw createValidationError("Invalid challengeId.", "challengeId");
  }
  if (!/^[a-f0-9]{24}$/i.test(challengeId)) {
    throw createValidationError("Invalid challengeId.", "challengeId");
  }
  formData.challengeId = challengeId;
  const code = original.code;
  if (typeof code !== "string") {
    throw createValidationError("Invalid code.", "code");
  }
  if (!/^\d{6}$/.test(code)) {
    throw createValidationError("Invalid code.", "code");
  }
  formData.code = code;
  return formData;
}
