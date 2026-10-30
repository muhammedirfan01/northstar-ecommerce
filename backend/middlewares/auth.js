import User from "../models/User.js";
import { readToken, clearAuthCookie } from "../utils/jwt.js";

// Return user details without sensitive information
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    profileImage: user.profileImage || "",
    isEmailVerified: user.isEmailVerified,
    isGoogleAccount: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash)
  };
}

// Check whether the user is logged in
export async function requireAuth(req, res, next) {
  const token = readToken(req);

  if (!token?.userId || !/^[a-f0-9]{24}$/i.test(token.userId)) {
    clearAuthCookie(res);

    return res.status(401).json({
      success: false,
      message: "Please sign in."
    });
  }

  const user = await User.findById(token.userId)
    .select("+passwordHash +authVersion +googleId");

  if (!user || !user.isEmailVerified) {
    clearAuthCookie(res);

    return res.status(401).json({
      success: false,
      message: "Please sign in again."
    });
  }

  if (user.isBlocked || user.deletedAt) {
    return res.status(403).json({
      success: false,
      code: user.deletedAt ? "ACCOUNT_DELETED" : "ACCOUNT_BLOCKED",
      message: "Your account is restricted."
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
      message: "Admin access required."
    });
  }

  next();
}
// Google manages the email and password for Google accounts.
export function requirePasswordAccount(req, res, next) {
  if (req.user.googleId) {
    return res.status(403).json({ success: false, message: "Manage your email and password in your Google account." });
  }
  next();
}
