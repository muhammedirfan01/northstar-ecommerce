import Order from "../models/order.js";
import { orderFilter, publicOrder } from "./customerOrderService.js";
import { httpError } from "../utils/httpError.js";
export function paymentFilter(input) {
  const { method, ...query } = input.query || {};
  if (method && !["cod", "razorpay"].includes(method))
    throw httpError("Invalid payment method.", 400);
  const result = orderFilter({ ...input, query }, true);
  if (method) result.filter.paymentMethod = method;
  if (result.filter.$or) {
    const pattern = result.filter.$or[0].orderId;
    result.filter.$or.push(
      { razorpayPaymentId: pattern },
      { razorpayOrderId: pattern },
    );
  }
  return result;
}
export function paymentData(order) {
  return {
    ...publicOrder(order),
    paymentReference:
      order.razorpayPaymentId || order.razorpayOrderId || order.orderId,
  };
}
export async function listPayments(input) {
  const { query, filter } = paymentFilter(input);
  const total = await Order.countDocuments(filter),
    totalPages = Math.max(1, Math.ceil(total / query.limit)),
    page = Math.min(query.page, totalPages);
  const rows = await Order.find(filter)
    .populate("userId", "name email phone")
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * query.limit)
    .limit(query.limit);
  const [summary = {}] = await Order.aggregate([
    {
      $group: {
        _id: null,
        collected: {
          $sum: {
            $cond: [
              { $in: ["$paymentStatus", ["paid", "refunded"]] },
              "$totalAmount",
              0,
            ],
          },
        },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", "pending"] },
                  { $ne: ["$orderStatus", "cancelled"] },
                ],
              },
              "$totalAmount",
              0,
            ],
          },
        },
        failed: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] },
        },
        refunded: {
          $sum: {
            $cond: [
              { $eq: ["$refund.status", "completed"] },
              "$refund.amount",
              0,
            ],
          },
        },
      },
    },
  ]);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        payments: rows.map(paymentData),
        summary: {
          collected: summary.collected || 0,
          pending: summary.pending || 0,
          failed: summary.failed || 0,
          refunded: summary.refunded || 0,
        },
        pagination: { page, limit: query.limit, total, totalPages },
      },
    },
  };
}
