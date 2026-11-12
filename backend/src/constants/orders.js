export const ORDER_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const ORDER_TRANSITIONS = Object.freeze({
  pending: ["confirmed"],
  confirmed: ["shipped"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
});
