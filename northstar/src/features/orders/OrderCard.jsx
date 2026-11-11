import { canRequestService, canCancelRequest } from "./requestEligibility.js";
import WalletRefundNotice from "./WalletRefundNotice.jsx";
import { Link } from "react-router";
import {
  ArrowRight, CheckCircle2, CircleX, Clock3, Download,
  PackageCheck, RotateCcw, Truck,
} from "lucide-react";
import { ProductRow } from "./PurchaseParts.jsx";
import { downloadInvoice, orderDate, titleCase } from "./purchaseData.js";
import { money } from "../../utils/money.js";

const statusIcons = {
  pending: Clock3,
  confirmed: PackageCheck,
  shipped: Truck,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  cancelled: CircleX,
};

export default function OrderCard({ order, busy, run, addToCart, onCheckout }) {
  const StatusIcon = statusIcons[order.orderStatus] || Clock3;
  const canCancel = ["pending", "confirmed"].includes(order.orderStatus);
  const returnStatus = order.returnRequest?.status;
  const canReturn = canRequestService(order);
  const paymentMethod = {
    cod: "Cash on delivery",
    wallet: "Northstar Wallet",
    razorpay: "Online payment",
  }[order.paymentMethod];

  return (
    <article className="order-card" aria-labelledby={`order-${order.id}`}>
      <header className="order-card-meta">
        <div className="order-card-reference">
          <h2 id={`order-${order.id}`}>{order.orderId}</h2>
          <span>Placed {orderDate(order.createdAt)}</span>
        </div>
        <div className="order-card-recipient">
          <span>Deliver to</span>
          <strong>{order.shippingAddress.name}</strong>
        </div>
        <div className="order-card-total">
          <span>Order total</span>
          <strong>{money(order.totalAmount)}</strong>
        </div>
        <button
          type="button"
          className="order-card-invoice"
          aria-label={`Download invoice for ${order.orderId}`}
          disabled={busy}
          onClick={() => run(order.id, () => downloadInvoice(order))}
        >
          <Download size={15} aria-hidden="true" /> Invoice
        </button>
      </header>
      <div className="order-card-body">
        <div className="order-card-status-row">
          <span className={`order-card-status is-${order.orderStatus}`}>
            <StatusIcon size={18} aria-hidden="true" />
            {titleCase(order.orderStatus)}
          </span>
          <span className="order-card-payment">
            <span>{paymentMethod}</span>
            <span className={`order-payment-badge is-${order.paymentStatus}`}>
              {titleCase(order.paymentStatus)}
            </span>
          </span>
        </div>
        <div className="order-card-products">
          {order.items.map((item, index) => (
            <ProductRow item={item} key={index}>
              {item.productId && addToCart && (
                <div className="order-card-buy">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(order.id, async () => {
                      const added = await addToCart(item.productId, item.variantId, 1);
                      if (added) onCheckout();
                    })}
                  >
                    <RotateCcw size={13} aria-hidden="true" /> Buy it again
                  </button>
                </div>
              )}
            </ProductRow>
          ))}
        </div>
      </div>
      <WalletRefundNotice order={order} />
      <footer className="order-card-actions">
        <div className="order-card-secondary-actions">
          {canCancel && (
            <Link className="purchase-button" to={`/orders/${order.id}#cancel`}>
              Request cancellation
            </Link>
          )}
          {canReturn && (
            <Link className="purchase-button" to={`/orders/${order.id}/return${returnStatus && returnStatus !== "none" ? "?newRequest=1" : ""}`}>
              Return / replacement
            </Link>
          )}
          {canCancelRequest(order) && <Link className="purchase-button" to={`/orders/${order.id}/return`}>Manage {order.returnRequest.resolution === "replacement" ? "replacement" : "return"} request</Link>}
          {returnStatus && returnStatus !== "none" && (
            <span>{order.returnRequest.resolution === "replacement" ? "Replacement" : "Return"}: {titleCase(order.returnRequest.replacementStatus && order.returnRequest.replacementStatus !== "none" ? order.returnRequest.replacementStatus : returnStatus)}</span>
          )}
        </div>
        <Link className="purchase-button purchase-primary" to={`/orders/${order.id}`}>
          View order details <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </footer>
    </article>
  );
}
