// Prepare CSV downloads for orders, payments and inventory.

import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { getOrderFilter } from "./customerOrderService.js";
import { getPaymentFilter, formatPayment } from "./adminPaymentService.js";
import { validateInventoryFilters, getInventoryFilter, getInventorySort } from "./inventoryService.js";

export function formatCsvValue(value) {
  let text = String(value ?? "");
  if (/^\s*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function exportAdminData(requestData, kind) {
  let headings, databaseQuery, formatRow;
  if (kind === "inventory") {
    const searchOptions = validateInventoryFilters(requestData.query);
    headings = [
      "Product ID",
      "Product",
      "Category",
      "Available stock",
      "Updated at",
    ];
    databaseQuery = Product.find(getInventoryFilter(searchOptions))
      .populate("category", "name")
      .sort(getInventorySort(searchOptions));
    formatRow = (product) => [
      product._id,
      product.name,
      product.category?.name,
      product.stock,
      product.updatedAt?.toISOString(),
    ];
  } else {
    const { filter } =
      kind === "payments" ? getPaymentFilter(requestData) : getOrderFilter(requestData, true);
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
    databaseQuery = Order.find(filter)
      .populate("userId", "name email phone")
      .sort({ createdAt: -1, _id: -1 });
    formatRow = (savedOrder) => {
      const orderDetails = formatPayment(savedOrder);
      return [
        orderDetails.orderId,
        orderDetails.customer.name,
        orderDetails.customer.email,
        orderDetails.items.map((item) => item.productName).join("; "),
        (orderDetails.totalAmount / 100).toFixed(2),
        orderDetails.paymentMethod,
        orderDetails.paymentStatus,
        orderDetails.orderStatus,
        orderDetails.createdAt?.toISOString(),
      ];
    };
  }
  const lines = [headings.map(formatCsvValue).join(",")];
  for await (const row of databaseQuery.cursor())
    lines.push(formatRow(row).map(formatCsvValue).join(","));
  return {
    filename: `northstar-${kind}.csv`,
    bytes: Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8"),
  };
}
