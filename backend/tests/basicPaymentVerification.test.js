import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Order from "../src/models/Order.js";
import { verifyPayment } from "../src/services/paymentService.js";
import { sendRazorpayRequest } from "../src/services/razorpayService.js";

const previous = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
afterEach(() => {
  mock.restoreAll();
  for (const [key, value] of [["RAZORPAY_KEY_ID", previous.id], ["RAZORPAY_KEY_SECRET", previous.secret]])
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
});

function setup(overrides = {}) {
  process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
  process.env.RAZORPAY_KEY_SECRET = "fixture-secret";
  const order = {
    _id: "111111111111111111111111", userId: "222222222222222222222222",
    orderId: "NS-0001", paymentMethod: "razorpay", orderStatus: "pending",
    paymentStatus: "pending", razorpayOrderId: "order_fixture", totalAmount: 15000, __v: 0,
  };
  const payment = {
    id: "pay_fixture", order_id: "order_fixture", amount: 15000,
    currency: "INR", status: "captured", ...overrides,
  };
  mock.method(Order, "findOne", filter => ({ session: () => {
    assert.equal(filter.userId, order.userId);
    return order;
  } }));
  const update = mock.method(Order, "findOneAndUpdate", async (filter, changes) => {
    Object.assign(order, changes.$set);
    order.__v++;
    return order;
  });
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    assert.ok(String(url).endsWith("/payments/pay_fixture"));
    assert.equal(options.headers.Authorization, "Basic " + Buffer.from("rzp_test_fixture:fixture-secret").toString("base64"));
    return new Response(JSON.stringify(payment), { headers: { "Content-Type": "application/json" } });
  });
  const input = {
    params: { id: order._id }, user: { id: order.userId },
    body: {
      razorpay_order_id: "order_fixture", razorpay_payment_id: "pay_fixture",
      razorpay_signature: createHmac("sha256", "fixture-secret").update("order_fixture|pay_fixture").digest("hex"),
    },
  };
  return { order, input, update, fetchMock };
}

test("browser payment result is verified server-side and replay does not settle twice", async () => {
  const s = setup();
  const result = await verifyPayment(s.input);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.order.paymentStatus, "paid");
  assert.equal(result.body.data.order.orderStatus, "confirmed");
  assert.equal((await verifyPayment(s.input)).status, 200);
  assert.equal(s.update.mock.calls.length, 1);
});

test("forged browser signatures fail before provider requests or order updates", async () => {
  const s = setup();
  s.input.body.razorpay_signature = "0".repeat(64);
  await assert.rejects(verifyPayment(s.input), { status: 400 });
  assert.equal(s.fetchMock.mock.calls.length, 0);
  assert.equal(s.update.mock.calls.length, 0);
});

test("incorrect payment amount, currency, identity, order or uncaptured status cannot mark an order paid", async () => {
  for (const invalid of [
    { amount: 1 }, { currency: "USD" }, { id: "pay_other" },
    { order_id: "order_other" }, { status: "failed" },
  ]) {
    const s = setup(invalid);
    await assert.rejects(verifyPayment(s.input), { status: 409 });
    assert.equal(s.update.mock.calls.length, 0);
    mock.restoreAll();
  }
});

test("live credentials cannot send payment-provider requests in this test-only project", async () => {
  const s = setup();
  process.env.RAZORPAY_KEY_ID = "rzp_live_fixture";
  await assert.rejects(sendRazorpayRequest("/orders", { method: "POST" }), { status: 503 });
  assert.equal(s.fetchMock.mock.calls.length, 0);
});
