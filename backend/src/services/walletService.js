// Show the wallet balance, pay for an order and return refunded money.

import { getActiveUserFilter } from "../utils/activeAccount.js";
import User from "../models/User.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { validateFormFields, validateQueryNumber } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";

export async function getWallet(requestData) {
  validateFormFields(requestData.query, ["page", "limit"]);
  const page = validateQueryNumber(requestData.query.page ?? 1, "page", 1, 10000, true);
  const limit = validateQueryNumber(requestData.query.limit ?? 10, "limit", 1, 50, true);
  const userId = requestData.user.id || requestData.user._id;
  const user = await User.findById(userId).select("+walletBalancePaise").lean();
  if (!user) throw createError("Please sign in again.", 401);
  const filter = { userId };
  const [total, entries] = await Promise.all([
    WalletTransaction.countDocuments(filter),
    WalletTransaction.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        walletId: `NSW-${String(userId).toUpperCase()}-INR`,
        balancePaise: user.walletBalancePaise ?? 0,
        transactions: entries.map((entry) => ({
          id: String(entry._id),
          orderId: String(entry.orderId),
          type: entry.type,
          amountPaise: entry.amountPaise,
          description: entry.description,
          createdAt: entry.createdAt,
        })),
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  };
}
export async function debitWallet(order, account, session) {
  const updated = await User.findOneAndUpdate(
    {
      ...getActiveUserFilter(order.userId, account.email, account.authVersion),
      role: "customer",
      isEmailVerified: true,
      isBlocked: { $ne: true },
      deletedAt: null,
      walletBalancePaise: { $gte: order.totalAmount },
    },
    { $inc: { walletBalancePaise: -order.totalAmount } },
    { session, returnDocument: "after" },
  ).select("+walletBalancePaise");
  if (!updated)
    throw createError(
      "Your wallet balance is insufficient or your account changed. Refresh checkout.",
      409,
    );
  await WalletTransaction.create(
    [
      {
        userId: order.userId,
        orderId: order._id,
        operation: "purchase",
        type: "debit",
        amountPaise: order.totalAmount,
        balanceAfterPaise: updated.walletBalancePaise,
        description: `Purchase · ${order.orderId}`,
      },
    ],
    { session },
  );
}
// Run this with the cancellation or return so its database changes succeed or fail together.
export async function refundWallet(order, session, { onlineCancellation = false, manualRefund = false } = {}) {
  if (order.paymentStatus !== "paid" || (order.paymentMethod !== "wallet" && !((onlineCancellation && order.paymentMethod === "razorpay") || (manualRefund && ["cod", "razorpay"].includes(order.paymentMethod))))) return;
  if (onlineCancellation && order.paymentMethod === "razorpay" && order.refund?.method === "razorpay" && ["pending", "processing", "failed"].includes(order.refund.status) && order.refund.reason !== "duplicate_payment")
    throw createError("A gateway refund is already in progress. Contact support before cancelling this order.", 409);
  const existing = await WalletTransaction.findOne({
    orderId: order._id,
    operation: "refund",
  }).session(session);
  if (!existing) {
    const updated = await User.findOneAndUpdate(
      {
        _id: order.userId,
        $or: [
          { walletBalancePaise: { $exists: false } },
          { walletBalancePaise: { $lte: Number.MAX_SAFE_INTEGER - order.totalAmount } },
        ],
      },
      { $inc: { walletBalancePaise: order.totalAmount } },
      { session, returnDocument: "after" },
    ).select("+walletBalancePaise");
    if (!updated)
      throw createError(
        "Wallet refund could not be recorded. Please retry.",
        409,
      );
    await WalletTransaction.create(
      [
        {
          userId: order.userId,
          orderId: order._id,
          operation: "refund",
          type: "credit",
          amountPaise: order.totalAmount,
          balanceAfterPaise: updated.walletBalancePaise,
          description: `Refund · ${order.orderId}`,
        },
      ],
      { session },
    );
  }
  order.refund = {
    status: "completed",
    amount: order.totalAmount,
    method: "wallet",
    reference: `wallet-refund-${order._id}`,
    requestedAt: new Date(),
    completedAt: new Date(),
  };
  order.paymentStatus = "refunded";
  order.paymentHistory.push({
    status: "refunded",
    reference: order.refund.reference,
    note: "Refund credited to Northstar Wallet",
    at: new Date(),
  });
}
