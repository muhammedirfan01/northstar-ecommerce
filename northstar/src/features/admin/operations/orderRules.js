export function canMarkPaid(order) {
  return (
    order.paymentMethod === "cod" &&
    order.paymentStatus === "pending" &&
    order.returnRequest?.status !== "completed" &&
    [
      "pending",
      "confirmed",
      "shipped",
      "out_for_delivery",
      "delivered",
    ].includes(order.orderStatus)
  );
}
