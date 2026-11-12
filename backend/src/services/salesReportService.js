// Calculate sales totals and prepare report downloads for the selected dates.

import Order from "../models/Order.js";
import { getOrderFilter, formatOrder } from "./customerOrderService.js";
import { validateFormFields } from "../utils/formValidation.js";
import { createValidationError } from "../utils/validation.js";
import { formatCsvValue } from "./adminExportService.js";
const DAY_IN_MS = 86400000,
  INDIA_TIME_OFFSET_MS = 330 * 60000;
function getReportDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw createValidationError("Use a valid report date (YYYY-MM-DD).");
  const dateInUtc = Date.parse(value + "T00:00:00Z");
  if (
    !Number.isFinite(dateInUtc) ||
    new Date(dateInUtc).toISOString().slice(0, 10) !== value
  )
    throw createValidationError("Invalid report date.");
  return dateInUtc - INDIA_TIME_OFFSET_MS;
}
export function validateReportFilters(searchOptions, now = Date.now()) {
  validateFormFields(searchOptions.query, [
    "from",
    "to",
    "group",
    "page",
    "limit",
    "search",
    "status",
    "paymentStatus",
    "sort",
  ]);
  const {
    from = new Date(now + INDIA_TIME_OFFSET_MS - 29 * DAY_IN_MS).toISOString().slice(0, 10),
    to = new Date(now + INDIA_TIME_OFFSET_MS).toISOString().slice(0, 10),
    group = "day",
    ...orderFilters
  } = searchOptions.query;
  const start = getReportDate(from),
    end = getReportDate(to) + DAY_IN_MS;
  if (end <= start || end - start > 366 * DAY_IN_MS)
    throw createValidationError("Select a date range of up to 366 days.");
  if (!["day", "month"].includes(group))
    throw createValidationError("Invalid report grouping.");
  const { filter, query } = getOrderFilter({ ...searchOptions, query: orderFilters }, true);
  filter.createdAt = { $gte: new Date(start), $lt: new Date(end) };
  const sort = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    "total-asc": { totalAmount: 1, _id: 1 },
    "total-desc": { totalAmount: -1, _id: -1 },
  }[query.sort];
  return { filter, query, group, sort, from, to };
}
const paymentTotalsStep = {
  $set: {
    collected: {
      $cond: [
        { $in: ["$paymentStatus", ["paid", "refunded"]] },
        "$totalAmount",
        0,
      ],
    },
    completedRefund: {
      $cond: [
        { $eq: ["$refund.status", "completed"] },
        { $ifNull: ["$refund.amount", 0] },
        0,
      ],
    },
  },
};
export async function salesReport(requestData) {
  const { filter, query, group, sort, from, to } = validateReportFilters(requestData);
  const [reportData] = await Order.aggregate([
    { $match: filter },
    paymentTotalsStep,
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              collected: { $sum: "$collected" },
              refunded: { $sum: "$completedRefund" },
              completedOrders: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$orderStatus", "delivered"] },
                        { $eq: ["$paymentStatus", "paid"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              completedSales: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$orderStatus", "delivered"] },
                        { $eq: ["$paymentStatus", "paid"] },
                      ],
                    },
                    { $subtract: ["$collected", "$completedRefund"] },
                    0,
                  ],
                },
              },
            },
          },
          { $project: { _id: 0 } },
        ],
        trend: [
          {
            $group: {
              _id: {
                $dateToString: {
                  date: "$createdAt",
                  format: group === "day" ? "%Y-%m-%d" : "%Y-%m",
                  timezone: "Asia/Kolkata",
                },
              },
              orders: { $sum: 1 },
              collected: { $sum: "$collected" },
              refunded: { $sum: "$completedRefund" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              period: "$_id",
              orders: 1,
              collected: 1,
              refunded: 1,
            },
          },
        ],
        topProducts: [
          {
            $match: {
              paymentStatus: { $in: ["paid", "refunded"] },
              subtotal: { $gt: 0 },
              totalAmount: { $gt: 0 },
            },
          },
          {
            $set: {
              merchandiseNet: {
                $multiply: [
                  {
                    $max: [
                      0,
                      {
                        $subtract: ["$subtotal", { $ifNull: ["$discount", 0] }],
                      },
                    ],
                  },
                  {
                    $max: [
                      0,
                      {
                        $subtract: [
                          1,
                          { $divide: ["$completedRefund", "$totalAmount"] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          { $match: { merchandiseNet: { $gt: 0 } } },
          { $sort: { createdAt: -1, _id: -1 } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.productId",
              name: { $first: "$items.productName" },
              image: { $first: "$items.productImage" },
              units: { $sum: "$items.quantity" },
              netSales: {
                $sum: {
                  $multiply: [
                    "$merchandiseNet",
                    { $divide: ["$items.lineTotalPaise", "$subtotal"] },
                  ],
                },
              },
            },
          },
          { $sort: { netSales: -1, _id: 1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$_id" },
              name: 1,
              image: 1,
              units: 1,
              netSales: { $round: ["$netSales", 0] },
            },
          },
        ],
        orders: [
          { $sort: sort },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
      },
    },
  ]);
  const summary = reportData.summary[0] || {
    orders: 0,
    collected: 0,
    refunded: 0,
    completedOrders: 0,
    completedSales: 0,
  };
  return {
    status: 200,
    body: {
      success: true,
      data: {
        from,
        to,
        summary,
        trend: reportData.trend,
        topProducts: reportData.topProducts,
        orders: reportData.orders.map((order) => ({
          ...formatOrder(order),
          completedRefund: order.completedRefund,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: summary.orders,
          totalPages: Math.max(1, Math.ceil(summary.orders / query.limit)),
        },
      },
    },
  };
}
export async function exportSales(requestData) {
  const { filter, sort } = validateReportFilters(requestData);
  const lines = [
    [
      "Order ID",
      "Placed at UTC",
      "Customer",
      "Email",
      "Total INR",
      "Collected INR",
      "Completed refund INR",
      "Net INR",
      "Payment method",
      "Payment status",
      "Order status",
    ]
      .map(formatCsvValue)
      .join(","),
  ];
  for await (const order of Order.find(filter).sort(sort).cursor()) {
    const collected = ["paid", "refunded"].includes(order.paymentStatus)
        ? order.totalAmount
        : 0,
      refunded = order.refund?.status === "completed" ? order.refund.amount : 0;
    lines.push(
      [
        order.orderId,
        order.createdAt.toISOString(),
        order.customer?.name || order.shippingAddress.name,
        order.customer?.email,
        (order.totalAmount / 100).toFixed(2),
        (collected / 100).toFixed(2),
        (refunded / 100).toFixed(2),
        ((collected - refunded) / 100).toFixed(2),
        order.paymentMethod,
        order.paymentStatus,
        order.orderStatus,
      ]
        .map(formatCsvValue)
        .join(","),
    );
  }
  return {
    filename: "northstar-sales.csv",
    bytes: Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8"),
  };
}
