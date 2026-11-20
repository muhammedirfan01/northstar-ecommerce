import test from "node:test";
import assert from "node:assert/strict";
import Order from "../src/models/Order.js";
import { getOrder, getOrderFilter, listOrders } from "../src/services/customerOrderService.js";
import { ids, account, queryResult } from "./scenarioHelpers.js";

test("customer order lookup includes ownership and returns 404 for another customer's order", async (t) => {
  const read = t.mock.method(Order, "findOne", () => queryResult(null));
  await assert.rejects(getOrder({ user: account(), params: { id: ids.order } }), { status: 404 });
  assert.deepEqual(read.mock.calls[0].arguments[0], { _id: ids.order, userId: ids.user });
});

test("malformed order IDs are rejected before database access", async (t) => {
  const read = t.mock.method(Order, "findOne", () => { throw Error("Unexpected read"); });
  await assert.rejects(getOrder({ user: account(), params: { id: "bad" } }), { status: 400 });
  assert.equal(read.mock.callCount(), 0);
});

test("order searches escape special characters and retain customer ownership with filters", () => {
  const { filter } = getOrderFilter({ user: account(), query: {
    search: "NS-.*", status: "delivered", paymentStatus: "paid", returnStatus: "accepted",
  } });
  assert.equal(filter.userId, ids.user);
  assert.equal(filter.orderStatus, "delivered");
  assert.equal(filter.paymentStatus, "paid");
  assert.equal(filter["returnRequest.status"], "accepted");
  assert.equal(filter.$or[0].orderId.$regex, "NS-\\.\\*");
});

test("empty order lists clamp requested pages and return a usable pagination response", async (t) => {
  t.mock.method(Order, "countDocuments", async () => 0);
  const calls = [];
  t.mock.method(Order, "find", () => queryResult([], calls));
  const result = await listOrders({ user: account(), query: { page: "99", limit: "10" } });
  assert.deepEqual(result.body.data.pagination, { page: 1, totalPages: 1, total: 0, limit: 10 });
  assert.deepEqual(result.body.data.orders, []);
  assert.deepEqual(calls.find(call => call.method === "skip").args, [0]);
});
