// Verify codes before changing an account email or password.

import User from "../models/User.js";
import ProfileVerification from "../models/ProfileVerification.js";
import sendOtpEmail from "./emailService.js";
import { getActiveUserFilter } from "../utils/activeAccount.js";
import { generateOtp, hashOtp, otpHashesMatch } from "../utils/otp.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { formatUser } from "../utils/user.js";
import { createValidationError } from "../utils/validation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { validateEmail, validatePassword, validateVerificationId, validateOtp } from "../utils/accountValidation.js";

// The controller passes request data here and sends the result back to the browser.

const OTP_VALID_FOR_MS = 5 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const VERIFICATION_VALID_FOR_MS = 30 * 60 * 1000;
function errorResponse(message, status = 400) {
  return {
    status: status,
    body: {
      success: false,
      message,
    },
  };
}
function getVerificationTimes(verification) {
  return {
    challengeId: verification.id,
    expiresAt: verification.expiresAt,
    expiresIn: 300,
    resendAfter: 60,
    sent: true,
  };
}
function createVerificationCode(verification, type) {
  const code = generateOtp();
  const hash = hashOtp(verification.id, `${verification.purpose}:${type}`, code);
  return {
    code,
    hash,
  };
}
async function sendVerificationCodes(verification, currentCode, newCode) {
  let purpose;
  if (verification.purpose === "email-change") {
    purpose = "email-change-current";
  } else {
    purpose = "password-change";
  }
  await sendOtpEmail(verification.currentEmail, currentCode, purpose);
  if (verification.newEmail) {
    await sendOtpEmail(verification.newEmail, newCode, "email-change-new");
  }
}
async function startVerification(requestData, purpose, newEmail, passwordHash) {
  const now = new Date();
  await ProfileVerification.deleteOne({
    userId: requestData.user.id,
    purpose,
    $or: [
      {
        usedAt: {
          $ne: null,
        },
      },
      {
        resendAvailableAt: {
          $lte: now,
        },
      },
    ],
  });
  const verification = new ProfileVerification({
    userId: requestData.user.id,
    purpose,
    currentEmail: requestData.user.email,
    newEmail,
    pendingPasswordHash: passwordHash,
    authVersion: requestData.user.authVersion ?? 0,
    expiresAt: new Date(Date.now() + OTP_VALID_FOR_MS),
    resendAvailableAt: new Date(Date.now() + OTP_RESEND_WAIT_MS),
  });
  const current = createVerificationCode(verification, "current");
  verification.currentCodeHash = current.hash;
  let next;
  if (newEmail) {
    next = createVerificationCode(verification, "new");
    verification.newCodeHash = next.hash;
  }
  try {
    await verification.save();
    await sendVerificationCodes(verification, current.code, next?.code);
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse("Wait before requesting another code.", 429);
    }
    if (verification._id) {
      await ProfileVerification.deleteOne({
        _id: verification._id,
        currentCodeHash: verification.currentCodeHash,
      });
    }
    return errorResponse("Could not send verification codes.", 503);
  }
  return {
    status: 202,
    body: {
      success: true,
      message: "Verification codes sent.",
      data: getVerificationTimes(verification),
    },
  };
}
async function verifySubmittedCodes(requestData, purpose) {
  const filter = {
    _id: requestData.body.challengeId,
    userId: requestData.user.id,
    purpose,
    currentEmail: requestData.user.email,
    authVersion: requestData.user.authVersion ?? 0,
    usedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
    createdAt: {
      $gt: new Date(Date.now() - VERIFICATION_VALID_FOR_MS),
    },
  };
  const verification = await ProfileVerification.findOneAndUpdate(
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
  ).select("+currentCodeHash +newCodeHash +pendingPasswordHash");
  if (!verification) {
    return null;
  }
  const currentHash = hashOtp(
    verification.id,
    `${purpose}:current`,
    requestData.body.currentCode || requestData.body.code,
  );
  if (!otpHashesMatch(verification.currentCodeHash, currentHash)) {
    return null;
  }
  if (purpose === "email-change") {
    const newHash = hashOtp(verification.id, `${purpose}:new`, requestData.body.newCode);
    if (!otpHashesMatch(verification.newCodeHash, newHash)) {
      return null;
    }
  }

  // Allow these verification codes to be used only once.
  return ProfileVerification.findOneAndUpdate(
    {
      ...filter,
      currentCodeHash: verification.currentCodeHash,
      newCodeHash: verification.newCodeHash,
    },
    {
      $set: {
        usedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    },
  ).select("+pendingPasswordHash");
}

// Request email change
export async function requestEmailChange(requestData) {
  requestData.body = validateEmailChangeForm(requestData.body);
  const { newEmail, currentPassword } = requestData.body;
  if (
    requestData.user.passwordHash &&
    (!currentPassword ||
      !(await verifyPassword(requestData.user.passwordHash, currentPassword)))
  ) {
    return errorResponse("Incorrect current password.", 401);
  }
  if (newEmail === requestData.user.email) {
    return errorResponse("Enter a different email.");
  }
  if (
    await User.exists({
      email: newEmail,
    })
  ) {
    return errorResponse("Email already in use.", 409);
  }
  return startVerification(requestData, "email-change", newEmail);
}

// Verify and update email
export async function verifyEmailChange(requestData) {
  requestData.body = validateEmailChangeCodes(requestData.body);
  const verification = await verifySubmittedCodes(requestData, "email-change");
  if (!verification) {
    return errorResponse("Invalid or expired OTP.");
  }
  let user;
  try {
    user = await User.findOneAndUpdate(
      getActiveUserFilter(
        requestData.user.id,
        verification.currentEmail,
        requestData.user.authVersion,
      ),
      {
        $set: {
          email: verification.newEmail,
        },
        $inc: {
          authVersion: 1,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).select("+passwordHash +googleId +authVersion");
  } catch (error) {
    if (error.code === 11000) {
      return errorResponse("Email already in use.", 409);
    }
    throw error;
  }
  if (!user) {
    return errorResponse("Account changed. Try again.", 409);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "Email updated.",
      data: {
        user: formatUser(user, requestData.apiBaseUrl),
        verified: true,
      },
    },
    authUser: user,
  };
}

// Request password change
export async function requestPasswordChange(requestData) {
  requestData.body = validatePasswordChangeForm(requestData.body);
  const { newPassword } = requestData.body;
  if (
    requestData.user.passwordHash &&
    (await verifyPassword(requestData.user.passwordHash, newPassword))
  ) {
    return errorResponse("Choose a different password.");
  }
  const passwordHash = await hashPassword(newPassword);
  return startVerification(requestData, "password-change", undefined, passwordHash);
}

// Verify and update password
export async function changePassword(requestData) {
  requestData.body = validatePasswordChangeCode(requestData.body);
  const verification = await verifySubmittedCodes(requestData, "password-change");
  if (!verification?.pendingPasswordHash) {
    return errorResponse("Invalid or expired OTP.");
  }
  const user = await User.findOneAndUpdate(
    getActiveUserFilter(
      requestData.user.id,
      requestData.user.email,
      requestData.user.authVersion,
    ),
    {
      $set: {
        passwordHash: verification.pendingPasswordHash,
      },
      $inc: {
        authVersion: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("+passwordHash +googleId +authVersion");
  if (!user) {
    return errorResponse("Account changed. Try again.", 409);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "Password updated.",
      data: {
        user: formatUser(user, requestData.apiBaseUrl),
        verified: true,
      },
    },
    authUser: user,
  };
}

// Resend security OTP
export async function resendSecurityCode(requestData) {
  requestData.body = validateSecurityResend(requestData.body);
  const verification = await ProfileVerification.findOne({
    _id: requestData.body.challengeId,
    userId: requestData.user.id,
    currentEmail: requestData.user.email,
    authVersion: requestData.user.authVersion ?? 0,
    usedAt: null,
    attempts: {
      $lt: 5,
    },
    resendCount: {
      $lt: 3,
    },
    createdAt: {
      $gt: new Date(Date.now() - VERIFICATION_VALID_FOR_MS + OTP_VALID_FOR_MS),
    },
  }).select("+currentCodeHash +newCodeHash");
  if (!verification) {
    return errorResponse("Verification expired. Start again.");
  }
  const wait = Math.ceil(
    (verification.resendAvailableAt.getTime() - Date.now()) / 1000,
  );
  if (wait > 0) {
    return {
      status: 429,
      body: {
        success: false,
        message: `Wait ${wait} seconds.`,
        data: {
          resendAfter: wait,
        },
      },
    };
  }
  const oldCurrentHash = verification.currentCodeHash;
  const oldNewHash = verification.newCodeHash;
  let current;
  do {
    current = createVerificationCode(verification, "current");
  } while (current.hash === oldCurrentHash);
  let next;
  if (verification.newEmail) {
    do {
      next = createVerificationCode(verification, "new");
    } while (next.hash === oldNewHash);
  }
  const updated = await ProfileVerification.findOneAndUpdate(
    {
      _id: verification.id,
      userId: requestData.user.id,
      currentEmail: requestData.user.email,
      authVersion: requestData.user.authVersion ?? 0,
      usedAt: null,
      attempts: {
        $lt: 5,
      },
      resendCount: {
        $lt: 3,
      },
      currentCodeHash: oldCurrentHash,
      newCodeHash: oldNewHash,
      resendAvailableAt: {
        $lte: new Date(),
      },
      createdAt: {
        $gt: new Date(Date.now() - VERIFICATION_VALID_FOR_MS + OTP_VALID_FOR_MS),
      },
    },
    {
      $set: {
        currentCodeHash: current.hash,
        newCodeHash: next?.hash,
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
    return errorResponse("Request changed. Try again.", 409);
  }
  try {
    await sendVerificationCodes(updated, current.code, next?.code);
  } catch {
    return errorResponse("Could not resend codes.", 503);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "New verification codes sent.",
      data: getVerificationTimes(updated),
    },
  };
}

export function validateEmailChangeForm(formData) {
  validateFormFields(formData, ["newEmail", "currentPassword"]);
  const result = {
    newEmail: validateEmail(formData.newEmail, "newEmail", Infinity),
  };
  if (formData.currentPassword !== undefined) {
    if (
      typeof formData.currentPassword !== "string" ||
      formData.currentPassword.length < 1
    ) {
      throw createValidationError("Invalid currentPassword.", "currentPassword");
    }
    result.currentPassword = formData.currentPassword;
  }
  return result;
}

export function validateEmailChangeCodes(formData) {
  validateFormFields(formData, ["challengeId", "currentCode", "newCode"]);
  return {
    challengeId: validateVerificationId(formData.challengeId),
    currentCode: validateOtp(formData.currentCode, "currentCode"),
    newCode: validateOtp(formData.newCode, "newCode"),
  };
}

export function validateSecurityResend(formData) {
  validateFormFields(formData, ["challengeId"]);
  return {
    challengeId: validateVerificationId(formData.challengeId),
  };
}

export function validatePasswordChangeForm(formData) {
  validateFormFields(formData, ["newPassword", "confirmPassword"]);
  const newPassword = validatePassword(formData.newPassword, "newPassword");
  const confirmPassword = validatePassword(
    formData.confirmPassword,
    "confirmPassword",
  );
  if (newPassword !== confirmPassword)
    throw createValidationError("Passwords do not match.", "form");
  return {
    newPassword,
    confirmPassword,
  };
}

export function validatePasswordChangeCode(formData) {
  validateFormFields(formData, ["challengeId", "code"]);
  return {
    challengeId: validateVerificationId(formData.challengeId),
    code: validateOtp(formData.code),
  };
}
