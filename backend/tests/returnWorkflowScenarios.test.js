import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Order from "../src/models/Order.js";
import ReturnPhoto from "../src/models/ReturnPhoto.js";
import Product from "../src/models/Product.js";
import { requestReturn, cancelReturn, reviewReturn, completeReturn } from "../src/services/returnService.js";
import { ids, account, savedOrder, queryResult } from "./scenarioHelpers.js";

function orderFixture(t, changes = {}) {
  const order = savedOrder({ orderStatus: "delivered", paymentStatus: "paid", returnHistory: [], ...changes });
  order.save = t.mock.fn(async () => order);
  t.mock.method(Order, "findOne", () => queryResult(order));
  t.mock.method(ReturnPhoto, "init", async () => {});
  const session = { withTransaction: async (action) => action(), endSession: t.mock.fn(async () => {}) };
  t.mock.method(mongoose, "startSession", async () => session);
  return { order, session };
}

test("return submission requires a reason and packaging confirmation for enhanced forms", async (t) => {
  const read = t.mock.method(Order, "findOne", () => { throw Error("Unexpected order read"); });
  for (const body of [{ reason: "" }, { reason: "Damaged", description: "Box damaged", packagingConfirmed: false }, { reason: "Damaged", resolution: "exchange" }]) {
    await assert.rejects(requestReturn({ user: account(), params: { id: ids.order }, body }), { status: 400 });
  }
  assert.equal(read.mock.callCount(), 0);
});

test("a delivered order accepts a legacy reason-only return and snapshots its pickup address", async (t) => {
  const { order, session } = orderFixture(t);
  const result = await requestReturn({ user: account(), params: { id: ids.order }, body: { reason: "Damaged item" } });
  assert.equal(result.status, 200);
  assert.equal(order.returnRequest.status, "requested");
  assert.equal(order.returnRequest.resolution, "refund");
  assert.equal(order.returnRequest.pickupAddress.name, "Test Customer");
  assert.equal(order.save.mock.callCount(), 1);
  assert.equal(session.endSession.mock.callCount(), 1);
});

test("orders awaiting delivery cannot submit a return", async (t) => {
  const { order } = orderFixture(t, { orderStatus: "shipped" });
  await assert.rejects(requestReturn({ user: account(), params: { id: ids.order }, body: { reason: "Damaged item" } }), { status: 409 });
  assert.equal(order.save.mock.callCount(), 0);
});

test("unpaid delivered orders cannot request a replacement", async (t) => {
  const { order } = orderFixture(t, { paymentStatus: "pending" });
  await assert.rejects(requestReturn({ user: account(), params: { id: ids.order }, body: { reason: "Damaged item", resolution: "replacement" } }), { status: 409 });
  assert.equal(order.save.mock.callCount(), 0);
});

test("cancelling a requested return records once and leaves stock untouched on replay", async (t) => {
  const { order } = orderFixture(t, { returnRequest: { status: "requested", resolution: "refund", cycle: 1 } });
  const stock = t.mock.method(Product, "updateOne", () => { throw Error("Unexpected stock adjustment"); });
  const request = { user: account(), params: { id: ids.order }, body: { requestCycle: 1 } };
  await cancelReturn(request);
  await cancelReturn(request);
  assert.equal(order.returnRequest.status, "cancelled");
  assert.equal(order.save.mock.callCount(), 1);
  assert.equal(stock.mock.callCount(), 0);
});

test("admin review rejects a stale return cycle and records an accepted current request", async (t) => {
  const { order } = orderFixture(t, { returnRequest: { status: "requested", cycle: 2 } });
  const request = { user: account(), params: { id: ids.order }, body: { requestCycle: 1, decision: "accepted" } };
  await assert.rejects(reviewReturn(request), { status: 409 });
  assert.equal(order.save.mock.callCount(), 0);
  await reviewReturn({ ...request, body: { ...request.body, requestCycle: 2 } });
  assert.equal(order.returnRequest.status, "accepted");
  assert.equal(order.save.mock.callCount(), 1);
});

test("return receipt requires prior acceptance and cannot restore stock prematurely", async (t) => {
  const { order, session } = orderFixture(t, { returnRequest: { status: "requested" } });
  const stock = t.mock.method(Product, "updateOne", () => { throw Error("Unexpected stock restoration"); });
  await assert.rejects(completeReturn({ user: account(), params: { id: ids.order }, body: {} }), { status: 409 });
  assert.equal(order.save.mock.callCount(), 0);
  assert.equal(stock.mock.callCount(), 0);
  assert.equal(session.endSession.mock.callCount(), 1);
});
