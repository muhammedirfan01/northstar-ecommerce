// Check the email and password used to sign in.

import { RestrictionCode } from "../constants/statuses.js";
import User from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { formatUser } from "../utils/user.js";
import { randomBytes } from "node:crypto";
import { validateForm } from "../utils/formValidation.js";
import { validateEmail, validatePassword } from "../utils/accountValidation.js";

// The controller passes request data here and sends the result back to the browser.

const dummyHash = hashPassword(randomBytes(32).toString("hex"));

// Login
export async function startLogin(requestData) {
  requestData.body = validateLoginForm(requestData.body);
  const { email, password } = requestData.body;
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
        user: formatUser(user, requestData.apiBaseUrl),
      },
    },
    authUser: user,
  };
}

// Get logged-in user

export function validateLoginForm(formData) {
  validateForm(formData);
  const email = validateEmail(formData.email);
  const password = validatePassword(formData.password, "password", 1);
  return {
    email,
    password,
  };
}
