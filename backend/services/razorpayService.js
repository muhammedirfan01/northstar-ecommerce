import { createHmac, timingSafeEqual } from "node:crypto";
import { httpError } from "../utils/httpError.js";

export function paymentConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
    process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}
export async function gateway(path, options = {}) {
  if (!paymentConfigured())
    throw httpError("Online payments are not configured yet.", 503);
  // A local-only override lets tests exercise real HTTP without provider credentials.
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
    throw httpError(
      "Payment provider is unavailable. Retry from your order details.",
      503,
    );
  }
  if (!response.ok) {
    const error = httpError(
      "Payment provider could not complete the request. Retry from your order details.",
      503,
    );
    error.gatewayRejected = response.status >= 400 && response.status < 500;
    throw error;
  }
  try {
    return await response.json();
  } catch {
    throw httpError(
      "Invalid payment provider response. Retry from your order details.",
      503,
    );
  }
}
export function validSignature(orderId, paymentId, signature) {
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
