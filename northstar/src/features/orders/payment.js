import API from "../../api/API.js";
let checkoutScript;
const activePayments = new Map();
const requestOptions = { timeout: 30000 };
const settled = (order) => ["paid", "refunded"].includes(order.paymentStatus);
export async function reconcilePayment(id, admin = false) {
  const { data } = await API.post(
    `${admin ? "/admin" : ""}/orders/${id}/payment/reconcile`,
    {},
    requestOptions,
  );
  return data.data.order;
}
function loadCheckout() {
  if (typeof window.Razorpay === "function") return Promise.resolve();
  if (!checkoutScript)
    checkoutScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => {
        clearTimeout(timer);
        checkoutScript = null;
        script.remove();
        reject(
          new Error(
            "Razorpay payment window could not load. Check your connection or browser extensions and try again.",
          ),
        );
      };
      const timer = setTimeout(fail, 15000);
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        clearTimeout(timer);
        if (typeof window.Razorpay === "function") resolve();
        else fail();
      };
      script.onerror = fail;
      document.head.appendChild(script);
    });
  return checkoutScript;
}
export function preparePayment() {
  return loadCheckout();
}
async function openPayment(id) {
  const { data } = await API.post(`/orders/${id}/payment`, {}, requestOptions);
  if (settled(data.data.order)) return data.data.order;
  if (!data.data.checkout?.order_id)
    throw new Error(
      "Payment setup is incomplete. Check the payment status before retrying.",
    );
  await loadCheckout();
  return new Promise((resolve, reject) => {
    let finished = false,
      verifying = false,
      checkout;
    function finish(error, order) {
      if (finished) return;
      finished = true;
      if (error) {
        try {
          checkout?.close?.();
        } catch {
          /* A close failure must not hide the payment result. */
        }
        reject(error);
      } else resolve(order);
    }
    try {
      checkout = new window.Razorpay({
        ...data.data.checkout,
        name: "NORTHSTAR",
        retry: { enabled: false },
        handler: async (result) => {
          if (finished || verifying) return;
          verifying = true;
          try {
            const { data: verified } = await API.post(
              `/orders/${id}/payment/verify`,
              {
                razorpay_order_id: result.razorpay_order_id,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
              },
              requestOptions,
            );
            finish(null, verified.data.order);
          } catch (error) {
            // The server may have committed before its response was lost.
            try {
              const order = await reconcilePayment(id);
              if (settled(order)) {
                finish(null, order);
                return;
              }
            } catch {
              /* Keep the original verification error. */
            }
            finish(error);
          }
        },
        modal: {
          ondismiss: () => {
            if (!verifying)
              finish(
                new Error(
                  "Payment was not completed. You can retry from this order.",
                ),
              );
          },
        },
      });
      checkout.on("payment.failed", () => {
        if (!verifying)
          finish(new Error("Payment failed. You can retry from this order."));
      });
      checkout.open();
    } catch {
      finish(
        new Error(
          "Razorpay could not open. Please retry from your order details.",
        ),
      );
    }
  });
}
export function payForOrder(id) {
  if (!activePayments.has(id)) {
    const promise = openPayment(id).finally(() => activePayments.delete(id));
    activePayments.set(id, promise);
  }
  return activePayments.get(id);
}
