import Order from "../models/order.js";
import { orderFilter, publicOrder } from "./customerOrderService.js";
import { checkFields } from "../utils/formValidation.js";
import { validationError } from "../utils/validation.js";
import { csvCell } from "./adminExportService.js";
const DAY = 86400000,
  OFFSET = 330 * 60000;
function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw validationError("Use a valid report date (YYYY-MM-DD).");
  const utc = Date.parse(value + "T00:00:00Z");
  if (
    !Number.isFinite(utc) ||
    new Date(utc).toISOString().slice(0, 10) !== value
  )
    throw validationError("Invalid report date.");
  return utc - OFFSET;
}
export function reportQuery(input, now = Date.now()) {
  checkFields(input.query, [
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
    from = new Date(now + OFFSET - 29 * DAY).toISOString().slice(0, 10),
    to = new Date(now + OFFSET).toISOString().slice(0, 10),
    group = "day",
    ...rest
  } = input.query;
  const start = day(from),
    end = day(to) + DAY;
  if (end <= start || end - start > 366 * DAY)
    throw validationError("Select a date range of up to 366 days.");
  if (!["day", "month"].includes(group))
    throw validationError("Invalid report grouping.");
  const { filter, query } = orderFilter({ ...input, query: rest }, true);
  filter.createdAt = { $gte: new Date(start), $lt: new Date(end) };
  const sort = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    "total-asc": { totalAmount: 1, _id: 1 },
    "total-desc": { totalAmount: -1, _id: -1 },
  }[query.sort];
  return { filter, query, group, sort, from, to };
}
const financials = {
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
export async function salesReport(input) {
  const { filter, query, group, sort, from, to } = reportQuery(input);
  const [result] = await Order.aggregate([
    { $match: filter },
    financials,
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
  const summary = result.summary[0] || {
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
        trend: result.trend,
        topProducts: result.topProducts,
        orders: result.orders.map((o) => ({
          ...publicOrder(o),
          completedRefund: o.completedRefund,
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
export async function exportSales(input) {
  const { filter, sort } = reportQuery(input);
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
      .map(csvCell)
      .join(","),
  ];
  for await (const o of Order.find(filter).sort(sort).cursor()) {
    const collected = ["paid", "refunded"].includes(o.paymentStatus)
        ? o.totalAmount
        : 0,
      refunded = o.refund?.status === "completed" ? o.refund.amount : 0;
    lines.push(
      [
        o.orderId,
        o.createdAt.toISOString(),
        o.customer?.name || o.shippingAddress.name,
        o.customer?.email,
        (o.totalAmount / 100).toFixed(2),
        (collected / 100).toFixed(2),
        (refunded / 100).toFixed(2),
        ((collected - refunded) / 100).toFixed(2),
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return {
    filename: "northstar-sales.csv",
    bytes: Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8"),
  };
}
