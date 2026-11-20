import test from "node:test";
import assert from "node:assert/strict";
import Order from "../src/models/Order.js";
import { recordRazorpayRefund } from "../src/services/refundService.js";
import { savedOrder, queryResult } from "./scenarioHelpers.js";

const order = (changes = {}) => savedOrder({ paymentMethod: "razorpay", paymentStatus: "paid",
  razorpayPaymentId: "pay_fixture", refund: { status: "pending", amount: 15000 }, ...changes });
const refund = () => ({ id: "rfnd_fixture", payment_id: "pay_fixture", amount: 15000, currency: "INR", status: "processed" });

for (const [field, value] of [["payment_id", "pay_other"], ["amount", 1], ["currency", "USD"], ["id", "fake"], ["status", "unknown"]]) {
  test(`refund rejects mismatched ${field} before changing the order`, async (t) => {
    const write = t.mock.method(Order, "findOneAndUpdate", () => { throw Error("Unexpected refund write"); });
    await assert.rejects(recordRazorpayRefund(order(), { ...refund(), [field]: value }), { status: 409 });
    assert.equal(write.mock.callCount(), 0);
  });
}

test("processed gateway refund records the reference and marks the original payment refunded", async (t) => {
  const write = t.mock.method(Order, "findOneAndUpdate", () => queryResult(order({ paymentStatus: "refunded" })));
  const result = await recordRazorpayRefund(order(), refund());
  assert.equal(result.paymentStatus, "refunded");
  const [filter, update] = write.mock.calls[0].arguments;
  assert.deepEqual(filter["refund.status"], { $ne: "completed" });
  assert.equal(filter["refund.amount"], 15000);
  assert.equal(update.$set["refund.reference"], "rfnd_fixture");
  assert.equal(update.$push.paymentHistory.status, "refund_completed");
});

test("pending refund preserves payment status until the provider completes it", async (t) => {
  const write = t.mock.method(Order, "findOneAndUpdate", () => queryResult(order()));
  await recordRazorpayRefund(order(), { ...refund(), status: "pending" });
  assert.equal(write.mock.calls[0].arguments[1].$set["refund.status"], "processing");
  assert.equal(Object.hasOwn(write.mock.calls[0].arguments[1].$set, "paymentStatus"), false);
});

test("refunding a duplicate online charge preserves the valid wallet purchase", async (t) => {
  const value = order({ paymentMethod: "wallet", refund: { status: "pending", amount: 15000, reason: "duplicate_payment" } });
  const write = t.mock.method(Order, "findOneAndUpdate", () => queryResult(value));
  await recordRazorpayRefund(value, refund());
  assert.equal(Object.hasOwn(write.mock.calls[0].arguments[1].$set, "paymentStatus"), false);
});

test("a completed gateway refund replay performs no additional write", async (t) => {
  const value = order({ refund: { status: "completed", amount: 15000 } });
  const write = t.mock.method(Order, "findOneAndUpdate", () => { throw Error("Duplicate refund write"); });
  assert.equal(await recordRazorpayRefund(value, refund()), value);
  assert.equal(write.mock.callCount(), 0);
});
