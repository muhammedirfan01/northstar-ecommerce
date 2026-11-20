import test from "node:test";
import assert from "node:assert/strict";
import { canRequestService, canStartFollowup, canCancelRequest } from "../src/features/orders/requestEligibility.js";
import { canMarkPaid } from "../src/features/admin/operations/orderRules.js";
import { canRefundToWallet } from "../src/features/admin/operations/refundOptions.js";

test("return request actions follow delivery state and prevent duplicate open requests", () => {
  assert.equal(canRequestService({ orderStatus: "shipped" }), false);
  assert.equal(canRequestService({ orderStatus: "delivered", returnRequest: { status: "none" } }), true);
  assert.equal(canRequestService({ orderStatus: "delivered", returnRequest: { status: "requested" } }), false);
});

test("a completed replacement permits followup only after delivery and payment", () => {
  const order = { orderStatus: "delivered", paymentStatus: "paid",
    returnRequest: { resolution: "replacement", status: "completed", replacementStatus: "shipped" } };
  assert.equal(canStartFollowup(order), false);
  order.returnRequest.replacementStatus = "delivered";
  assert.equal(canStartFollowup(order), true);
  order.paymentStatus = "pending";
  assert.equal(canStartFollowup(order), false);
});

test("replacement cancellation is available before dispatch and closes after shipment", () => {
  const order = { orderStatus: "delivered", returnRequest: {
    resolution: "replacement", status: "completed", replacementStatus: "ready_to_ship" } };
  assert.equal(canCancelRequest(order), true);
  order.returnRequest.replacementStatus = "shipped";
  assert.equal(canCancelRequest(order), false);
});

test("manual payment action is limited to pending COD payments on active orders", () => {
  const order = { paymentMethod: "cod", paymentStatus: "pending", orderStatus: "confirmed" };
  assert.equal(canMarkPaid(order), true);
  assert.equal(canMarkPaid({ ...order, paymentMethod: "razorpay" }), false);
  assert.equal(canMarkPaid({ ...order, paymentStatus: "paid" }), false);
  assert.equal(canMarkPaid({ ...order, orderStatus: "cancelled" }), false);
  assert.equal(canMarkPaid({ ...order, orderStatus: "delivered", returnRequest: { status: "completed" } }), false);
});

test("wallet refund action excludes replacements, gateway refunds and duplicate-payment refunds", () => {
  const order = { orderStatus: "cancelled", paymentStatus: "paid", refund: { status: "pending", method: "cash" } };
  assert.equal(canRefundToWallet(order), true);
  assert.equal(canRefundToWallet({ ...order, returnRequest: { resolution: "replacement" } }), false);
  for (const changes of [{ method: "razorpay" }, { reference: "rfnd_existing" }, { reason: "duplicate_payment" }, { status: "completed" }]) {
    assert.equal(canRefundToWallet({ ...order, refund: { ...order.refund, ...changes } }), false);
  }
});
