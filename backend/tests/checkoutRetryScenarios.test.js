import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Order from "../src/models/Order.js";
import { placeOrder } from "../src/services/checkoutService.js";
import { ids, account, savedOrder, queryResult } from "./scenarioHelpers.js";

function checkout() {
  return { addressId: ids.address, paymentMethod: "cod", expectedTotalPaise: 15000,
    couponCode: " save10 ", requestId: randomUUID() };
}
function existingOrder(body) {
  const details = [body.addressId, "SAVE10", body.paymentMethod, body.expectedTotalPaise];
  return savedOrder({ requestId: body.requestId,
    requestFingerprint: createHash("sha256").update(JSON.stringify(details)).digest("hex") });
}

test("retry after a lost checkout response returns the original order without another transaction", async (t) => {
  const body = checkout();
  const read = t.mock.method(Order, "findOne", () => queryResult(existingOrder(body)));
  const transaction = t.mock.method(mongoose, "startSession", () => { throw Error("Duplicate transaction"); });
  const result = await placeOrder({ user: account(), body });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.order.id, ids.order);
  assert.deepEqual(read.mock.calls[0].arguments[0], { userId: ids.user, requestId: body.requestId });
  assert.equal(transaction.mock.callCount(), 0);
});

test("reusing a checkout request ID with a changed total is rejected before stock changes", async (t) => {
  const body = checkout();
  t.mock.method(Order, "findOne", () => queryResult(existingOrder(body)));
  const transaction = t.mock.method(mongoose, "startSession", () => { throw Error("Unexpected transaction"); });
  await assert.rejects(placeOrder({ user: account(), body: { ...body, expectedTotalPaise: 1 } }), { status: 409 });
  assert.equal(transaction.mock.callCount(), 0);
});

test("checkout rejects browser-supplied prices, unsupported methods and excess Buy Now quantities", async (t) => {
  const read = t.mock.method(Order, "findOne", () => { throw Error("Unexpected database read"); });
  for (const changes of [
    { subtotal: 1 }, { paymentMethod: "free" }, { expectedTotalPaise: -1 },
    { buyNow: { productId: ids.product, quantity: 10 } },
  ]) {
    await assert.rejects(placeOrder({ user: account(), body: { ...checkout(), ...changes } }), { status: 400 });
  }
  assert.equal(read.mock.callCount(), 0);
});
