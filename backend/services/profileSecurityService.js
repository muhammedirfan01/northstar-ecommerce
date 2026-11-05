import {
  checkProfileEmail,
  checkProfileEmailCodes,
  checkPasswordRequest,
  checkProfilePassword,
  checkProfileResend,
} from "../utils/validators/profile.js";
// Application steps. Input is a plain object; the controller sends the response.
import User from "../models/User.js";
import ProfileVerification from "../models/ProfileVerification.js";
import sendOtpEmail from "../services/emailService.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
import { generateOtp, hashOtp, matchesOtpHash } from "../utils/otp.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { publicUser } from "../utils/user.js";
const OTP_TIME = 5 * 60 * 1000;
const COOLDOWN = 60 * 1000;
const MAX_AGE = 30 * 60 * 1000;
function fail(message, status = 400) {
  return {
    status: status,
    body: {
      success: false,
      message,
    },
  };
}
function timing(record) {
  return {
    challengeId: record.id,
    expiresAt: record.expiresAt,
    expiresIn: 300,
    resendAfter: 60,
    sent: true,
  };
}
function makeCode(record, type) {
  const code = generateOtp();
  const hash = hashOtp(record.id, `${record.purpose}:${type}`, code);
  return {
    code,
    hash,
  };
}
async function sendCodes(record, currentCode, newCode) {
  let purpose;
  if (record.purpose === "email-change") {
    purpose = "email-change-current";
  } else {
    purpose = "password-change";
  }
  await sendOtpEmail(record.currentEmail, currentCode, purpose);
  if (record.newEmail) {
    await sendOtpEmail(record.newEmail, newCode, "email-change-new");
  }
}
async function startVerification(input, purpose, newEmail, passwordHash) {
  const now = new Date();
  await ProfileVerification.deleteOne({
    userId: input.user.id,
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
  const record = new ProfileVerification({
    userId: input.user.id,
    purpose,
    currentEmail: input.user.email,
    newEmail,
    pendingPasswordHash: passwordHash,
    authVersion: input.user.authVersion ?? 0,
    expiresAt: new Date(Date.now() + OTP_TIME),
    resendAvailableAt: new Date(Date.now() + COOLDOWN),
  });
  const current = makeCode(record, "current");
  record.currentCodeHash = current.hash;
  let next;
  if (newEmail) {
    next = makeCode(record, "new");
    record.newCodeHash = next.hash;
  }
  try {
    await record.save();
    await sendCodes(record, current.code, next?.code);
  } catch (error) {
    if (error.code === 11000) {
      return fail("Wait before requesting another code.", 429);
    }
    if (record._id) {
      await ProfileVerification.deleteOne({
        _id: record._id,
        currentCodeHash: record.currentCodeHash,
      });
    }
    return fail("Could not send verification codes.", 503);
  }
  return {
    status: 202,
    body: {
      success: true,
      message: "Verification codes sent.",
      data: timing(record),
    },
  };
}
async function verifyCodes(input, purpose) {
  const filter = {
    _id: input.body.challengeId,
    userId: input.user.id,
    purpose,
    currentEmail: input.user.email,
    authVersion: input.user.authVersion ?? 0,
    usedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
    createdAt: {
      $gt: new Date(Date.now() - MAX_AGE),
    },
  };
  const record = await ProfileVerification.findOneAndUpdate(
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
  if (!record) {
    return null;
  }
  const currentHash = hashOtp(
    record.id,
    `${purpose}:current`,
    input.body.currentCode || input.body.code,
  );
  if (!matchesOtpHash(record.currentCodeHash, currentHash)) {
    return null;
  }
  if (purpose === "email-change") {
    const newHash = hashOtp(record.id, `${purpose}:new`, input.body.newCode);
    if (!matchesOtpHash(record.newCodeHash, newHash)) {
      return null;
    }
  }

  // Only one request can consume the verification.
  return ProfileVerification.findOneAndUpdate(
    {
      ...filter,
      currentCodeHash: record.currentCodeHash,
      newCodeHash: record.newCodeHash,
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
export async function requestEmailChange(input) {
  input.body = checkProfileEmail(input.body);
  const { newEmail, currentPassword } = input.body;
  if (
    input.user.passwordHash &&
    (!currentPassword ||
      !(await verifyPassword(input.user.passwordHash, currentPassword)))
  ) {
    return fail("Incorrect current password.", 401);
  }
  if (newEmail === input.user.email) {
    return fail("Enter a different email.");
  }
  if (
    await User.exists({
      email: newEmail,
    })
  ) {
    return fail("Email already in use.", 409);
  }
  return startVerification(input, "email-change", newEmail);
}

// Verify and update email
export async function verifyEmailChange(input) {
  input.body = checkProfileEmailCodes(input.body);
  const record = await verifyCodes(input, "email-change");
  if (!record) {
    return fail("Invalid or expired OTP.");
  }
  let user;
  try {
    user = await User.findOneAndUpdate(
      activeAccountFilter(
        input.user.id,
        record.currentEmail,
        input.user.authVersion,
      ),
      {
        $set: {
          email: record.newEmail,
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
      return fail("Email already in use.", 409);
    }
    throw error;
  }
  if (!user) {
    return fail("Account changed. Try again.", 409);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "Email updated.",
      data: {
        user: publicUser(user, input.apiBaseUrl),
        verified: true,
      },
    },
    authUser: user,
  };
}

// Request password change
export async function requestPasswordChange(input) {
  input.body = checkPasswordRequest(input.body);
  const { newPassword } = input.body;
  if (
    input.user.passwordHash &&
    (await verifyPassword(input.user.passwordHash, newPassword))
  ) {
    return fail("Choose a different password.");
  }
  const passwordHash = await hashPassword(newPassword);
  return startVerification(input, "password-change", undefined, passwordHash);
}

// Verify and update password
export async function changePassword(input) {
  input.body = checkProfilePassword(input.body);
  const record = await verifyCodes(input, "password-change");
  if (!record?.pendingPasswordHash) {
    return fail("Invalid or expired OTP.");
  }
  const user = await User.findOneAndUpdate(
    activeAccountFilter(
      input.user.id,
      input.user.email,
      input.user.authVersion,
    ),
    {
      $set: {
        passwordHash: record.pendingPasswordHash,
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
    return fail("Account changed. Try again.", 409);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "Password updated.",
      data: {
        user: publicUser(user, input.apiBaseUrl),
        verified: true,
      },
    },
    authUser: user,
  };
}

// Resend security OTP
export async function resendSecurityCode(input) {
  input.body = checkProfileResend(input.body);
  const record = await ProfileVerification.findOne({
    _id: input.body.challengeId,
    userId: input.user.id,
    currentEmail: input.user.email,
    authVersion: input.user.authVersion ?? 0,
    usedAt: null,
    attempts: {
      $lt: 5,
    },
    resendCount: {
      $lt: 3,
    },
    createdAt: {
      $gt: new Date(Date.now() - MAX_AGE + OTP_TIME),
    },
  }).select("+currentCodeHash +newCodeHash");
  if (!record) {
    return fail("Verification expired. Start again.");
  }
  const wait = Math.ceil(
    (record.resendAvailableAt.getTime() - Date.now()) / 1000,
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
  const oldCurrentHash = record.currentCodeHash;
  const oldNewHash = record.newCodeHash;
  let current;
  do {
    current = makeCode(record, "current");
  } while (current.hash === oldCurrentHash);
  let next;
  if (record.newEmail) {
    do {
      next = makeCode(record, "new");
    } while (next.hash === oldNewHash);
  }
  const updated = await ProfileVerification.findOneAndUpdate(
    {
      _id: record.id,
      userId: input.user.id,
      currentEmail: input.user.email,
      authVersion: input.user.authVersion ?? 0,
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
        $gt: new Date(Date.now() - MAX_AGE + OTP_TIME),
      },
    },
    {
      $set: {
        currentCodeHash: current.hash,
        newCodeHash: next?.hash,
        expiresAt: new Date(Date.now() + OTP_TIME),
        resendAvailableAt: new Date(Date.now() + COOLDOWN),
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
    return fail("Request changed. Try again.", 409);
  }
  try {
    await sendCodes(updated, current.code, next?.code);
  } catch {
    return fail("Could not resend codes.", 503);
  }
  return {
    status: 200,
    body: {
      success: true,
      message: "New verification codes sent.",
      data: timing(updated),
    },
  };
}
