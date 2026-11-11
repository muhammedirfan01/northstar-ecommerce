import WalletRefundNotice from "./WalletRefundNotice.jsx";
import { useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import {
  Check,
  Download,
  ArrowUpRight,
  Banknote,
  Wallet,
  RotateCcw,
  ArrowRight,
  CreditCard,
  MapPin,
} from "lucide-react";
import { payForOrder } from "./payment.js";
import API from "../../api/API.js";
import { money } from "../../utils/money.js";
import {
  useCustomerOrder,
  downloadInvoice,
  titleCase,
  orderDate,
} from "./purchaseData.js";
import {
  ProductRow,
  PriceSummary,
  DeliveryAddress,
  OrderTimeline,
} from "./PurchaseParts.jsx";
import PurchaseHelp from "./PurchaseHelp.jsx";
import "./purchase.css";

export default function PaymentResult() {
  const { id } = useParams(),
    navigate = useNavigate(),
    location = useLocation();
  const { order, setOrder, error, refresh } = useCustomerOrder(id);
  const [actionError, setActionError] = useState(
      location.state?.paymentError || "",
    ),
    [busy, setBusy] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const paid = ["paid", "refunded"].includes(order?.paymentStatus);
  const confirmed =
    order &&
    order.orderStatus !== "cancelled" &&
    (paid || order.paymentMethod === "cod");
  async function run(task) {
    setBusy(true);
    setActionError("");
    try {
      await task();
    } catch (e) {
      setActionError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    await payForOrder(id);
    navigate(`/orders/${id}/payment/success`, { replace: true });
    refresh();
  }
  async function switchMethod(paymentMethod) {
    const { data } = await API.post(`/orders/${id}/payment-method`, { paymentMethod });
    setOrder(data.data.order);
    navigate(`/orders/${id}/payment/success`, { replace: true });
  }
  return (
    <main className="purchase-page">
      <WalletRefundNotice order={order} />
      {(error || actionError) && (
        <p role="alert" className="purchase-alert">
          {error || actionError}
        </p>
      )}
      {!order ? (
        !error && <p role="status">Checking payment…</p>
      ) : confirmed ? (
        <>
          <header className="purchase-confirmation">
            <span className="purchase-confirmation-tag">
              Order {titleCase(order.orderStatus)}
            </span>
            <div className="purchase-success-icon">
              <Check size={30} />
            </div>
            <h1>
              Thank You for Your Order,
              <br />
              {
                (
                  order.customer?.name ||
                  order.shippingAddress?.name ||
                  "Customer"
                ).split(" ")[0]
              }
              !
            </h1>
            <p>
              Your order <b>{order.orderId}</b> is{" "}
              {titleCase(order.orderStatus).toLowerCase()}.{" "}
              {order.paymentMethod === "cod" && !paid
                ? "Payment is due on delivery."
                : order.paymentStatus === "refunded"
                  ? "Your payment has been refunded."
                  : "Your payment has been verified by the server."}
            </p>
            <div className="purchase-buttons">
              <Link
                to={`/orders/${id}`}
                className="purchase-button purchase-primary"
              >
                <ArrowUpRight size={15} />
                Track order status
              </Link>
              <button
                disabled={busy}
                onClick={() => run(() => downloadInvoice(order))}
              >
                <Download size={15} />
                Download PDF invoice
              </button>
            </div>
          </header>
          <div className="purchase-columns">
            <div className="purchase-stack">
              <OrderTimeline order={order} />
              <section className="purchase-panel">
                <div className="purchase-section-label">
                  <span>Purchased Order</span>
                  <span>{order.orderId}</span>
                </div>
                {order.items.map((item, i) => (
                  <ProductRow item={item} key={i} />
                ))}
              </section>
            </div>
            <div className="purchase-stack">
              <section className="purchase-panel">
                <div className="purchase-section-label">
                  <span>Financial settlement</span>
                  <span className={paid ? "purchase-green" : ""}>
                    {order.paymentStatus === "refunded"
                      ? "Payment refunded"
                      : paid
                        ? "Payment confirmed"
                        : "Pay on delivery"}
                  </span>
                </div>
                <PriceSummary order={order} />
                <small>
                  {order.paymentMethod === "cod"
                    ? "Cash on delivery"
                    : order.paymentMethod === "wallet"
                      ? "Paid with Northstar Wallet"
                      : "Paid online through Razorpay"}
                </small>
              </section>
              <section className="purchase-panel">
                <div className="purchase-section-label">
                  <MapPin size={16} />
                  Confirmed delivery address
                </div>
                <div className="purchase-muted-box">
                  <DeliveryAddress address={order.shippingAddress} />
                </div>
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="purchase-columns">
          <div className="purchase-stack">
            <section className="purchase-panel purchase-failure">
              <div className="purchase-eyebrow">
                <CreditCard size={24} />
                Payment not completed
              </div>
              <h1>Payment Could Not Be Processed</h1>
              <p>
                {order.orderStatus === "cancelled"
                  ? "This order has been cancelled. Check the order details for any refund updates."
                  : "Your order is saved. Retry payment securely without creating another order."}
              </p>
              <div className="purchase-failure-facts">
                <div>
                  <small>Order reference</small>
                  <b>{order.orderId}</b>
                </div>
                <div>
                  <small>Payment status</small>
                  <b>{titleCase(order.paymentStatus)}</b>
                </div>
                <div>
                  <small>Order placed</small>
                  <b>{orderDate(order.createdAt)}</b>
                </div>
                <div>
                  <small>Order total</small>
                  <b>{money(order.totalAmount)}</b>
                </div>
              </div>
              <div className="purchase-buttons purchase-failure-actions">
                {order.orderStatus !== "cancelled" && order.paymentMethod === "razorpay" && (
                  <button className="purchase-primary" disabled={busy} onClick={() => run(retry)}>
                    <RotateCcw size={15} aria-hidden="true" />Retry payment
                  </button>
                )}
                {order.orderStatus !== "cancelled" && order.paymentMethod === "razorpay" && (
                  <button
                    disabled={busy}
                    aria-expanded={showMethods}
                    aria-controls="alternative-payment"
                    onClick={() => setShowMethods(!showMethods)}
                  >
                    Use another method <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
                <Link className="purchase-button" to={`/orders/${id}`}>
                  View order details <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
              {showMethods && order.orderStatus !== "cancelled" && order.paymentMethod === "razorpay" && (
                <section className="purchase-method-picker" id="alternative-payment" aria-label="Choose payment method">
                  <h2>Choose a payment method</h2>
                  <div className="purchase-method-options">
                    <button disabled={busy} onClick={() => run(() => switchMethod("cod"))}>
                      <Banknote size={22} aria-hidden="true" />
                      <span>Cash on delivery<small>Pay when your order arrives</small></span>
                    </button>
                    <button disabled={busy} onClick={() => run(() => switchMethod("wallet"))}>
                      <Wallet size={22} aria-hidden="true" />
                      <span>Northstar Wallet<small>Pay with your wallet balance</small></span>
                    </button>
                  </div>
                  {busy && <p role="status">Updating payment…</p>}
                </section>
              )}
            </section>
            <div className="purchase-muted-box">
              <b>Was money deducted from your bank?</b>
              <p>
                If a debit appears without a confirmed order payment, check your
                bank and payment provider for its status. Your order history
                will show any verified payment or refund.
              </p>
            </div>
          </div>
          <aside className="purchase-panel purchase-checkout-summary">
            {order.items.map((item, i) => (
              <ProductRow key={i} item={item} />
            ))}
            <PriceSummary order={order} />
            <div className="purchase-muted-box">
              <small className="purchase-eyebrow">Shipping destination</small>
              <DeliveryAddress address={order.shippingAddress} />
            </div>
          </aside>
        </div>
      )}
      <div className="purchase-footer-actions">
        <Link className="purchase-button" to="/orders">My orders <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <PurchaseHelp />
    </main>
  );
}
