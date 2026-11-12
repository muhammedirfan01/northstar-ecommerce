// Check Razorpay payment results and update the matching order.

import mongoose from "mongoose";
import { debitWallet } from "./walletService.js";
import Order from "../models/Order.js";
import { findOrder, formatOrder } from "./customerOrderService.js";
import {
  sendRazorpayRequest,
  isValidPaymentSignature,
  isOnlinePaymentReady,
} from "./razorpayService.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

const isPaymentComplete = (order) => ["paid", "refunded"].includes(order.paymentStatus);
const orderResponse = (order) => ({
  status: 200,
  body: { success: true, data: { order: formatOrder(order) } },
});
function validatePayment(order, payment) {
  if (
    !/^pay_[a-zA-Z0-9]+$/.test(payment?.id || "") ||
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== order.totalAmount ||
    payment.currency !== "INR"
  )
    throw createError("Payment does not match this order.", 409);
}
// Save the result after Razorpay confirms that the money was collected.
export async function recordConfirmedPayment(order, payment) {
  validatePayment(order, payment);
  if (payment.status !== "captured")
    throw createError(
      "Payment is not captured for this order yet. Check its status before retrying.",
      409,
    );
  // The order may be cancelled while Razorpay is checking the payment. Recheck it before saving.
  for (let attempt = 0; attempt < 3; attempt++) {
    const duplicatePayment = ["cod", "wallet"].includes(order.paymentMethod) && isPaymentComplete(order) && !order.razorpayPaymentId;
    if (isPaymentComplete(order) && !duplicatePayment) {
      if (order.razorpayPaymentId !== payment.id)
        throw createError(
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
    if (!order) throw createError("Order not found.", 404);
    validatePayment(order, payment);
  }
  throw createError("Order changed. Check payment status again.", 409);
}
export async function confirmRazorpayPayment(order, payment) {
  validatePayment(order, payment);
  if (payment.status === "authorized" && order.paymentMethod !== "razorpay") return order;
  if (payment.status === "authorized" && !isPaymentComplete(order)) {
    order = await Order.findById(order._id);
    if (!order) throw createError("Order not found.", 404);
    if (isPaymentComplete(order) || order.paymentMethod !== "razorpay") return order;
    if (order.orderStatus === "cancelled") return order; // Do not ask Razorpay to collect an authorized payment for a cancelled order.
    const paymentId = payment.id;
    try {
      payment = await sendRazorpayRequest(
        `/payments/${encodeURIComponent(payment.id)}/capture`,
        {
          method: "POST",
          body: JSON.stringify({ amount: order.totalAmount, currency: "INR" }),
        },
      );
    } catch (error) {
      // Razorpay may have collected the payment even if we did not receive its response.
      const current = await sendRazorpayRequest(
        `/payments/${encodeURIComponent(payment.id)}`,
      );
      validatePayment(order, current);
      if (current.status !== "captured") throw error;
      payment = current;
    }
    if (payment.id !== paymentId)
      throw createError("Capture response does not match the payment.", 409);
  }
  return payment.status === "captured" ? recordConfirmedPayment(order, payment) : order;
}
export async function saveRazorpayOrderId(order, provider) {
  if (
    !/^order_[a-zA-Z0-9]+$/.test(provider?.id || "") ||
    provider.receipt !== String(order._id) ||
    provider.amount !== order.totalAmount ||
    provider.currency !== "INR"
  )
    throw createError(
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
  throw createError("Payment setup changed. Check payment status again.", 409);
}
async function findRazorpayOrder(order) {
  const found = await sendRazorpayRequest(
    `/orders?receipt=${encodeURIComponent(String(order._id))}&count=100`,
  );
  if (!Array.isArray(found.items))
    throw createError("Invalid payment provider response.", 503);
  const matches = found.items.filter((payment) => payment.receipt === String(order._id));
  if (matches.length !== 1)
    throw createError(
      "Payment setup is in progress or needs reconciliation. Refresh or contact support.",
      409,
    );
  return saveRazorpayOrderId(order, matches[0]);
}
async function checkRazorpayPayments(order) {
  const payments = await sendRazorpayRequest(
    `/orders/${encodeURIComponent(order.razorpayOrderId)}/payments`,
  );
  if (!Array.isArray(payments.items))
    throw createError("Invalid payment provider response.", 503);
  const payment =
    payments.items.find((payment) => payment.status === "captured") ||
    payments.items.find((payment) => payment.status === "authorized");
  if (payment) return confirmRazorpayPayment(order, payment);
  if (
    payments.items.some(
      (payment) => payment.status === "failed" && payment.order_id === order.razorpayOrderId,
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
// Ask Razorpay for the result when payment confirmation did not finish.
export async function checkPaymentStatus(requestData, admin = false) {
  validateFormFields(requestData.body, []);
  let order = await findOrder(requestData, admin);
  if (order.paymentMethod !== "razorpay" && !order.razorpayOrderId)
    throw createError("This order does not use online payment.", 409);
  if (isPaymentComplete(order)) return orderResponse(order);
  return orderResponse(await checkRazorpayOrder(order));
}
export async function checkRazorpayOrder(order) {
  if (!order.razorpayOrderId && order.paymentSetupUntil)
    order = await findRazorpayOrder(order);
  if (order.razorpayOrderId) order = await checkRazorpayPayments(order);
  return order;
}
export async function startPayment(requestData) {
  validateFormFields(requestData.body, []);
  let order = await findOrder(requestData);
  if (order.paymentMethod !== "razorpay" || order.orderStatus === "cancelled")
    throw createError("This order cannot accept an online payment.", 409);
  if (isPaymentComplete(order))
    return {
      ...orderResponse(order),
      body: {
        success: true,
        data: { order: formatOrder(order), checkout: null },
      },
    };
  if (!isOnlinePaymentReady())
    throw createError("Configure Razorpay Test Mode keys to use online payments.", 503);
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
      if (!order.razorpayOrderId) order = await findRazorpayOrder(order);
    } else {
      let provider;
      try {
        provider = await sendRazorpayRequest("/orders", {
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
      // Save the Razorpay order ID even if the customer cancelled while it was being created.
      order = await saveRazorpayOrderId(order, provider);
    }
  }
  order = await checkRazorpayPayments(order);
  if (order.paymentMethod !== "razorpay" || order.orderStatus === "cancelled")
    throw createError(
      "This order no longer accepts online payment. Check its payment/refund status.",
      409,
    );
  return {
    status: 200,
    body: {
      success: true,
      data: {
        order: formatOrder(order),
        checkout: isPaymentComplete(order)
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
export async function verifyPayment(requestData) {
  validateFormFields(requestData.body, [
    "razorpay_order_id",
    "razorpay_payment_id",
    "razorpay_signature",
  ]);
  const order = await findOrder(requestData);
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    requestData.body;
  if (
    !["razorpay", "cod", "wallet"].includes(order.paymentMethod) ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpay_payment_id || "") ||
    !order.razorpayOrderId ||
    razorpay_order_id !== order.razorpayOrderId ||
    !isValidPaymentSignature(
      order.razorpayOrderId,
      razorpay_payment_id,
      razorpay_signature,
    )
  )
    throw createError("Payment verification failed.", 400);
  const payment = await sendRazorpayRequest(
    `/payments/${encodeURIComponent(razorpay_payment_id)}`,
  );
  if (payment.id !== razorpay_payment_id)
    throw createError("Payment verification failed.", 409);
  const updated = await confirmRazorpayPayment(order, payment);
  if (!isPaymentComplete(updated))
    throw createError(
      "Payment is awaiting confirmation. Check payment status before retrying.",
      409,
    );
  return orderResponse(updated);
}

// Checkout already reduced stock. Changing the payment method must not reduce it again.
export async function changePaymentMethod(requestData) {
  validateFormFields(requestData.body, ["paymentMethod"]);
  const method = requestData.body.paymentMethod;
  if (!["cod", "wallet"].includes(method))
    throw createError("Choose cash on delivery or Northstar Wallet.", 400);

  let order = await findOrder(requestData);
  if (order.orderStatus === "cancelled")
    throw createError("This order is cancelled.", 409);
  if (isPaymentComplete(order) || order.paymentMethod === "cod") return orderResponse(order);
  if (
    order.paymentMethod !== "razorpay" ||
    order.orderStatus !== "pending" ||
    order.inventoryRestoredAt
  )
    throw createError("The payment method cannot be changed for this order.", 409);

  if (!order.razorpayOrderId && order.paymentSetupUntil)
    order = await checkRazorpayOrder(order);
  if (isPaymentComplete(order)) return orderResponse(order);
  if (order.razorpayOrderId) {
    const payments = await sendRazorpayRequest(
      "/orders/" + encodeURIComponent(order.razorpayOrderId) + "/payments",
    );
    if (!Array.isArray(payments.items))
      throw createError("Invalid payment provider response.", 503);
    for (const payment of payments.items) validatePayment(order, payment);
    const captured = payments.items.find(payment => payment.status === "captured");
    if (captured) return orderResponse(await recordConfirmedPayment(order, captured));
    if (payments.items.some(payment => !["failed", "refunded"].includes(payment.status)))
      throw createError(
        "An online payment is still processing. Please wait before changing methods.",
        409,
      );
  }

  const session = await mongoose.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const current = await findOrder(requestData, false, session);
      if (current.orderStatus === "cancelled")
        throw createError("This order is cancelled.", 409);
      if (isPaymentComplete(current) || current.paymentMethod === "cod") {
        updated = current;
        return;
      }
      if (
        current.__v !== order.__v ||
        current.paymentMethod !== "razorpay" ||
        current.orderStatus !== "pending" ||
        current.inventoryRestoredAt
      )
        throw createError("Order changed. Refresh the order before trying again.", 409);
      updated = await Order.findOneAndUpdate(
        {
          _id: current._id,
          userId: requestData.user.id || requestData.user._id,
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
        throw createError("Order changed. Refresh before trying again.", 409);
      if (method === "wallet") await debitWallet(updated, requestData.user, session);
    });
  } finally {
    await session.endSession();
  }
  return orderResponse(updated);
}
