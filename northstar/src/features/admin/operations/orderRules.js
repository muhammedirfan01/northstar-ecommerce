export function canMarkPaid(order) {
  return (
    order.paymentMethod === "cod" &&
    order.paymentStatus === "pending" &&
    [
      "pending",
      "confirmed",
      "shipped",
      "out_for_delivery",
      "delivered",
    ].includes(order.orderStatus)
  );
}
