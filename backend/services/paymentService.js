import mongoose from "mongoose";
import { debitWallet } from "./walletService.js";
import { readSettings } from "./settingsService.js";
import Order from "../models/order.js";
import { findOrder, publicOrder } from "./customerOrderService.js";
import {
  gateway,
  validSignature,
  paymentConfigured,
} from "./razorpayService.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";

const isSettled = (order) => ["paid", "refunded"].includes(order.paymentStatus);
const result = (order) => ({
  status: 200,
  body: { success: true, data: { order: publicOrder(order) } },
});
function validatePayment(order, payment) {
  if (
    !/^pay_[a-zA-Z0-9]+$/.test(payment?.id || "") ||
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== order.totalAmount ||
    payment.currency !== "INR"
  )
    throw httpError("Payment does not match this order.", 409);
}
export async function settle(order, payment) {
  validatePayment(order, payment);
  if (payment.status !== "captured")
    throw httpError(
      "Payment is not captured for this order yet. Check its status before retrying.",
      409,
    );
  // Cancellation can win between provider verification and the atomic order update.
  for (let attempt = 0; attempt < 3; attempt++) {
    const duplicatePayment = ["cod", "wallet"].includes(order.paymentMethod) && isSettled(order) && !order.razorpayPaymentId;
    if (isSettled(order) && !duplicatePayment) {
      if (order.razorpayPaymentId !== payment.id)
        throw httpError(
          "A different payment is already recorded for this order. Contact support.",
          409,
        );
      return order;
    }
    const cancelled = order.orderStatus === "cancelled";
    const changes = {
      paymentStatus: duplicatePayment ? order.paymentStatus : "paid",
      orderStatus: ["cod", "wallet"].includes(order.paymentMethod) ? order.orderStatus : cancelled ? "cancelled" : "confirmed",
      ...(order.paymentMethod === "cod" && !duplicatePayment ? { paymentMethod: "razorpay" } : {}),
      razorpayPaymentId: payment.id,
    };
    if (cancelled || duplicatePayment)
      changes.refund = {
        reason: duplicatePayment ? "duplicate_payment" : "",
        status: "pending",
        amount: order.totalAmount,
        method: "razorpay",
        requestedAt: new Date(),
      };
    const updated = await Order.findOneAndUpdate(
      {
        _id: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: duplicatePayment ? order.paymentStatus : { $nin: ["paid", "refunded"] },
        paymentMethod: order.paymentMethod,
        __v: order.__v === undefined ? { $exists: false } : order.__v,
        razorpayOrderId: payment.order_id,
      },
      {
        $set: changes,
        $push: {
          statusHistory: { status: changes.orderStatus, at: new Date() },
          paymentHistory: {
            status: "paid",
            reference: payment.id,
            note: duplicatePayment
              ? "Online capture after an alternative payment; duplicate payment refund pending"
              : cancelled
              ? "Late capture after cancellation; refund pending"
              : "Payment captured",
            at: new Date(),
          },
        },
        $inc: { __v: 1 },
      },
      { returnDocument: "after" },
    );
    if (updated) return updated;
    order = await Order.findById(order._id);
    if (!order) throw httpError("Order not found.", 404);
    validatePayment(order, payment);
  }
  throw httpError("Order changed. Check payment status again.", 409);
}
export async function confirmProviderPayment(order, payment) {
  validatePayment(order, payment);
  if (payment.status === "authorized" && order.paymentMethod !== "razorpay") return order;
  if (payment.status === "authorized" && !isSettled(order)) {
    order = await Order.findById(order._id);
    if (!order) throw httpError("Order not found.", 404);
    if (isSettled(order) || order.paymentMethod !== "razorpay") return order;
    if (order.orderStatus === "cancelled") return order; // Never intentionally capture a cancelled authorization.
    const paymentId = payment.id;
    try {
      payment = await gateway(
        `/payments/${encodeURIComponent(payment.id)}/capture`,
        {
          method: "POST",
          body: JSON.stringify({ amount: order.totalAmount, currency: "INR" }),
        },
      );
    } catch (error) {
      // Capture may have succeeded before a timeout, or another request captured first.
      const current = await gateway(
        `/payments/${encodeURIComponent(payment.id)}`,
      );
      validatePayment(order, current);
      if (current.status !== "captured") throw error;
      payment = current;
    }
    if (payment.id !== paymentId)
      throw httpError("Capture response does not match the payment.", 409);
  }
  return payment.status === "captured" ? settle(order, payment) : order;
}
export async function bindGatewayOrder(order, provider) {
  if (
    !/^order_[a-zA-Z0-9]+$/.test(provider?.id || "") ||
    provider.receipt !== String(order._id) ||
    provider.amount !== order.totalAmount ||
    provider.currency !== "INR"
  )
    throw httpError(
      "Payment setup needs reconciliation. Check payment status or contact support.",
      503,
    );
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentMethod: "razorpay",
      razorpayOrderId: { $exists: false },
    },
    {
      $set: { razorpayOrderId: provider.id, paymentSetupUntil: null },
      $push: {
        paymentHistory: {
          status: "initiated",
          at: new Date(),
          reference: provider.id,
        },
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" },
  );
  if (updated) return updated;
  const current = await Order.findById(order._id);
  if (current?.razorpayOrderId === provider.id) return current;
  throw httpError("Payment setup changed. Check payment status again.", 409);
}
async function recoverGatewayOrder(order) {
  const found = await gateway(
    `/orders?receipt=${encodeURIComponent(String(order._id))}&count=100`,
  );
  if (!Array.isArray(found.items))
    throw httpError("Invalid payment provider response.", 503);
  const matches = found.items.filter((p) => p.receipt === String(order._id));
  if (matches.length !== 1)
    throw httpError(
      "Payment setup is in progress or needs reconciliation. Refresh or contact support.",
      409,
    );
  return bindGatewayOrder(order, matches[0]);
}
async function syncPayments(order) {
  const payments = await gateway(
    `/orders/${encodeURIComponent(order.razorpayOrderId)}/payments`,
  );
  if (!Array.isArray(payments.items))
    throw httpError("Invalid payment provider response.", 503);
  const payment =
    payments.items.find((p) => p.status === "captured") ||
    payments.items.find((p) => p.status === "authorized");
  if (payment) return confirmProviderPayment(order, payment);
  if (
    payments.items.some(
      (p) => p.status === "failed" && p.order_id === order.razorpayOrderId,
    )
  ) {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: "pending", paymentStatus: "pending" },
      {
        $set: { paymentStatus: "failed" },
        $push: {
          paymentHistory: {
            status: "failed",
            at: new Date(),
            note: "Provider confirmed failed payment attempt",
          },
        },
        $inc: { __v: 1 },
      },
      { returnDocument: "after" },
    );
    return updated || Order.findById(order._id);
  }
  return Order.findById(order._id);
}
export async function reconcilePayment(input, admin = false) {
  checkFields(input.body, []);
  let order = await findOrder(input, admin);
  if (order.paymentMethod !== "razorpay" && !order.razorpayOrderId)
    throw httpError("This order does not use online payment.", 409);
  if (isSettled(order)) return result(order);
  return result(await reconcileProviderOrder(order));
}
export async function reconcileProviderOrder(order) {
  if (!order.razorpayOrderId && order.paymentSetupUntil)
    order = await recoverGatewayOrder(order);
  if (order.razorpayOrderId) order = await syncPayments(order);
  return order;
}
export async function startPayment(input) {
  checkFields(input.body, []);
  let order = await findOrder(input);
  if (order.paymentMethod !== "razorpay" || order.orderStatus === "cancelled")
    throw httpError("This order cannot accept an online payment.", 409);
  if (isSettled(order))
    return {
      ...result(order),
      body: {
        success: true,
        data: { order: publicOrder(order), checkout: null },
      },
    };
  if (!paymentConfigured())
    throw httpError("Online payments are not configured yet.", 503);
  if (!order.razorpayOrderId) {
    const claimed = await Order.findOneAndUpdate(
      {
        _id: order._id,
        orderStatus: "pending",
        paymentMethod: "razorpay",
        razorpayOrderId: { $exists: false },
        paymentSetupUntil: null,
      },
      { $set: { paymentSetupUntil: new Date() }, $inc: { __v: 1 } },
      { returnDocument: "after" },
    );
    if (!claimed) {
      order = await Order.findById(order._id);
      if (!order.razorpayOrderId) order = await recoverGatewayOrder(order);
    } else {
      let provider;
      try {
        provider = await gateway("/orders", {
          method: "POST",
          body: JSON.stringify({
            amount: order.totalAmount,
            currency: "INR",
            receipt: String(order._id),
            notes: { northstar_order_id: order.orderId },
          }),
        });
      } catch (error) {
        if (error.gatewayRejected)
          await Order.updateOne(
            { _id: order._id, razorpayOrderId: { $exists: false } },
            { $set: { paymentSetupUntil: null }, $inc: { __v: 1 } },
          );
        throw error;
      }
      // Keep the provider association even if cancellation happened during creation.
      order = await bindGatewayOrder(order, provider);
    }
  }
  order = await syncPayments(order);
  if (order.paymentMethod !== "razorpay" || order.orderStatus === "cancelled")
    throw httpError(
      "This order no longer accepts online payment. Check its payment/refund status.",
      409,
    );
  return {
    status: 200,
    body: {
      success: true,
      data: {
        order: publicOrder(order),
        checkout: isSettled(order)
          ? null
          : {
              key: process.env.RAZORPAY_KEY_ID?.trim(),
              order_id: order.razorpayOrderId,
              amount: order.totalAmount,
              currency: "INR",
              description: order.orderId,
              prefill: {
                name: order.customer?.name || order.shippingAddress.name,
                email: order.customer?.email || "",
                contact: order.shippingAddress.phone,
              },
            },
      },
    },
  };
}
export async function verifyPayment(input) {
  checkFields(input.body, [
    "razorpay_order_id",
    "razorpay_payment_id",
    "razorpay_signature",
  ]);
  const order = await findOrder(input);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    input.body;
  if (
    !["razorpay", "cod", "wallet"].includes(order.paymentMethod) ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpay_payment_id || "") ||
    !order.razorpayOrderId ||
    razorpay_order_id !== order.razorpayOrderId ||
    !validSignature(
      order.razorpayOrderId,
      razorpay_payment_id,
      razorpay_signature,
    )
  )
    throw httpError("Payment verification failed.", 400);
  const payment = await gateway(
    `/payments/${encodeURIComponent(razorpay_payment_id)}`,
  );
  if (payment.id !== razorpay_payment_id)
    throw httpError("Payment verification failed.", 409);
  const updated = await confirmProviderPayment(order, payment);
  if (!isSettled(updated))
    throw httpError(
      "Payment is awaiting confirmation. Check payment status before retrying.",
      409,
    );
  return result(updated);
}

