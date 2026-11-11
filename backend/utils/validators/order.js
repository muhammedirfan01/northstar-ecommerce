import { checkShoppingAdd } from "./shopping.js";
import { checkFields } from "../formValidation.js";
import { validationError } from "../validation.js";
import { ORDER_STATUSES } from "../../constants/orders.js";

export function orderId(params) {
  if (!/^[a-f0-9]{24}$/i.test(params?.id || ""))
    throw validationError("Invalid order ID.");
  return params.id;
}
export function checkoutInput(body, placing = false) {
  checkFields(
    body,
    placing
      ? [
          "buyNow",
          "addressId",
          "couponCode",
          "paymentMethod",
          "requestId",
          "expectedTotalPaise",
        ]
      : ["addressId", "couponCode", "buyNow"],
  );
  if (!/^[a-f0-9]{24}$/i.test(body.addressId || ""))
    throw validationError("Invalid address ID");
  if (
    body.couponCode !== undefined &&
    (typeof body.couponCode !== "string" || body.couponCode.length > 40)
  )
    throw validationError("Invalid coupon");
  if (body.buyNow !== undefined) checkShoppingAdd(body.buyNow);
  if (placing) {
    if (!["cod", "razorpay", "wallet"].includes(body.paymentMethod))
      throw validationError("Select a valid payment method.");
    if (
      typeof body.requestId !== "string" ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId)
    )
      throw validationError("A valid checkout request ID is required.");
    if (
      !Number.isSafeInteger(body.expectedTotalPaise) ||
      body.expectedTotalPaise < 0
    )
      throw validationError(
        "Review the current order total before placing your order.",
      );
  }
  return body;
}
export function orderQuery(query = {}) {
  checkFields(query, [
    "page",
    "limit",
    "search",
    "status",
    "sort",
    "returnStatus",
    "paymentStatus",
    "timeframe",
  ]);
  const page = Number(query.page ?? 1),
    limit = Number(query.limit ?? 10);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw validationError("Invalid pagination.");
  if (query.status && !ORDER_STATUSES.includes(query.status))
    throw validationError("Invalid order status.");
  if (
    query.search !== undefined &&
    (typeof query.search !== "string" || query.search.length > 100)
  )
    throw validationError("Invalid search.");
  if (
    query.sort &&
    !["newest", "oldest", "total-asc", "total-desc"].includes(query.sort)
  )
    throw validationError("Invalid sort order.");
  if (
    query.returnStatus &&
    !["all", "requested", "accepted", "rejected", "completed", "cancelled"].includes(
      query.returnStatus,
    )
  )
    throw validationError("Invalid return status.");
  if (
    query.timeframe &&
    !["3months", "6months", "year"].includes(query.timeframe)
  )
    throw validationError("Invalid order timeframe.");
  if (
    query.paymentStatus &&
    !["pending", "failed", "paid", "refunded"].includes(query.paymentStatus)
  )
    throw validationError("Invalid payment status.");
  return {
    page,
    limit,
    status: query.status,
    search: query.search?.trim() || "",
    sort: query.sort || "newest",
    returnStatus: query.returnStatus,
    paymentStatus: query.paymentStatus,
    timeframe: query.timeframe,
  };
}
