import Order from "../models/order.js";
import {
  listOrders as list,
  getOrder as get,
  cancelOrder as cancel,
  publicOrder,
} from "./customerOrderService.js";
import { orderId } from "../utils/validators/order.js";
import { checkFields } from "../utils/formValidation.js";
import { httpError } from "../utils/httpError.js";
import { ORDER_TRANSITIONS } from "../constants/orders.js";

export async function listOrders(input) {
  const [result, total, fulfilled, pending, delivered, returns] =
    await Promise.all([
      list(input, true),
      Order.countDocuments({}),
      Order.countDocuments({
        orderStatus: { $in: ["shipped", "out_for_delivery", "delivered"] },
      }),
      Order.countDocuments({ orderStatus: { $in: ["pending", "confirmed"] } }),
      Order.countDocuments({ orderStatus: "delivered" }),
      Order.aggregate([
        {
          $match: {
            "returnRequest.status": {
              $in: ["requested", "accepted", "rejected", "completed", "cancelled"],
            },
          },
        },
        { $group: { _id: "$returnRequest.status", count: { $sum: 1 } } },
      ]),
    ]);
  result.body.data.summary = { total, fulfilled, pending, delivered };
  const returnSummary = {
    total: 0,
    requested: 0,
    accepted: 0,
    rejected: 0,
    completed: 0,
  };
  for (const row of returns) {
    returnSummary[row._id] = row.count;
    returnSummary.total += row.count;
  }
  result.body.data.returnSummary = returnSummary;
  return result;
}
export const getOrder = (input) => get(input, true);
export const cancelOrder = (input) => cancel(input, true);
export async function updateOrderStatus(input) {
  checkFields(input.body, ["status"]);
  const order = await Order.findById(orderId(input.params));
  if (!order) throw httpError("Order not found.", 404);
  const status = input.body.status;
  if (!(ORDER_TRANSITIONS[order.orderStatus] || []).includes(status))
    throw httpError("Invalid order status transition.", 409);
  if (order.paymentMethod === "razorpay" && order.paymentStatus !== "paid")
    throw httpError(
      "Payment must be captured before fulfilling this order.",
      409,
    );
  const filter = {
    _id: order._id,
    orderStatus: order.orderStatus,
    __v: order.__v,
  };
  const changes = { orderStatus: status };
  if (
    status === "delivered" &&
    order.paymentMethod === "cod" &&
    order.paymentStatus === "pending"
  )
    changes.paymentStatus = "paid";
  const history = { statusHistory: { status, at: new Date() } };
  if (changes.paymentStatus === "paid")
    history.paymentHistory = {
      status: "paid",
      at: new Date(),
      note: "Cash collected on delivery",
    };
  const updated = await Order.findOneAndUpdate(
    filter,
    { $set: changes, $push: history, $inc: { __v: 1 } },
    { returnDocument: "after" },
  );
  if (!updated)
    throw httpError("Order changed. Refresh before updating it.", 409);
  return {
    status: 200,
    body: { success: true, data: { order: publicOrder(updated) } },
  };
}

export async function markOrderPaid(input) {
  checkFields(input.body, []);
  const order = await Order.findById(orderId(input.params));
  if (!order) throw httpError("Order not found.", 404);
  const eligible = [
    "pending",
    "confirmed",
    "shipped",
    "out_for_delivery",
    "delivered",
  ];
  if (
    order.paymentMethod !== "cod" ||
    !eligible.includes(order.orderStatus) ||
    order.returnRequest?.status === "completed"
  )
    throw httpError(
      "Only active cash-on-delivery orders can be marked as paid. Online payments require provider verification.",
      409,
    );
  if (order.paymentStatus === "paid")
    return {
      status: 200,
      body: { success: true, data: { order: publicOrder(order) } },
    };
  if (order.paymentStatus !== "pending")
    throw httpError("This payment can no longer be marked as paid.", 409);
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: { $in: eligible },
      __v: order.__v === undefined ? { $exists: false } : order.__v,
    },
    {
      $set: { paymentStatus: "paid" },
      $push: {
        paymentHistory: {
          status: "paid",
          at: new Date(),
          note: "Cash payment receipt recorded by administrator",
        },
      },
      $inc: { __v: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    const current = await Order.findById(order._id);
    if (
      current?.paymentMethod === "cod" &&
      current.paymentStatus === "paid" &&
      eligible.includes(current.orderStatus)
    )
      return {
        status: 200,
        body: { success: true, data: { order: publicOrder(current) } },
      };
    throw httpError("Order changed. Refresh before updating it.", 409);
  }
  return {
    status: 200,
    body: { success: true, data: { order: publicOrder(updated) } },
  };
}
