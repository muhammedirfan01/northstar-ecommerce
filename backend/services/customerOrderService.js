import { refundWallet } from "./walletService.js";
import mongoose from "mongoose";
import Order from "../models/order.js";
import Coupon from "../models/Coupon.js";
import { orderId, orderQuery } from "../utils/validators/order.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
import { ORDER_TRANSITIONS } from "../constants/orders.js";
import { restoreOrderStock } from "../utils/inventory.js";

export function publicOrder(order) {
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
export function orderFilter(input, admin = false) {
  const query = orderQuery(input.query);
  const filter = admin ? {} : { userId: input.user.id || input.user._id };
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
export async function listOrders(input, admin = false) {
  const { query, filter } = orderFilter(input, admin);
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
        orders: orders.map(publicOrder),
        pagination: { page, totalPages, total, limit: query.limit },
      },
    },
  };
}
export async function findOrder(input, admin = false, session = null) {
  const filter = { _id: orderId(input.params) };
  if (!admin) filter.userId = input.user.id || input.user._id;
  let record = Order.findOne(filter).session(session);
  if (admin) record = record.populate("userId", "name email phone");
  const order = await record;
  if (!order) throw httpError("Order not found.", 404);
  return order;
}
export async function getOrder(input, admin = false) {
  return {
    status: 200,
    body: {
      success: true,
      data: { order: publicOrder(await findOrder(input, admin)) },
    },
  };
}
export async function cancelOrder(input, admin = false) {
  checkFields(input.body, ["reason"]);
  if (
    input.body.reason !== undefined &&
    (typeof input.body.reason !== "string" || input.body.reason.length > 300)
  )
    throw httpError(
      "Cancellation reasons must be at most 300 characters.",
      400,
    );
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await findOrder(input, admin, session);
      if (order.orderStatus === "cancelled") return;
      if (!["pending", "confirmed"].includes(order.orderStatus))
        throw httpError("This order can no longer be cancelled.", 409);
      // Late online captures remain cancelled and create a pending refund, never a fulfilment.
      if (order.refund?.reason === "duplicate_payment" && order.refund.status !== "completed")
        throw httpError("Complete the duplicate-payment refund before cancelling or completing a return.", 409);
      await restoreOrderStock(order, session);
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
      order.cancellationReason = input.body.reason?.trim() || "";
      order.statusHistory.push({ status: "cancelled", at: new Date() });
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return {
    status: 200,
    body: { success: true, data: { order: publicOrder(order) } },
  };
}
