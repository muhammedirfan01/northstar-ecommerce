import { RestrictionCode } from "../constants/statuses.js";
import { checkLogin } from "../utils/validators/login.js";
// Application steps. Input is a plain object; the controller sends the response.
import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { publicUser } from "../utils/user.js";
import { randomBytes } from "node:crypto";
const dummyHash = hashPassword(randomBytes(32).toString("hex"));

// Login
export async function startLogin(input) {
  input.body = checkLogin(input.body);
  const { email, password } = input.body;
  const user = await User.findOne({
    email,
  }).select("+passwordHash +googleId +authVersion");
  const isValid = await verifyPassword(
    user?.passwordHash || (await dummyHash),
    password,
  );
  if (!user?.passwordHash || !isValid) {
    return {
      status: 401,
      body: {
        success: false,
        message: "Invalid email or password",
      },
    };
  }
  if (user.isBlocked || user.deletedAt) {
    return {
      status: 403,
      body: {
        success: false,
        code: user.deletedAt ? RestrictionCode.DELETED : RestrictionCode.BLOCKED,
        message: "Your account is restricted",
      },
    };
  }
  if (!user.isEmailVerified) {
    return {
      status: 403,
      body: {
        success: false,
        message: "Please verify your email",
      },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      data: {
        user: publicUser(user, input.apiBaseUrl),
      },
    },
    authUser: user,
  };
}

// Get logged-in user