// Checkout already reserved stock. Switching reuses that order and reservation.
export async function changePaymentMethod(input) {
  checkFields(input.body, ["paymentMethod"]);
  const method = input.body.paymentMethod;
  if (!["cod", "wallet"].includes(method))
    throw httpError("Choose cash on delivery or Northstar Wallet.", 400);

  let order = await findOrder(input);
  if (order.orderStatus === "cancelled")
    throw httpError("This order is cancelled.", 409);
  if (isSettled(order) || order.paymentMethod === "cod") return result(order);
  if (
    order.paymentMethod !== "razorpay" ||
    order.orderStatus !== "pending" ||
    order.inventoryRestoredAt
  )
    throw httpError("The payment method cannot be changed for this order.", 409);

  const settings = await readSettings();
  if (method === "cod" && !settings.codEnabled)
    throw httpError("Cash on delivery is currently unavailable.", 409);
  if (!order.razorpayOrderId && order.paymentSetupUntil)
    order = await reconcileProviderOrder(order);
  if (isSettled(order)) return result(order);
  if (order.razorpayOrderId) {
    const payments = await gateway(
      "/orders/" + encodeURIComponent(order.razorpayOrderId) + "/payments",
    );
    if (!Array.isArray(payments.items))
      throw httpError("Invalid payment provider response.", 503);
    for (const payment of payments.items) validatePayment(order, payment);
    const captured = payments.items.find(payment => payment.status === "captured");
    if (captured) return result(await settle(order, captured));
    if (payments.items.some(payment => !["failed", "refunded"].includes(payment.status)))
      throw httpError(
        "An online payment is still processing. Please wait before changing methods.",
        409,
      );
  }

  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const current = await findOrder(input, false, session);
      if (current.orderStatus === "cancelled")
        throw httpError("This order is cancelled.", 409);
      if (isSettled(current) || current.paymentMethod === "cod") {
        updated = current;
        return;
      }
      if (
        current.__v !== order.__v ||
        current.paymentMethod !== "razorpay" ||
        current.orderStatus !== "pending" ||
        current.inventoryRestoredAt
      )
        throw httpError("Order changed. Refresh the order before trying again.", 409);
      updated = await Order.findOneAndUpdate(
        {
          _id: current._id,
          userId: input.user.id || input.user._id,
          paymentMethod: "razorpay",
          orderStatus: "pending",
          paymentStatus: { $in: ["pending", "failed"] },
          inventoryRestoredAt: null,
          __v: current.__v === undefined ? { $exists: false } : current.__v,
        },
        {
          $set: {
            paymentMethod: method,
            paymentStatus: method === "wallet" ? "paid" : "pending",
            orderStatus: "confirmed",
          },
          $push: {
            statusHistory: { status: "confirmed", at: new Date() },
            paymentHistory: {
              status: method === "wallet" ? "paid" : "pending",
              at: new Date(),
              note: method === "wallet"
                ? "Customer paid saved order with wallet"
                : "Customer switched online payment to cash on delivery",
            },
          },
          $inc: { __v: 1 },
        },
        { session, returnDocument: "after" },
      );
      if (!updated)
        throw httpError("Order changed. Refresh before trying again.", 409);
      if (method === "wallet") await debitWallet(updated, input.user, session);
    });
  } finally {
    await session.endSession();
  }
  return result(updated);
}
