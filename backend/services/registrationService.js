import { checkRegistration } from "../utils/validators/registration.js";
// Application steps. Input is a plain object; the controller sends the response.
import { httpError } from "../utils/httpError.js";
import { Types } from "mongoose";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import sendOtpEmail from "../services/emailService.js";
import { hashPassword } from "../utils/password.js";
import { generateOtp, hashOtp } from "../utils/otp.js";
export async function register(input) {
  input.body = checkRegistration(input.body);
  const body = input.body;
  const { name, email, password } = body;

  // Do not reveal whether the email is already registered
  const existingUser = await User.exists({
    email,
  });
  if (existingUser) {
    const responseData = registrationTiming(new Types.ObjectId().toHexString());
    return {
      status: 202,
      body: {
        success: true,
        message:
          "If this email can be registered, a verification code has been sent.",
        data: responseData,
      },
    };
  }
  const passwordHash = await hashPassword(password);
  const code = generateOtp();
  const now = Date.now();

  // Remove an old challenge only after its cooldown
  await RegistrationOtp.deleteOne({
    email,
    purpose: "registration",
    resendAvailableAt: {
      $lte: new Date(now),
    },
  });
  const verification = new RegistrationOtp({
    email,
    purpose: "registration",
    pendingRegistration: {
      name,
      passwordHash,
    },
    expiresAt: new Date(now + OTP_TIME),
    resendAvailableAt: new Date(now + RESEND_TIME),
  });
  verification.otpHash = hashOtp(verification.id, "registration", code);
  try {
    await verification.save();
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(
        "Please wait 60 seconds before requesting another code.",
        429,
      );
    }
    throw error;
  }
  try {
    await sendOtpEmail(email, code, "registration");
  } catch (error) {
    await RegistrationOtp.deleteOne({
      _id: verification._id,
    });
    console.error("Registration email failed:", error);
    throw httpError("Unable to send the verification email.", 503);
  }
  const responseData = registrationTiming(
    verification.id,
    verification.expiresAt,
  );
  return {
    status: 202,
    body: {
      success: true,
      message:
        "If this email can be registered, a verification code has been sent.",
      data: responseData,
    },
  };
}
const OTP_TIME = 5 * 60 * 1000;
const RESEND_TIME = 60 * 1000;
function registrationTiming(
  challengeId,
  expiresAt = new Date(Date.now() + OTP_TIME),
) {
  return {
    challengeId,
    expiresAt,
    expiresIn: 300,
    resendAfter: 60,
  };
}
