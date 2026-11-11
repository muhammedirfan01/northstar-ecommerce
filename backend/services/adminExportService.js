import Order from "../models/order.js";
import Product from "../models/Product.js";
import { orderFilter } from "./customerOrderService.js";
import { paymentFilter, paymentData } from "./adminPaymentService.js";
import {
  inventoryQuery,
  inventoryFilter,
  inventorySort,
} from "../utils/inventoryQuery.js";
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function exportDirectory(input, kind) {
  let headings, query, format;
  if (kind === "inventory") {
    const q = inventoryQuery(input.query);
    headings = [
      "Product ID",
      "Product",
      "Category",
      "Available stock",
      "Updated at",
    ];
    query = Product.find(inventoryFilter(q))
      .populate("category", "name")
      .sort(inventorySort(q));
    format = (p) => [
      p._id,
      p.name,
      p.category?.name,
      p.stock,
      p.updatedAt?.toISOString(),
    ];
  } else {
    const { filter } =
      kind === "payments" ? paymentFilter(input) : orderFilter(input, true);
    headings = [
      "Order ID",
      "Customer",
      "Email",
      "Item",
      "Amount INR",
      "Payment method",
      "Payment status",
      "Order status",
      "Date",
    ];
    query = Order.find(filter)
      .populate("userId", "name email phone")
      .sort({ createdAt: -1, _id: -1 });
    format = (record) => {
      const o = paymentData(record);
      return [
        o.orderId,
        o.customer.name,
        o.customer.email,
        o.items.map((i) => i.productName).join("; "),
        (o.totalAmount / 100).toFixed(2),
        o.paymentMethod,
        o.paymentStatus,
        o.orderStatus,
        o.createdAt?.toISOString(),
      ];
    };
  }
  const lines = [headings.map(csvCell).join(",")];
  for await (const row of query.cursor())
    lines.push(format(row).map(csvCell).join(","));
  return {
    filename: `northstar-${kind}.csv`,
    bytes: Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8"),
  };
}
