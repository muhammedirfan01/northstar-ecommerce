import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import Order from "../src/models/Order.js";
import { recordConfirmedPayment, startPayment } from "../src/services/paymentService.js";
import {
  isOnlinePaymentReady,
  isValidPaymentSignature,
} from "../src/services/razorpayService.js";

afterEach(() => mock.restoreAll());
const order = () => ({
  _id: "111111111111111111111111",
  razorpayOrderId: "order_fixture",
  orderStatus: "pending",
  paymentStatus: "pending",
  totalAmount: 15000,
});
const payment = () => ({
  id: "pay_fixture",
  order_id: "order_fixture",
  status: "captured",
  amount: 15000,
  currency: "INR",
});

// Exercise the shipped browser payment client without browser automation or a provider charge.
function paymentClient() {
  const state = {
    scriptMode: "loaded",
    sdkMode: "normal",
    appends: 0,
    opens: 0,
    closes: 0,
    requests: [],
    options: null,
    events: {},
  };
  const window = {};
  function install() {
    window.Razorpay = class {
      constructor(options) {
        if (state.sdkMode === "constructor-error")
          throw Error("fixture constructor error");
        state.options = options;
      }
      on(name, callback) {
        state.events[name] = callback;
      }
      open() {
        state.opens++;
        if (state.sdkMode === "open-error") throw Error("fixture open error");
      }
      close() {
        state.closes++;
        state.options.modal.ondismiss();
      }
    };
  }
  const document = {
    createElement: () => ({ remove() {} }),
    head: {
      appendChild(script) {
        state.appends++;
        queueMicrotask(() => {
          if (state.scriptMode === "blocked") script.onerror();
          else {
            install();
            script.onload();
          }
        });
      },
    },
  };
  const pending = { id: "fixture", paymentStatus: "pending" };
  const API = {
    async post(url, body) {
      state.requests.push({ url, body });
      if (url.endsWith("/verify"))
        return {
          data: { data: { order: { ...pending, paymentStatus: "paid" } } },
        };
      return {
        data: {
          data: {
            order: pending,
            checkout: {
              order_id: "order_fixture",
              key: "rzp_test_fixture",
              amount: 15000,
              currency: "INR",
            },
          },
        },
      };
    },
  };
  const source = readFileSync(
    new URL("../../northstar/src/features/orders/payment.js", import.meta.url),
    "utf8",
  )
    .replace(/^import API[^\n]*\n/, "")
    .replace(/^export /gm, "");
  const context = { API, window, document, setTimeout, clearTimeout };
  vm.runInNewContext(
    source + "\nglobalThis.client = { preparePayment, payForOrder };",
    context,
  );
  return { state, window, ...context.client };
}
test("Razorpay SDK readiness rejects a blocked script before payment requests and permits retry", async () => {
  const client = paymentClient();
  client.state.scriptMode = "blocked";
  await assert.rejects(
    client.preparePayment(),
    /payment window could not load/,
  );
  assert.equal(client.state.requests.length, 0);
  client.state.scriptMode = "loaded";
  await client.preparePayment();
  assert.equal(typeof client.window.Razorpay, "function");
  assert.equal(client.state.appends, 2);
});
test("complete-order payment client opens once, verifies callback fields and resolves paid", async () => {
  const client = paymentClient();
  await client.preparePayment();
  const first = client.payForOrder("fixture"),
    duplicate = client.payForOrder("fixture");
  assert.equal(first, duplicate);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.state.opens, 1);
  assert.equal(client.state.options.order_id, "order_fixture");
  await client.state.options.handler({
    razorpay_order_id: "order_fixture",
    razorpay_payment_id: "pay_fixture",
    razorpay_signature: "fixture",
    extra: "must not be sent",
  });
  assert.equal((await first).paymentStatus, "paid");
  assert.equal(client.state.requests.length, 2);
  assert.equal(Object.hasOwn(client.state.requests[1].body, "extra"), false);
});
test("Razorpay constructor and modal-open failures reject with a visible retry message", async () => {
  for (const sdkMode of ["constructor-error", "open-error"]) {
    const client = paymentClient();
    await client.preparePayment();
    client.state.sdkMode = sdkMode;
    await assert.rejects(
      client.payForOrder("fixture"),
      /Razorpay could not open/,
    );
    if (sdkMode === "open-error") assert.equal(client.state.closes, 1);
  }
});
test("Razorpay dismissal and failure can retry the same order without a duplicate active modal", async () => {
  const client = paymentClient();
  await client.preparePayment();
  const first = client.payForOrder("fixture");
  const dismissed = assert.rejects(first, /not completed/);
  await new Promise((resolve) => setImmediate(resolve));
  client.state.options.modal.ondismiss();
  await dismissed;
  const retry = client.payForOrder("fixture");
  const failed = assert.rejects(retry, /Payment failed/);
  await new Promise((resolve) => setImmediate(resolve));
  client.state.events["payment.failed"]();
  await failed;
  assert.equal(client.state.opens, 2);
  assert.ok(
    client.state.requests.every(
      (request) => request.url === "/orders/fixture/payment",
    ),
  );
});
test("missing merchant keys cannot leave an existing order stuck in payment setup", async () => {
  const before = process.env.RAZORPAY_KEY_SECRET;
  try {
    delete process.env.RAZORPAY_KEY_SECRET;
    mock.method(Order, "findOne", () => ({
      session: async () => ({ ...order(), paymentMethod: "razorpay" }),
    }));
    mock.method(Order, "findOneAndUpdate", () => {
      throw Error("Configuration failure must not claim payment setup");
    });
    await assert.rejects(
      startPayment({
        params: { id: order()._id },
        user: { id: order()._id },
        body: {},
      }),
      (error) => error.status === 503,
    );
  } finally {
    if (before === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = before;
  }
});
test("verified capture that races with cancellation remains cancelled and creates a refund", async () => {
  let calls = 0;
  mock.method(Order, "findById", async () => ({
    ...order(),
    orderStatus: "cancelled",
  }));
  mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    calls++;
    if (calls === 1) return null;
    assert.equal(filter.orderStatus, "cancelled");
    assert.equal(update.$set.orderStatus, "cancelled");
    assert.equal(update.$set.refund.status, "pending");
    assert.equal(update.$set.refund.amount, 15000);
    return { ...order(), ...update.$set };
  });
  const result = await recordConfirmedPayment(order(), payment());
  assert.equal(calls, 2);
  assert.equal(result.orderStatus, "cancelled");
  assert.equal(result.paymentStatus, "paid");
});
test("capture replay is read-only and a different captured payment cannot replace the recorded payment", async () => {
  mock.method(Order, "findOneAndUpdate", () => {
    throw Error("Replay must not write");
  });
  const paid = {
    ...order(),
    paymentStatus: "paid",
    razorpayPaymentId: "pay_fixture",
  };
  assert.equal(await recordConfirmedPayment(paid, payment()), paid);
  await assert.rejects(
    recordConfirmedPayment(paid, { ...payment(), id: "pay_other" }),
    (error) => error.status === 409,
  );
  assert.equal(
    await recordConfirmedPayment({ ...paid, paymentStatus: "refunded" }, payment()).then(
      (value) => value.paymentStatus,
    ),
    "refunded",
  );
});
test("capture rejects a mismatched payment identity, amount, currency or unconfirmed status before writing", async () => {
  mock.method(Order, "findOneAndUpdate", () => {
    throw Error("Invalid payment must not write");
  });
  for (const invalid of [
    { id: "bad" },
    { order_id: "order_other" },
    { amount: 14999 },
    { currency: "USD" },
    { status: "authorized" },
  ])
    await assert.rejects(
      recordConfirmedPayment(order(), { ...payment(), ...invalid }),
      (error) => error.status === 409,
    );
});
test("payment config and signatures reject empty keys and malformed or tampered signatures", () => {
  const keys = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    before = keys.map((key) => process.env[key]);
  try {
    process.env.RAZORPAY_KEY_ID = " ";
    process.env.RAZORPAY_KEY_SECRET = " ";
    assert.equal(isOnlinePaymentReady(), false);
    process.env.RAZORPAY_KEY_ID = " rzp_test_fixture ";
    process.env.RAZORPAY_KEY_SECRET = " fixture-only-secret ";
    assert.equal(isOnlinePaymentReady(), true);
    process.env.RAZORPAY_KEY_ID = "rzp_live_fixture";
    assert.equal(isOnlinePaymentReady(), false);
    process.env.RAZORPAY_KEY_ID = "rzp_test_fixture";
    const signature = createHmac("sha256", "fixture-only-secret")
      .update("order_fixture|pay_fixture")
      .digest("hex");
    assert.equal(
      isValidPaymentSignature("order_fixture", "pay_fixture", signature),
      true,
    );
    for (const value of [undefined, "abc", "0".repeat(64), "z".repeat(64)])
      assert.equal(
        isValidPaymentSignature("order_fixture", "pay_fixture", value),
        false,
      );
    assert.equal(
      isValidPaymentSignature("order_other", "pay_fixture", signature),
      false,
    );
  } finally {
    keys.forEach((key, index) => {
      if (before[index] === undefined) delete process.env[key];
      else process.env[key] = before[index];
    });
  }
});
