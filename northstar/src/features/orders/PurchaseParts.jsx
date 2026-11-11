import { Package, Check, Truck } from "lucide-react";
import { money } from "../../utils/money.js";
import { titleCase, orderDate } from "./purchaseData.js";

export function ProductRow({ item, children }) {
  return (
    <div className="purchase-product">
      <div className="purchase-image">
        {item.productImage ? (
          <img src={item.productImage} alt={item.productName} />
        ) : (
          <Package size={32} aria-label="Product image unavailable" />
        )}
      </div>
      <div className="purchase-product-copy">
        <h3>{item.productName}</h3>
        <p>{item.variantName || "Northstar collection"}</p>
        <small>Qty: {item.quantity}</small>
        {children}
      </div>
      <strong>{money(item.lineTotalPaise)}</strong>
    </div>
  );
}
export function DeliveryAddress({ address }) {
  return (
    <address>
      <strong>{address.name}</strong>
      <br />
      {address.addressLine1}
      <br />
      {address.addressLine2 && (
        <>
          {address.addressLine2}
          <br />
        </>
      )}
      {address.city}, {address.state} — {address.pincode}
      <br />
      {address.phone}
    </address>
  );
}
export function PriceSummary({ order }) {
  return (
    <dl className="purchase-prices">
      <dt>Items subtotal</dt>
      <dd>{money(order.subtotal)}</dd>
      <dt>Delivery</dt>
      <dd>{order.shippingCharge ? money(order.shippingCharge) : "FREE"}</dd>
      <dt>Discount{order.offerDiscount > 0 ? " (offers + coupon)" : ""}</dt>
      <dd className="purchase-green">−{money(order.discount)}</dd>
      {order.appliedOffers?.length > 0 && (
        <>
          <dt>Offers applied</dt>
          <dd>
            {[...new Set(order.appliedOffers.map((o) => o.name))].join(", ")}
          </dd>
        </>
      )}
      <dt>Tax</dt>
      <dd>{money(order.tax || 0)}</dd>
      <dt className="purchase-total">Total payable</dt>
      <dd className="purchase-total">{money(order.totalAmount)}</dd>
    </dl>
  );
}
export function OrderTimeline({ order }) {
  const steps = [
    "pending",
    "confirmed",
    "shipped",
    "out_for_delivery",
    "delivered",
  ];
  const current = steps.indexOf(order.orderStatus);
  return (
    <section className="purchase-panel">
      <div className="purchase-section-label">
        <span>
          <Truck size={16} /> Order progress
        </span>
        <span>{titleCase(order.orderStatus)}</span>
      </div>
      {order.orderStatus === "cancelled" ? (
        <p>
          Cancelled {orderDate(order.cancelledAt)}
          {order.cancellationReason && ` · ${order.cancellationReason}`}
        </p>
      ) : (
        <ol className="purchase-timeline">
          {steps.map((step, index) => {
            const event = order.statusHistory?.find((e) => e.status === step);
            return (
              <li className={index <= current ? "is-complete" : ""} key={step}>
                <span>{index <= current ? <Check size={12} /> : ""}</span>
                <div>
                  <b>{titleCase(step)}</b>
                  <small>
                    {event
                      ? orderDate(event.at)
                      : index > current
                        ? "Awaiting update"
                        : "Completed"}
                  </small>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
