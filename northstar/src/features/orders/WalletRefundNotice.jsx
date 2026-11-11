import { Link } from "react-router";
import { money } from "../../utils/money.js";

export default function WalletRefundNotice({ order }) {
  if (!order) return null;
  const refund = order.refund;
  if (refund?.method === "wallet" && refund.status === "completed") return (
    <div className="purchase-muted-box" role="status">
      <p className="purchase-green">Refunded amount added to wallet. {money(refund.amount)}</p>
      <Link className="purchase-button" to="/wallet">Check my wallet</Link>
    </div>
  );
  if (order.returnRequest?.resolution === "replacement") return null;
  if (order.paymentStatus === "paid" && ["requested", "accepted"].includes(order.returnRequest?.status)) return (
    <p className="purchase-muted-box" role="status">{order.returnRequest.status === "accepted" ? "Your return request has been accepted. The paid amount will be refunded to your wallet after the returned goods are received and the refund is processed." : "If your return request is accepted, the paid amount will be refunded to your wallet after the returned goods are received and the refund is processed."}</p>
  );
  if (refund?.method === "wallet" && ["pending", "processing", "failed"].includes(refund.status)) return <p className="purchase-muted-box" role="status">{refund.status === "failed" ? "Your wallet refund could not be completed yet. Please contact support." : "Your refund is pending. The amount will be added to your wallet once the refund is processed."}</p>;
  if (order.orderStatus === "cancelled" && ["pending", "failed"].includes(order.paymentStatus) && (!refund?.status || refund.status === "none")) return <p className="purchase-muted-box" role="status">No completed payment is recorded, so no wallet refund is due. If money was deducted, check payment status or contact support.</p>;
  return null;
}
