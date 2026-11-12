// Check registration details and send the first verification code.

import { createError } from "../utils/httpError.js";
import { Types } from "mongoose";
import User from "../models/User.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import sendOtpEmail from "./emailService.js";
import { hashPassword } from "../utils/password.js";
import { generateOtp, hashOtp } from "../utils/otp.js";
import { getNameError } from "../utils/nameValidation.js";
import { createValidationError } from "../utils/validation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { validateEmail, validatePassword } from "../utils/accountValidation.js";

// The controller passes request data here and sends the result back to the browser.

export async function register(requestData) {
  requestData.body = validateRegistrationForm(requestData.body);
  const body = requestData.body;
  const { name, email, password } = body;

  // Do not reveal whether the email is already registered
  const existingUser = await User.exists({
    email,
  });
  if (existingUser) {
    const responseData = getRegistrationTimes(new Types.ObjectId().toHexString());
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

  // Remove the old verification request only after the resend waiting time has passed.
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
    expiresAt: new Date(now + OTP_VALID_FOR_MS),
    resendAvailableAt: new Date(now + OTP_RESEND_WAIT_MS),
  });
  verification.otpHash = hashOtp(verification.id, "registration", code);
  try {
    await verification.save();
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
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
    throw createError("Unable to send the verification email.", 503);
  }
  const responseData = getRegistrationTimes(
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
const OTP_VALID_FOR_MS = 5 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
function getRegistrationTimes(
  challengeId,
  expiresAt = new Date(Date.now() + OTP_VALID_FOR_MS),
) {
  return {
    challengeId,
    expiresAt,
    expiresIn: 300,
    resendAfter: 60,
  };
}

export function validateRegistrationForm(formData) {
  validateFormFields(formData, ["name", "email", "password", "acceptedTerms"]);
  const invalidName = getNameError(formData.name);
  if (invalidName) throw createValidationError(invalidName, "name");
  const name = formData.name.trim();
  const email = validateEmail(formData.email);
  const password = validatePassword(formData.password, "password");
  if (formData.acceptedTerms !== true) {
    throw createValidationError("Invalid acceptedTerms.", "acceptedTerms");
  }
  return {
    name,
    email,
    password,
    acceptedTerms: true,
  };
}
