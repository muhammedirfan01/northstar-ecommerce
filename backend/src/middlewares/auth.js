import { RestrictionCode } from "../constants/statuses.js";
export { formatUser } from "../utils/user.js";
import User from "../models/User.js";
import { getLoginData, clearLoginCookie } from "../utils/jwt.js";

// Return user details without sensitive information

// Check whether the user is logged in
export async function requireAuth(req, res, next) {
  const token = getLoginData(req);
  if (!token?.userId || !/^[a-f0-9]{24}$/i.test(token.userId)) {
    clearLoginCookie(res);
    return res.status(401).json({
      success: false,
      message: "Please sign in.",
    });
  }
  const user = await User.findById(token.userId).select(
    "+passwordHash +authVersion +googleId +profileImagePublicId",
  );
  if (!user || !user.isEmailVerified) {
    clearLoginCookie(res);
    return res.status(401).json({
      success: false,
      message: "Please sign in again.",
    });
  }
  if (user.isBlocked || user.deletedAt) {
    return res.status(403).json({
      success: false,
      code: user.deletedAt ? RestrictionCode.DELETED : RestrictionCode.BLOCKED,
      message: "Your account is restricted.",
    });
  }

  // Password changes and account restrictions increase this session counter.
  if ((token.authVersion ?? 0) !== (user.authVersion ?? 0)) {
    clearLoginCookie(res);
    return res.status(401).json({
      success: false,
      message: "Your session has changed. Please sign in again.",
    });
  }
  req.user = user;
  next();
}

// Check whether the user is an admin
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }
  next();
}
// Google manages the email and password for Google accounts.
export function requirePasswordAccount(req, res, next) {
  if (req.user.googleId) {
    return res.status(403).json({
      success: false,
      message: "Manage your email and password in your Google account.",
    });
  }
  next();
}

export function requireCustomer(req, res, next) {
  if (req.user.role !== "customer") {
    return res
      .status(403)
      .json({ success: false, message: "Use a customer account to shop." });
  }
  next();
}

export function requireAddressCustomer(req, res, next) {
  if (req.user.role !== "customer") {
    return res
      .status(403)
      .json({
        success: false,
        message: "Address management is available for customer accounts.",
      });
  }
  next();
}
