import { CalendarDays } from "lucide-react";
import { titleCase } from "./purchaseData.js";

function dateTime(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default function OrderInformation({ order }) {
  const dates = [order.createdAt, ...(order.statusHistory || []).map(event => event.at),
    ...(order.paymentHistory || []).map(event => event.at)]
    .filter(value => value && Number.isFinite(new Date(value).getTime()));
  const latest = dates.length ? new Date(Math.max(...dates.map(value => new Date(value).getTime()))) : null;
  const method = { cod: "Cash on delivery", wallet: "Northstar Wallet", razorpay: "Razorpay" }[order.paymentMethod] || "—";
  return (
    <section className="purchase-panel order-information" aria-labelledby="order-information-title">
      <h2 id="order-information-title"><CalendarDays size={18} aria-hidden="true" />Order information</h2>
      <dl className="order-information-grid">
        <div><dt>Order placed</dt><dd>{dateTime(order.createdAt)}</dd></div>
        <div><dt>Latest update</dt><dd>{dateTime(latest)}</dd></div>
        <div><dt>Order status</dt><dd>{titleCase(order.orderStatus)}</dd></div>
        <div><dt>Payment method</dt><dd>{method}</dd></div>
      </dl>
    </section>
  );
}
