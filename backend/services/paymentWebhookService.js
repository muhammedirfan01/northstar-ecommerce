import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Order from "../models/order.js";
import PaymentWebhookReceipt from "../models/PaymentWebhookReceipt.js";
import {
  settle,
  confirmProviderPayment,
  bindGatewayOrder,
  reconcileProviderOrder,
} from "./paymentService.js";
import { gateway } from "./razorpayService.js";
import { httpError } from "../utils/httpError.js";
import { applyGatewayRefund } from "./refundService.js";

async function findProviderOrder(providerId) {
  if (!/^order_[a-zA-Z0-9]+$/.test(providerId || ""))
    throw httpError("Invalid webhook order.", 400);
  let order = await Order.findOne({
    razorpayOrderId: providerId,
    paymentMethod: { $in: ["razorpay", "cod", "wallet"] },
  });
  if (order) return order;
  // Recover a provider order created before a lost response or process interruption.
  const provider = await gateway(`/orders/${encodeURIComponent(providerId)}`);
  if (!/^[a-f0-9]{24}$/i.test(provider.receipt || "")) return null;
  order = await Order.findOne({
    _id: provider.receipt,
    paymentMethod: "razorpay",
    razorpayOrderId: { $exists: false },
    paymentSetupUntil: { $ne: null },
  });
  return order ? bindGatewayOrder(order, provider) : null;
}
export async function receiveWebhook(input) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw httpError("Payment webhooks are not configured.", 503);
  if (
    !Buffer.isBuffer(input.body) ||
    !/^[a-f0-9]{64}$/i.test(input.signature || "")
  )
    throw httpError("Invalid webhook signature.", 400);
  const expected = createHmac("sha256", secret).update(input.body).digest();
  if (!timingSafeEqual(expected, Buffer.from(input.signature, "hex")))
    throw httpError("Invalid webhook signature.", 400);
  let event;
  try {
    event = JSON.parse(input.body.toString("utf8"));
  } catch {
    throw httpError("Invalid webhook payload.", 400);
  }
  if (
    !event ||
    Array.isArray(event) ||
    typeof event.event !== "string" ||
    !event.event ||
    event.event.length > 100 ||
    (input.eventId !== undefined &&
      (typeof input.eventId !== "string" ||
        !input.eventId ||
        input.eventId.length > 200))
  )
    throw httpError("Invalid webhook payload.", 400);
  const digest = createHash("sha256").update(input.body).digest("hex"),
    key = input.eventId ? `event:${input.eventId}` : `sha256:${digest}`;
  const prior = await PaymentWebhookReceipt.findById(key);
  if (prior) {
    if (prior.digest !== digest)
      throw httpError(
        "Webhook event ID does not match its original payload.",
        400,
      );
    return { status: 200, body: { success: true } };
  }
  const payment = event.payload?.payment?.entity,
    refund = event.payload?.refund?.entity;
  let order;
  if (["refund.processed", "refund.failed"].includes(event.event)) {
    if (
      !refund?.payment_id ||
      refund.status !==
        (event.event === "refund.processed" ? "processed" : "failed")
    )
      throw httpError("Invalid refund event.", 400);
    order = await Order.findOne({
      razorpayPaymentId: refund.payment_id,
      "refund.method": "razorpay",
      "refund.status": { $ne: "none" },
    });
    if (
      order &&
      (!order.refund.reference || order.refund.reference === refund.id)
    )
      await applyGatewayRefund(order, refund);
  }
  if (
    ["payment.captured", "payment.failed", "payment.authorized"].includes(
      event.event,
    )
  ) {
    if (
      !/^pay_[a-zA-Z0-9]+$/.test(payment?.id || "") ||
      payment.status !== event.event.split(".")[1]
    )
      throw httpError("Invalid payment event.", 400);
    order = await findProviderOrder(payment.order_id);
    if (order && event.event === "payment.captured")
      await settle(order, payment);
    else if (order && event.event === "payment.authorized") {
      const current = await gateway(
        `/payments/${encodeURIComponent(payment.id)}`,
      );
      if (current.id !== payment.id)
        throw httpError("Payment event does not match provider state.", 409);
      await confirmProviderPayment(order, current);
    } else if (order && event.event === "payment.failed")
      await Order.updateOne(
        {
          _id: order._id,
          paymentStatus: { $nin: ["paid", "failed", "refunded"] },
          orderStatus: "pending",
        },
        {
          $set: { paymentStatus: "failed" },
          $push: {
            paymentHistory: {
              status: "failed",
              at: new Date(),
              reference: payment.id,
              note: "Provider reported payment failure",
            },
          },
          $inc: { __v: 1 },
        },
      );
  }
  if (event.event === "order.paid") {
    const providerOrder = event.payload?.order?.entity;
    if (providerOrder?.status !== "paid")
      throw httpError("Invalid paid-order event.", 400);
    order = await findProviderOrder(providerOrder.id);
    if (order) await reconcileProviderOrder(order);
  }
  // Record only after business processing succeeds. Replays after a crash are safe because each state update is idempotent.
  try {
    await PaymentWebhookReceipt.create({
      _id: key,
      digest,
      event: event.event,
      orderId: order?._id,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await PaymentWebhookReceipt.findById(key);
    if (existing?.digest !== digest)
      throw httpError("Webhook event ID conflict.", 400);
  }
  return { status: 200, body: { success: true } };
}
