export function canRefundToWallet(order) {
  return order.returnRequest?.resolution !== "replacement" && order.paymentStatus === "paid" && ["pending", "failed"].includes(order.refund?.status) && ["cash", "wallet"].includes(order.refund.method) && !order.refund.reference && order.refund.reason !== "duplicate_payment" && (order.orderStatus === "cancelled" || order.returnRequest?.status === "completed");
}
