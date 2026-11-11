import { Link } from "react-router";
import "./customer.css";

const policies = {
  privacy: {
    title: "Privacy Policy",
    intro: "How NORTHSTAR handles the information you share with us.",
    sections: [
      [
        "Information we use",
        "We collect account details, delivery addresses, order information, and messages you submit to support. We use them to manage your account, fulfil orders, prevent misuse, and respond to your requests.",
      ],
      [
        "Payments & delivery",
        "Online payments are handled by Razorpay. NORTHSTAR does not ask you to enter card numbers, CVVs, or banking passwords in its own forms. Order and address information may be shared with payment and delivery providers as needed to process your purchase. PIN-code validation sends only the PIN code to a postal directory service.",
      ],
      [
        "Account security",
        "Keep your password and one-time codes private. Account cookies help keep you signed in. Do not include passwords, identity documents, or full payment details in support messages.",
      ],
      [
        "Your choices",
        "You can update your profile and saved addresses in your account. Contact support to request access to, correction of, or deletion of personal information. Some order and transaction records may need to be retained to handle purchases, refunds, disputes, and applicable record-keeping obligations.",
      ],
      [
        "Questions & updates",
        "Contact us through the support page with privacy questions. This page may be updated as our services change. Review it before providing information or placing a new order.",
      ],
    ],
  },
  terms: {
    title: "Terms & Conditions",
    intro:
      "Please read these terms before using your account or placing an order.",
    sections: [
      [
        "Your account",
        "Provide accurate contact and delivery details and keep your sign-in information secure. You are responsible for activity on your account. We may restrict accounts used for fraud or misuse.",
      ],
      [
        "Prices & order confirmation",
        "Prices, discounts, delivery charges, taxes, and payment options shown at checkout apply to that purchase. Availability and totals are checked again when you place your order. An online order is paid only after the payment has been verified. Cash-on-delivery orders remain payable on delivery.",
      ],
      [
        "Cancellations",
        "Eligible orders can be cancelled from My Orders before shipment. The available actions on an order show its current eligibility. A cancellation can include an optional reason. Cancelling an eligible paid online order automatically credits the paid amount to your Northstar Wallet. Wallet credit can be used for store purchases. Other refunds follow the method and status shown in your order.",
      ],
      [
        "Returns & refunds",
        "You may request a return for a delivered order within the return window shown in My Orders. A reason is required, and supporting photographs can help review. Return requests are reviewed before approval. A return is completed after the received items are checked. Refunds are shown separately from return status and are complete only when recorded as completed. Keep original packaging and included accessories available.",
      ],
      [
        "Wallet credit",
        "Wallet credit is denominated in INR and can pay for an order when it covers the full checkout total. It is store credit and cannot be withdrawn or transferred through this website. Purchases and completed wallet refunds appear in the wallet history. There is no cash top-up feature.",
      ],
      [
        "Need help?",
        "Contact support with your order ID or request reference if an order, product, or payment does not look right. These terms do not remove rights available under applicable consumer law.",
      ],
    ],
  },
  shipping: {
    title: "Shipping Policy",
    intro: "Clear delivery information, from checkout to your doorstep.",
    sections: [
      [
        "Delivery addresses",
        "We accept Indian delivery addresses. Enter a valid six-digit PIN code and a matching city or locality, along with a complete street address and a reachable mobile number. Your state or union territory is filled from the PIN code. Postal validation confirms location data; it does not guarantee courier serviceability.",
      ],
      [
        "Delivery charges",
        "Applicable delivery charges and any free-delivery eligibility are displayed in your order summary before payment. The amount saved with your order is the charge for that purchase.",
      ],
      [
        "Processing & tracking",
        "Follow your order in My Orders as it moves through Pending, Confirmed, Shipped, Out for Delivery, and Delivered. Delivery timing depends on stock, destination, and the delivery provider. We do not promise an arrival date unless a confirmed estimate is shown for your order.",
      ],
      [
        "Address changes & missed delivery",
        "Check your selected address carefully before placing an order. Editing a saved address does not change an existing order's delivery details. Contact support promptly about an incorrect address, missed delivery, or a damaged package.",
      ],
      [
        "Cancellations & returns",
        "Use the eligible cancellation or return action in My Orders. See our Terms & Conditions for the return window and refund process. Contact support if you need assistance.",
      ],
    ],
  },
};
export default function Policies({ kind }) {
  const policy = policies[kind];
  return (
    <main className="customer-page policy-page">
      <header className="customer-heading">
        <span className="customer-eyebrow">NORTHSTAR · Policies & care</span>
        <h1>{policy.title}</h1>
        <p>{policy.intro}</p>
      </header>
      <div className="policy-grid">
        <nav className="customer-card customer-link-list" aria-label="Policies">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-and-conditions">Terms & Conditions</Link>
          <Link to="/shipping-policy">Shipping Policy</Link>
          <Link to="/support">Contact Support →</Link>
        </nav>
        <article className="customer-card">
          {policy.sections.map(([title, body]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
