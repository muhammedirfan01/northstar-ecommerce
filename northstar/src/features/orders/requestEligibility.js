export function canStartFollowup(order) {
  const request = order?.returnRequest;
  return order?.orderStatus === "delivered" && order.paymentStatus === "paid" && ((request?.resolution === "replacement" && request.status === "completed" && request.replacementStatus === "delivered") || (["cancelled", "rejected"].includes(request?.status) && !request.replacementReservedAt));
}
export function canRequestService(order) { return order?.orderStatus === "delivered" && (!order.returnRequest?.status || order.returnRequest.status === "none" || canStartFollowup(order)); }
export function canCancelRequest(order) { const request = order?.returnRequest; return order?.orderStatus === "delivered" && (["requested", "accepted"].includes(request?.status) || (request?.resolution === "replacement" && request.status === "completed" && request.replacementStatus === "ready_to_ship")); }
