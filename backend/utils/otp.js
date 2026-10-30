import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
export function generateOtp() {   
  const otp = randomInt(0, 1000000);
  return otp.toString().padStart(6, "0"); //adds zeros to the beginning until the string has six characters
}
export function hashOtp(verificationId, purpose, code) {  
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error("OTP_SECRET is missing");
  }
  const data = JSON.stringify([verificationId, purpose, code]);
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update(data)
    .digest("hex");
}
export function matchesOtpHash(storedHash, submittedHash) {
  const stored = Buffer.from(storedHash || "", "hex");
  const submitted = Buffer.from(submittedHash || "", "hex");

  return stored.length === submitted.length &&
    timingSafeEqual(stored, submitted);
}