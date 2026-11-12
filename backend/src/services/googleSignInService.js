// Find or create the account for a successful Google sign-in.

import { RestrictionCode } from "../constants/statuses.js";
import { getGoogleProfile } from "./googleAuthService.js";
import User from "../models/User.js";
import { formatUser } from "../utils/user.js";

// The controller passes request data here and sends the result back to the browser.

export async function googleSignIn(requestData) {
  try {
    const { code } = requestData.body;
    if (!code || typeof code !== "string") {
      return {
        status: 400,
        body: {
          success: false,
          message: "Google authorization code is required.",
        },
      };
    }
    const profile = await getGoogleProfile(code);
    if (!profile?.sub || !profile.email || !profile.email_verified) {
      return {
        status: 401,
        body: {
          success: false,
          message: "Google verification failed.",
        },
      };
    }
    let user = await User.findOne({
      googleId: profile.sub,
    }).select("+googleId +passwordHash +authVersion");
    if (!user) {
      const existingUser = await User.findOne({
        email: profile.email.toLowerCase(),
      });
      if (existingUser) {
        return {
          status: 409,
          body: {
            success: false,
            message:
              "This email is already registered. Use your existing login method.",
          },
        };
      }
      user = await User.create({
        name: profile.name?.trim().slice(0, 80) || "Northstar Customer",
        email: profile.email.toLowerCase(),
        googleId: profile.sub,
        isEmailVerified: true,
        role: "customer",
        profileImage: profile.picture || "",
      });
    }
    if (user.isBlocked || user.deletedAt) {
      return {
        status: 403,
        body: {
          success: false,
          code: user.deletedAt ? RestrictionCode.DELETED : RestrictionCode.BLOCKED,
          message: "Your account is restricted.",
        },
      };
    }
    return {
      status: 200,
      body: {
        success: true,
        message: "Google login successful.",
        data: {
          user: formatUser(user, requestData.apiBaseUrl),
        },
      },
      authUser: user,
    };
  } catch (error) {
    if (error.code === 11000) {
      return {
        status: 409,
        body: {
          success: false,
          message: "An account with this email already exists.",
        },
      };
    }
    console.error(
      "Google sign-in failed:",
      error.response?.data?.error || error.code || error.name,
    );
    return {
      status: 401,
      body: {
        success: false,
        message: "Google sign-in failed.",
      },
    };
  }
}
