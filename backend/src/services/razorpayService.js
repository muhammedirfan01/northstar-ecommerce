// Send requests to Razorpay and check payment signatures.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createError } from "../utils/httpError.js";

export function isOnlinePaymentReady() {
  return Boolean(
    /^rzp_test_[a-zA-Z0-9]+$/.test(process.env.RAZORPAY_KEY_ID?.trim() || "") &&
    process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}
export async function sendRazorpayRequest(path, options = {}) {
  if (!isOnlinePaymentReady())
    throw createError("Configure Razorpay Test Mode keys to use online payments.", 503);
  // Tests can use a local payment server instead of contacting Razorpay.
  const base =
    process.env.NODE_ENV === "test" && process.env.RAZORPAY_TEST_URL
      ? process.env.RAZORPAY_TEST_URL
      : "https://api.razorpay.com/v1";
  let response;
  try {
    response = await fetch(base + path, {
      ...options,
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID.trim()}:${process.env.RAZORPAY_KEY_SECRET.trim()}`).toString("base64")}`,
        ...options.headers,
      },
    });
  } catch {
    throw createError(
      "Payment provider is unavailable. Retry from your order details.",
      503,
    );
  }
  if (!response.ok) {
    const error = createError(
      "Payment provider could not complete the request. Retry from your order details.",
      503,
    );
    error.gatewayRejected = response.status >= 400 && response.status < 500;
    throw error;
  }
  try {
    return await response.json();
  } catch {
    throw createError(
      "Invalid payment provider response. Retry from your order details.",
      503,
    );
  }
}
export function isValidPaymentSignature(orderId, paymentId, signature) {
  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !process.env.RAZORPAY_KEY_SECRET?.trim()
  )
    return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET.trim())
    .update(`${orderId}|${paymentId}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
