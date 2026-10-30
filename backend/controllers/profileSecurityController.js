import User from "../models/User.js";
import ProfileVerification from "../models/ProfileVerification.js";
import sendOtpEmail from "../utils/sendOtpEmail.js";
import { activeAccountFilter } from "../utils/activeAccount.js";
import { generateOtp, hashOtp, matchesOtpHash } from "../utils/otp.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { issueAuthCookie } from "../utils/jwt.js";
import { publicUser } from "../middlewares/auth.js";

const OTP_TIME = 5 * 60 * 1000;
const COOLDOWN = 60 * 1000;
const MAX_AGE = 30 * 60 * 1000;

function fail(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

function timing(record) {
  return {
    challengeId: record.id,
    expiresAt: record.expiresAt,
    expiresIn: 300,
    resendAfter: 60,
    sent: true
  };
}

function makeCode(record, type) {
  const code = generateOtp();
  const hash = hashOtp(record.id, `${record.purpose}:${type}`, code);
  return { code, hash };
}

async function sendCodes(record, currentCode, newCode) {
  const purpose = record.purpose === "email-change"
    ? "email-change-current"
    : "password-change";

  await sendOtpEmail(record.currentEmail, currentCode, purpose);

  if (record.newEmail) {
    await sendOtpEmail(record.newEmail, newCode, "email-change-new");
  }
}

async function startVerification(req, res, purpose, newEmail, passwordHash) {
  const now = new Date();

  await ProfileVerification.deleteOne({
    userId: req.user.id,
    purpose,
    $or: [
      { usedAt: { $ne: null } },
      { resendAvailableAt: { $lte: now } }
    ]
  });

  const record = new ProfileVerification({
    userId: req.user.id,
    purpose,
    currentEmail: req.user.email,
    newEmail,
    pendingPasswordHash: passwordHash,
    authVersion: req.user.authVersion ?? 0,
    expiresAt: new Date(Date.now() + OTP_TIME),
    resendAvailableAt: new Date(Date.now() + COOLDOWN)
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
      return fail(res, "Wait before requesting another code.", 429);
    }

    if (record._id) {
      await ProfileVerification.deleteOne({
        _id: record._id,
        currentCodeHash: record.currentCodeHash
      });
    }

    return fail(res, "Could not send verification codes.", 503);
  }

  return res.status(202).json({
    success: true,
    message: "Verification codes sent.",
    data: timing(record)
  });
}

async function verifyCodes(req, purpose) {
  const filter = {
    _id: req.body.challengeId,
    userId: req.user.id,
    purpose,
    currentEmail: req.user.email,
    authVersion: req.user.authVersion ?? 0,
    usedAt: null,
    expiresAt: { $gt: new Date() },
    createdAt: { $gt: new Date(Date.now() - MAX_AGE) }
  };

  const record = await ProfileVerification.findOneAndUpdate(
    {
      ...filter,
      attempts: { $lt: 5 }
    },
    { $inc: { attempts: 1 } },
    { new: true }
  ).select("+currentCodeHash +newCodeHash +pendingPasswordHash");

  if (!record) return null;

  const currentHash = hashOtp(
    record.id,
    `${purpose}:current`,
    req.body.currentCode || req.body.code
  );

  if (!matchesOtpHash(record.currentCodeHash, currentHash)) {
    return null;
  }

  if (purpose === "email-change") {
    const newHash = hashOtp(
      record.id,
      `${purpose}:new`,
      req.body.newCode
    );

    if (!matchesOtpHash(record.newCodeHash, newHash)) {
      return null;
    }
  }

  // Only one request can consume the verification.
  return ProfileVerification.findOneAndUpdate(
    {
      ...filter,
      currentCodeHash: record.currentCodeHash,
      newCodeHash: record.newCodeHash
    },
    { $set: { usedAt: new Date() } },
    { new: true }
  ).select("+pendingPasswordHash");
}

// Request email change
export async function requestEmailChange(req, res) {
  const { newEmail, currentPassword } = req.body;

  if (
    req.user.passwordHash &&
    (!currentPassword ||
      !(await verifyPassword(req.user.passwordHash, currentPassword)))
  ) {
    return fail(res, "Incorrect current password.", 401);
  }

  if (newEmail === req.user.email) {
    return fail(res, "Enter a different email.");
  }

  if (await User.exists({ email: newEmail })) {
    return fail(res, "Email already in use.", 409);
  }

  return startVerification(req, res, "email-change", newEmail);
}

// Verify and update email
export async function verifyEmailChange(req, res) {
  const record = await verifyCodes(req, "email-change");

  if (!record) return fail(res, "Invalid or expired OTP.");

  let user;

  try {
    user = await User.findOneAndUpdate(
      activeAccountFilter(
        req.user.id,
        record.currentEmail,
        req.user.authVersion
      ),
      {
        $set: { email: record.newEmail },
        $inc: { authVersion: 1 }
      },
      { new: true, runValidators: true }
    ).select("+passwordHash +googleId");
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, "Email already in use.", 409);
    }
    throw error;
  }

  if (!user) return fail(res, "Account changed. Try again.", 409);

  issueAuthCookie(res, user);

  return res.json({
    success: true,
    message: "Email updated.",
    data: { user: publicUser(user), verified: true }
  });
}

