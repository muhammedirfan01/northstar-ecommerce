import { orderDate, titleCase } from "./purchaseData.js";
export default function RequestHistory({ order }) {
  if (!order.returnHistory?.length) return null;
  return <details className="purchase-panel"><summary>Previous return and replacement requests</summary><ol>{order.returnHistory.map((request, index) => <li key={request.reference || index}>{request.reference} · {request.resolution === "replacement" ? "Replacement" : "Return"} · {titleCase(request.replacementStatus === "delivered" ? "delivered" : request.status)}<p>{request.reason}</p><small>{orderDate(request.requestedAt)}</small></li>)}</ol></details>;
}
