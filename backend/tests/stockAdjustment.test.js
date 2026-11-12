import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Product from "../src/models/Product.js";
import StockAdjustment from "../src/models/StockAdjustment.js";
import { adjustStock, ensureStockAdjustmentIndexes } from "../src/services/stockAdjustmentService.js";

afterEach(() => mock.restoreAll());
function setup(stock = 2) {
  const state = { stock, version: 0, record: null };
  const input = {
    user: { id: "111111111111111111111111" },
    params: { id: "222222222222222222222222" },
    body: { variantId: null, quantity: 3, version: 0, requestId: randomUUID() },
  };
  mock.method(StockAdjustment, "init", async () => {});
  mock.method(StockAdjustment, "findOne", filter => {
    assert.deepEqual(Object.keys(filter), ["requestId"]);
    const value = state.record && state.record.requestId === filter.requestId
      ? state.record : null;
    const query = Promise.resolve(value);
    query.session = () => query;
    return query;
  });
  mock.method(Product, "findOne", () => ({ session: async () => ({ stock: state.stock, variants: [] }) }));
  const update = mock.method(Product, "updateOne", async (filter, changes) => {
    if (filter.__v !== state.version) return { modifiedCount: 0 };
    state.stock = changes.$set.stock;
    state.version++;
    return { modifiedCount: 1 };
  });
  const create = mock.method(StockAdjustment, "create", async ([data]) => {
    const record = new StockAdjustment(data);
    await record.validate();
    state.record = record;
    return [record];
  });
  mock.method(mongoose, "startSession", async () => ({
    async withTransaction(fn) { await fn(); }, async endSession() {},
  }));
  return { state, input, update, create };
}

for (const [quantity, after] of [[3, 5], [-1, 1]]) {
  test(`signed adjustment ${quantity} preserves before/after history`, async () => {
    const s = setup();
    s.input.body.quantity = quantity;
    const result = await adjustStock(s.input);
    assert.equal(result.status, 201);
    assert.equal(s.state.stock, after);
    assert.equal(s.state.record.before, 2);
    assert.equal(s.state.record.after, after);
    assert.equal(s.create.mock.calls[0].arguments[0][0].adminId, undefined);
    assert.equal(s.state.record.quantity, quantity);
    assert.equal(s.state.record.version, s.input.body.version);
    assert.equal(s.create.mock.calls[0].arguments[0][0].fingerprint, undefined);
    assert.equal(s.state.record.get("type"), undefined);
    assert.equal(s.state.record.get("reason"), undefined);
    assert.equal(StockAdjustment.schema.path("reason"), undefined);
  });
}

test("retrying the same adjustment does not change stock twice", async () => {
  const s = setup();
  await adjustStock(s.input);
  const repeat = await adjustStock(s.input);
  assert.equal(repeat.status, 200);
  assert.equal(s.state.stock, 5);
  assert.equal(s.update.mock.calls.length, 1);
  assert.equal(s.create.mock.calls.length, 1);
});

for (const changed of ["product", "variant", "quantity", "version"]) {
  test(`reusing a request ID with a different ${changed} is rejected`, async () => {
    const s = setup();
    await adjustStock(s.input);
    if (changed === "product") s.input.params.id = "333333333333333333333333";
    if (changed === "variant") s.input.body.variantId = "444444444444444444444444";
    if (changed === "quantity") s.input.body.quantity = 4;
    if (changed === "version") s.input.body.version = 1;
    await assert.rejects(adjustStock(s.input), { status: 409 });
    assert.equal(s.state.stock, 5);
    assert.equal(s.update.mock.calls.length, 1);
  });
}

test("a negative adjustment cannot make stock negative", async () => {
  const s = setup();
  s.input.body.quantity = -3;
  await assert.rejects(adjustStock(s.input), { status: 400 });
  assert.equal(s.update.mock.calls.length, 0);
  assert.equal(s.create.mock.calls.length, 0);
});

test("a stale stock version cannot overwrite a newer adjustment", async () => {
  const s = setup();
  s.state.version = 1;
  await assert.rejects(adjustStock(s.input), { status: 409 });
  assert.equal(s.state.stock, 2);
  assert.equal(s.create.mock.calls.length, 0);
});

test("stock index cleanup protects requestId before removing only the old admin index", async () => {
  const calls = [];
  mock.method(StockAdjustment, "init", async () => {});
  mock.method(StockAdjustment.collection, "createIndex", async (key, options) => {
    assert.deepEqual(key, { requestId: 1 });
    assert.equal(options.unique, true);
    calls.push("create");
  });
  mock.method(StockAdjustment.collection, "indexes", async () => [
    { name: "_id_", key: { _id: 1 } },
    { name: "requestId_1", key: { requestId: 1 }, unique: true },
    { name: "adminId_1_requestId_1", key: { adminId: 1, requestId: 1 }, unique: true },
    { name: "productId_1", key: { productId: 1 } },
  ]);
  mock.method(StockAdjustment.collection, "dropIndex", async name => {
    assert.equal(name, "adminId_1_requestId_1");
    calls.push("drop");
  });
  await ensureStockAdjustmentIndexes();
  assert.deepEqual(calls, ["create", "drop"]);
});

test("a failed unique index creation keeps the old index intact", async () => {
  mock.method(StockAdjustment, "init", async () => {});
  mock.method(StockAdjustment.collection, "createIndex", async () => { throw Error("duplicate request IDs"); });
  const drop = mock.method(StockAdjustment.collection, "dropIndex", async () => {});
  await assert.rejects(ensureStockAdjustmentIndexes(), /duplicate request IDs/);
  assert.equal(drop.mock.calls.length, 0);
});
