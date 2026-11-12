// Show a customer their orders and handle cancellations.

import { refundWallet } from "./walletService.js";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Coupon from "../models/Coupon.js";
import { validateOrderId, validateOrderFilters } from "../utils/orderValidation.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createError } from "../utils/httpError.js";
import { ORDER_TRANSITIONS } from "../constants/orders.js";
import { restorePurchasedStock } from "./inventoryService.js";

export function formatOrder(order) {
  const value = order.toObject ? order.toObject() : order;
  const {
    _id,
    orderId,
    items,
    shippingAddress,
    subtotal,
    shippingCharge,
    tax,
    discount,
    offerDiscount,
    couponDiscount,
    appliedOffers,
    totalAmount,
    paymentMethod,
    paymentStatus,
    orderStatus,
    cancellationReason,
    cancelledAt,
    createdAt,
    statusHistory,
    returnRequest,
    refund,
    paymentHistory,
    customer,
  } = value;
  return {
    id: String(_id),
    orderId,
    items,
    shippingAddress,
    subtotal,
    shippingCharge,
    tax,
    discount,
    offerDiscount,
    couponDiscount,
    appliedOffers,
    totalAmount,
    paymentMethod,
    paymentStatus,
    orderStatus,
    cancellationReason,
    cancelledAt,
    createdAt,
    statusHistory,
    returnHistory: (value.returnHistory || []).map(request => ({ cycle: request.cycle || 1, reference: request.reference, resolution: request.resolution || "refund", status: request.status, replacementStatus: request.replacementStatus || "none", reason: request.reason, requestedAt: request.requestedAt, completedAt: request.completedAt, cancelledAt: request.cancelledAt, replacementDeliveredAt: request.replacementDeliveredAt, photos: request.photos || [] })),
    returnRequest: returnRequest && {
      cycle: returnRequest.cycle || 1,
      replacementReleasedAt: returnRequest.replacementReleasedAt,
      resolution: returnRequest.resolution || "refund",
      replacementStatus: returnRequest.replacementStatus || "none",
      replacementReservedAt: returnRequest.replacementReservedAt,
      replacementShippedAt: returnRequest.replacementShippedAt,
      replacementDeliveredAt: returnRequest.replacementDeliveredAt,
      reference:
        returnRequest.reference ||
        (returnRequest.status !== "none" ? `RET-${orderId}` : ""),
      description: returnRequest.description,
      pickupAddress: returnRequest.pickupAddress,
      packagingConfirmed: returnRequest.packagingConfirmed,
      photos:
        returnRequest.photos?.map((photo) => ({
          id: photo.id,
          name: photo.name,
        })) || [],
      status: returnRequest.status,
      reason: returnRequest.reason,
      cancelledAt: returnRequest.cancelledAt,
      requestedAt: returnRequest.requestedAt,
      reviewedAt: returnRequest.reviewedAt,
      completedAt: returnRequest.completedAt,
      reviewNote: returnRequest.reviewNote,
    },
    refund,
    paymentHistory,
    customer: customer?.name
      ? customer
      : {
          name: value.userId?.name || shippingAddress?.name || "",
          email: value.userId?.email || "",
          phone: value.userId?.phone || shippingAddress?.phone || "",
        },
    nextStatuses:
      paymentMethod === "razorpay" && paymentStatus !== "paid"
        ? []
        : ORDER_TRANSITIONS[orderStatus] || [],
  };
}
export function getOrderFilter(requestData, admin = false) {
  const query = validateOrderFilters(requestData.query);
  const filter = admin ? {} : { userId: requestData.user.id || requestData.user._id };
  if (query.status) filter.orderStatus = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.returnStatus)
    filter["returnRequest.status"] =
      query.returnStatus === "all"
        ? { $in: ["requested", "accepted", "rejected", "completed", "cancelled"] }
        : query.returnStatus;
  if (query.timeframe) {
    const months = { "3months": 3, "6months": 6, year: 12 }[query.timeframe];
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - months);
    filter.createdAt = { $gte: since };
  }
  if (query.search) {
    const pattern = {
      $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    filter.$or = [
      { orderId: pattern },
      { legacyOrderId: pattern },
      { "items.productName": pattern },
      { "items.variantName": pattern },
      ...(admin
        ? [{ "customer.name": pattern }, { "customer.email": pattern }]
        : []),
    ];
  }
  return { query, filter };
}
export async function listOrders(requestData, admin = false) {
  const { query, filter } = getOrderFilter(requestData, admin);
  const total = await Order.countDocuments(filter),
    totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const sort = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    "total-asc": { totalAmount: 1, _id: 1 },
    "total-desc": { totalAmount: -1, _id: -1 },
  }[query.sort];
  let records = Order.find(filter)
    .sort(sort)
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  if (admin) records = records.populate("userId", "name email phone");
  const orders = await records;
  return {
    status: 200,
    body: {
      success: true,
      data: {
        orders: orders.map(formatOrder),
        pagination: { page, totalPages, total, limit: query.limit },
      },
    },
  };
}
export async function findOrder(requestData, admin = false, session = null) {
  const filter = { _id: validateOrderId(requestData.params) };
  if (!admin) filter.userId = requestData.user.id || requestData.user._id;
  let orderSearch = Order.findOne(filter).session(session);
  if (admin) orderSearch = orderSearch.populate("userId", "name email phone");
  const order = await orderSearch;
  if (!order) throw createError("Order not found.", 404);
  return order;
}
export async function getOrder(requestData, admin = false) {
  return {
    status: 200,
    body: {
      success: true,
      data: { order: formatOrder(await findOrder(requestData, admin)) },
    },
  };
}
export async function cancelOrder(requestData, admin = false) {
  validateFormFields(requestData.body, ["reason"]);
  if (
    requestData.body.reason !== undefined &&
    (typeof requestData.body.reason !== "string" || requestData.body.reason.length > 300)
  )
    throw createError(
      "Cancellation reasons must be at most 300 characters.",
      400,
    );
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(requestData, admin, session);
      if (order.orderStatus === "cancelled") return;
      if (!["pending", "confirmed"].includes(order.orderStatus))
        throw createError("This order can no longer be cancelled.", 409);
      // A payment received after cancellation needs a refund. It must not reopen the cancelled order.
      if (order.refund?.reason === "duplicate_payment" && order.refund.status !== "completed")
        throw createError("Complete the duplicate-payment refund before cancelling or completing a return.", 409);
      await restorePurchasedStock(order, session);
      if (order.couponId)
        await Coupon.updateOne(
          { _id: order.couponId, usedCount: { $gt: 0 } },
          { $inc: { usedCount: -1 } },
          { session },
        );
      await refundWallet(order, session, { onlineCancellation: true });
      if (order.paymentStatus === "paid")
        order.refund = {
          status: "pending",
          amount: order.totalAmount,
          method: order.paymentMethod === "cod" ? "cash" : "razorpay",
          requestedAt: new Date(),
        };
      order.orderStatus = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = requestData.body.reason?.trim() || "";
      order.statusHistory.push({ status: "cancelled", at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return {
    status: 200,
    body: { success: true, data: { order: formatOrder(order) } },
  };
}
