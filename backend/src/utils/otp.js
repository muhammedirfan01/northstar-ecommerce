import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
export function generateOtp() {
  const number = randomInt(0, 1000000);
  const code = number.toString();
  return code.padStart(6, "0");
}

// Hash the code so the database can save its hash instead of the OTP itself.
export function hashOtp(verificationId, purpose, code) {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error("OTP_SECRET is missing");
  }

  const otpData = JSON.stringify([verificationId, purpose, code]);
  const secretBytes = Buffer.from(secret, "hex");
  const hasher = createHmac("sha256", secretBytes);

  hasher.update(otpData);
  return hasher.digest("hex");
}

export function otpHashesMatch(savedHash, submittedHash) {
  const savedHashBytes = Buffer.from(savedHash || "", "hex");
  const submittedBytes = Buffer.from(submittedHash || "", "hex");
  if (savedHashBytes.length !== submittedBytes.length) {
    return false;
  }
  return timingSafeEqual(savedHashBytes, submittedBytes);
}
