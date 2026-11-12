import { validateFormFields } from "./formValidation.js";
import { createValidationError } from "./validation.js";
import { ORDER_STATUSES } from "../constants/orders.js";

export function validateOrderId(params) {
  const id = params?.id || "";

  if (!/^[a-f0-9]{24}$/i.test(id)) {
    throw createValidationError("Invalid order ID.");
  }

  return id;
}

export function validateOrderFilters(query = {}) {
  validateFormFields(query, [
    "page",
    "limit",
    "search",
    "status",
    "sort",
    "returnStatus",
    "paymentStatus",
    "timeframe",
  ]);

  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 10);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    throw createValidationError("Invalid pagination.");
  }

  if (query.status && !ORDER_STATUSES.includes(query.status)) {
    throw createValidationError("Invalid order status.");
  }

  if (
    query.search !== undefined &&
    (typeof query.search !== "string" || query.search.length > 100)
  ) {
    throw createValidationError("Invalid search.");
  }

  const sorts = ["newest", "oldest", "total-asc", "total-desc"];

  if (query.sort && !sorts.includes(query.sort)) {
    throw createValidationError("Invalid sort order.");
  }

  const returnStatuses = [
    "all",
    "requested",
    "accepted",
    "rejected",
    "completed",
    "cancelled",
  ];

  if (query.returnStatus && !returnStatuses.includes(query.returnStatus)) {
    throw createValidationError("Invalid return status.");
  }

  const timeframes = ["3months", "6months", "year"];

  if (query.timeframe && !timeframes.includes(query.timeframe)) {
    throw createValidationError("Invalid order timeframe.");
  }

  const paymentStatuses = ["pending", "failed", "paid", "refunded"];

  if (query.paymentStatus && !paymentStatuses.includes(query.paymentStatus)) {
    throw createValidationError("Invalid payment status.");
  }

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