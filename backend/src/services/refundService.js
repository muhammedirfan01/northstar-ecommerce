// Record refunds and handle the selected refund method.

import mongoose from "mongoose";
import { refundWallet } from "./walletService.js";
import Order from "../models/Order.js";
import { findOrder, formatOrder } from "./customerOrderService.js";
import { sendRazorpayRequest } from "./razorpayService.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

export async function recordRazorpayRefund(order, refund) {
  if (
    refund.payment_id !== order.razorpayPaymentId ||
    refund.amount !== order.refund.amount ||
    refund.currency !== "INR" ||
    !/^rfnd_[a-zA-Z0-9]+$/.test(refund.id || "")
  )
    throw createError("Refund response does not match this order.", 409);
  const status = {
    processed: "completed",
    pending: "processing",
    failed: "failed",
  }[refund.status];
  if (!status) throw createError("Unexpected refund status.", 409);
  if (order.refund.status === "completed") return order;
  const set = { "refund.status": status, "refund.reference": refund.id };
  if (status === "completed") {
    if (order.refund.reason !== "duplicate_payment") set.paymentStatus = "refunded";
    set["refund.completedAt"] = new Date();
  }
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      "refund.status": { $ne: "completed" },
      "refund.amount": refund.amount,
      $or: [
        { "refund.status": { $ne: status } },
        { "refund.reference": { $ne: refund.id } },
      ],
    },
    {
      $set: set,
      $push: {
        paymentHistory: {
          status: `refund_${status}`,
          reference: refund.id,
          at: new Date(),
        },
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" },
  );
  return updated || (await Order.findById(order._id));
}
async function creditManualRefund(requestData) {
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(requestData, true, session);
      if (order.refund?.status === "completed" && order.refund.method === "wallet") return;
      if (order.returnRequest?.resolution === "replacement" || order.paymentStatus !== "paid" || !["pending", "failed"].includes(order.refund?.status) || !["cash", "wallet"].includes(order.refund.method) || order.refund.reference || order.refund.reason === "duplicate_payment" || (order.orderStatus !== "cancelled" && order.returnRequest?.status !== "completed") || order.refund.amount !== order.totalAmount)
        throw createError("This refund cannot be credited to the wallet. It may already have been refunded or sent to the payment provider.", 409);
      await refundWallet(order, session, { manualRefund: true });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return { status: 200, body: { success: true, data: { order: formatOrder(order) } } };
}
export async function processRefund(requestData) {
  validateFormFields(requestData.body, ["reference", "destination"]);
  if (requestData.body.destination !== undefined && requestData.body.destination !== "wallet") throw createError("Select a valid refund destination.", 400);
  if (requestData.body.destination === "wallet") return creditManualRefund(requestData);
  let order = await findOrder(requestData, true);
  if (order.refund?.method === "wallet") return creditManualRefund(requestData);
  if (order.refund?.status === "completed")
    return {
      status: 200,
      body: { success: true, data: { order: formatOrder(order) } },
    };
  if (
    !order.refund ||
    !["pending", "processing", "failed"].includes(order.refund.status) ||
    (order.paymentStatus !== "paid" && order.refund.reason !== "duplicate_payment")
  )
    throw createError("No refund is due for this order.", 409);
  if (order.refund.method === "cash") {
    // The admin records money already returned in cash or outside the website.
    const reference = requestData.body.reference;
    if (
      typeof reference !== "string" ||
      reference.trim().length < 3 ||
      reference.length > 120
    )
      throw createError(
        "Enter the reference confirming the cash refund was actually paid.",
        400,
      );
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, "refund.status": { $ne: "completed" }, __v: order.__v },
      {
        $set: {
          "refund.status": "completed",
          "refund.reference": reference.trim(),
          "refund.completedAt": new Date(),
          paymentStatus: "refunded",
        },
        $push: {
          paymentHistory: {
            status: "refunded",
            note: "Cash refund confirmed by administrator",
            reference: reference.trim(),
            at: new Date(),
          },
        },
        $inc: { __v: 1 },
      },
      { returnDocument: "after" },
    );
    if (!updated) throw createError("Refund changed. Refresh the order.", 409);
    order = updated;
  } else {
    const refund = order.refund.reference.startsWith("rfnd_")
      ? await sendRazorpayRequest(`/refunds/${encodeURIComponent(order.refund.reference)}`)
      : await sendRazorpayRequest(
          `/payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`,
          {
            method: "POST",
            headers: {
              "X-Refund-Idempotency": `northstar-refund-${order._id}`,
            },
            body: JSON.stringify({
              amount: order.refund.amount,
              receipt: String(order._id),
              speed: "normal",
            }),
          },
        );
    order = await recordRazorpayRefund(order, refund);
  }
  return {
    status: 200,
    body: { success: true, data: { order: formatOrder(order) } },
  };
}
