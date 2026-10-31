import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { issueAuthCookie } from "../utils/jwt.js";
import { publicUser } from "../middlewares/auth.js";

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

export async function googleSignIn(req, res) {
  try {
    const { code } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        success: false,
        message: "Google authorization code is required.",
      });
    }

    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: new URL(process.env.CLIENT_URL).origin,
    });

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const profile = ticket.getPayload();

    if (!profile?.sub || !profile.email || !profile.email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google verification failed.",
      });
    }

    let user = await User.findOne({ googleId: profile.sub }).select(
      "+googleId +passwordHash +authVersion",
    );

    if (!user) {
      const existingUser = await User.findOne({
        email: profile.email.toLowerCase(),
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message:
            "This email is already registered. Use your existing login method.",
        });
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
      return res.status(403).json({
        success: false,
        code: user.deletedAt ? "ACCOUNT_DELETED" : "ACCOUNT_BLOCKED",
        message: "Your account is restricted.",
      });
    }

    issueAuthCookie(res, user);

    return res.json({
      success: true,
      message: "Google login successful.",
      data: { user: publicUser(user) },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error(
      "Google sign-in failed:",
      error.response?.data?.error || error.code || error.name,
    );
    return res.status(401).json({
      success: false,
      message: "Google sign-in failed.",
    });
  }
}
