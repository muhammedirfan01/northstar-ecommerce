import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { issueAuthCookie, clearAuthCookie } from "../utils/jwt.js";
import { publicUser } from "../middlewares/auth.js";
import { randomBytes } from "node:crypto";

const dummyHash = hashPassword(randomBytes(32).toString("hex"));

// Login
export async function startLogin(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+passwordHash +googleId");

  const isValid = await verifyPassword(
    user?.passwordHash || await dummyHash,
    password
  );

  if (!user?.passwordHash || !isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  }

  if (user.isBlocked || user.deletedAt) {
    return res.status(403).json({
      success: false,
      code: user.deletedAt ? "ACCOUNT_DELETED" : "ACCOUNT_BLOCKED",
      message: "Your account is restricted"
    });
  }

  if (!user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email"
    });
  }

  issueAuthCookie(res, user);

  return res.json({
    success: true,
    data: { user: publicUser(user) }
  });
}

// Get logged-in user
export function currentUser(req, res) {
  return res.json({
    success: true,
    data: { user: publicUser(req.user) }
  });
}

// Logout
export function logout(req, res) {
  clearAuthCookie(res);

  return res.json({
    success: true,
    message: "Logged out successfully"
  });
}

