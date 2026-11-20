import test from "node:test";
import assert from "node:assert/strict";
import Order from "../src/models/Order.js";
import { updateOrderStatus, markOrderPaid } from "../src/services/adminOrderService.js";
import { ids, savedOrder, queryResult } from "./scenarioHelpers.js";

test("admin cannot skip fulfillment stages or reopen a cancelled order", async (t) => {
  const read = t.mock.method(Order, "findById", () => queryResult(savedOrder()));
  const write = t.mock.method(Order, "findOneAndUpdate", () => { throw Error("Unexpected write"); });
  await assert.rejects(updateOrderStatus({ params: { id: ids.order }, body: { status: "delivered" } }), { status: 409 });
  read.mock.mockImplementation(() => queryResult(savedOrder({ orderStatus: "cancelled" })));
  await assert.rejects(updateOrderStatus({ params: { id: ids.order }, body: { status: "confirmed" } }), { status: 409 });
  assert.equal(write.mock.callCount(), 0);
});

test("unpaid online orders cannot ship", async (t) => {
  t.mock.method(Order, "findById", () => queryResult(savedOrder({ paymentMethod: "razorpay" })));
  const write = t.mock.method(Order, "findOneAndUpdate", () => { throw Error("Unexpected fulfillment"); });
  await assert.rejects(updateOrderStatus({ params: { id: ids.order }, body: { status: "shipped" } }), { status: 409 });
  assert.equal(write.mock.callCount(), 0);
});

test("COD delivery records cash collection, history and a version-checked update", async (t) => {
  const order = savedOrder({ orderStatus: "out_for_delivery" });
  t.mock.method(Order, "findById", () => queryResult(order));
  const write = t.mock.method(Order, "findOneAndUpdate", () => queryResult({ ...order, orderStatus: "delivered", paymentStatus: "paid" }));
  const result = await updateOrderStatus({ params: { id: ids.order }, body: { status: "delivered" } });
  assert.equal(result.body.data.order.paymentStatus, "paid");
  const [filter, update] = write.mock.calls[0].arguments;
  assert.equal(filter.__v, 3);
  assert.equal(filter.orderStatus, "out_for_delivery");
  assert.deepEqual(update.$set, { orderStatus: "delivered", paymentStatus: "paid" });
  assert.equal(update.$push.paymentHistory.status, "paid");
});

test("a concurrent order update returns a conflict instead of reporting success", async (t) => {
  t.mock.method(Order, "findById", () => queryResult(savedOrder()));
  t.mock.method(Order, "findOneAndUpdate", () => queryResult(null));
  await assert.rejects(updateOrderStatus({ params: { id: ids.order }, body: { status: "shipped" } }), { status: 409 });
});

for (const [name, changes] of [
  ["online payment", { paymentMethod: "razorpay" }],
  ["cancelled COD", { orderStatus: "cancelled" }],
  ["completed return", { returnRequest: { status: "completed" } }],
]) {
  test(`admin cannot manually mark ${name} as paid`, async (t) => {
    t.mock.method(Order, "findById", () => queryResult(savedOrder(changes)));
    const write = t.mock.method(Order, "findOneAndUpdate", () => { throw Error("Unexpected payment write"); });
    await assert.rejects(markOrderPaid({ params: { id: ids.order }, body: {} }), { status: 409 });
    assert.equal(write.mock.callCount(), 0);
  });
}

test("mark-paid replay on a paid COD order adds no second payment entry", async (t) => {
  t.mock.method(Order, "findById", () => queryResult(savedOrder({ paymentStatus: "paid" })));
  const write = t.mock.method(Order, "findOneAndUpdate", () => { throw Error("Duplicate payment entry"); });
  assert.equal((await markOrderPaid({ params: { id: ids.order }, body: {} })).status, 200);
  assert.equal(write.mock.callCount(), 0);
});