// Request password change
export async function requestPasswordChange(req, res) {
  const { newPassword } = req.body;

  if (
    req.user.passwordHash &&
    await verifyPassword(req.user.passwordHash, newPassword)
  ) {
    return fail(res, "Choose a different password.");
  }

  const passwordHash = await hashPassword(newPassword);

  return startVerification(
    req,
    res,
    "password-change",
    undefined,
    passwordHash
  );
}

// Verify and update password
export async function changePassword(req, res) {
  const record = await verifyCodes(req, "password-change");

  if (!record?.pendingPasswordHash) {
    return fail(res, "Invalid or expired OTP.");
  }

  const user = await User.findOneAndUpdate(
    activeAccountFilter(
      req.user.id,
      req.user.email,
      req.user.authVersion
    ),
    {
      $set: { passwordHash: record.pendingPasswordHash },
      $inc: { authVersion: 1 }
    },
    { new: true, runValidators: true }
  ).select("+passwordHash +googleId");

  if (!user) return fail(res, "Account changed. Try again.", 409);

  issueAuthCookie(res, user);

  return res.json({
    success: true,
    message: "Password updated.",
    data: { user: publicUser(user), verified: true }
  });
}

// Resend security OTP
export async function resendSecurityCode(req, res) {
  const record = await ProfileVerification.findOne({
    _id: req.body.challengeId,
    userId: req.user.id,
    currentEmail: req.user.email,
    authVersion: req.user.authVersion ?? 0,
    usedAt: null,
    attempts: { $lt: 5 },
    resendCount: { $lt: 3 },
    createdAt: { $gt: new Date(Date.now() - MAX_AGE + OTP_TIME) }
  }).select("+currentCodeHash +newCodeHash");

  if (!record) return fail(res, "Verification expired. Start again.");

  const wait = Math.ceil(
    (record.resendAvailableAt.getTime() - Date.now()) / 1000
  );

  if (wait > 0) {
    return res.status(429).json({
      success: false,
      message: `Wait ${wait} seconds.`,
      data: { resendAfter: wait }
    });
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
      userId: req.user.id,
      currentEmail: req.user.email,
      authVersion: req.user.authVersion ?? 0,
      usedAt: null,
      attempts: { $lt: 5 },
      resendCount: { $lt: 3 },
      currentCodeHash: oldCurrentHash,
      newCodeHash: oldNewHash,
      resendAvailableAt: { $lte: new Date() },
      createdAt: { $gt: new Date(Date.now() - MAX_AGE + OTP_TIME) }
    },
    {
      $set: {
        currentCodeHash: current.hash,
        newCodeHash: next?.hash,
        expiresAt: new Date(Date.now() + OTP_TIME),
        resendAvailableAt: new Date(Date.now() + COOLDOWN)
      },
      $inc: { resendCount: 1 }
    },
    { new: true }
  );

  if (!updated) return fail(res, "Request changed. Try again.", 409);

  try {
    await sendCodes(updated, current.code, next?.code);
  } catch {
    return fail(res, "Could not resend codes.", 503);
  }

  return res.json({
    success: true,
    message: "New verification codes sent.",
    data: timing(updated)
  });
}