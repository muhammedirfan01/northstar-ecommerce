import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import WalletTransaction from "../src/models/WalletTransaction.js";
import { debitWallet, refundWallet, getWallet } from "../src/services/walletService.js";
import { ids, account, savedOrder, queryResult } from "./scenarioHelpers.js";

test("wallet debit checks sufficient balance and records the resulting balance in the same session", async (t) => {
  const session = {};
  const update = t.mock.method(User, "findOneAndUpdate", () => queryResult({ walletBalancePaise: 5000 }));
  const ledger = t.mock.method(WalletTransaction, "create", async () => []);
  await debitWallet(savedOrder(), account(), session);
  const [filter, changes, options] = update.mock.calls[0].arguments;
  assert.deepEqual(filter.walletBalancePaise, { $gte: 15000 });
  assert.equal(filter.authVersion, 2);
  assert.deepEqual(changes.$inc, { walletBalancePaise: -15000 });
  assert.equal(options.session, session);
  const [rows, ledgerOptions] = ledger.mock.calls[0].arguments;
  assert.equal(rows[0].amountPaise, 15000);
  assert.equal(rows[0].balanceAfterPaise, 5000);
  assert.equal(rows[0].operation, "purchase");
  assert.equal(ledgerOptions.session, session);
});

test("insufficient wallet balance cannot create a successful debit entry", async (t) => {
  t.mock.method(User, "findOneAndUpdate", () => queryResult(null));
  const ledger = t.mock.method(WalletTransaction, "create", () => { throw Error("Unexpected ledger write"); });
  await assert.rejects(debitWallet(savedOrder(), account(), {}), { status: 409 });
  assert.equal(ledger.mock.callCount(), 0);
});

test("unpaid orders cannot generate wallet refunds", async (t) => {
  const update = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Unexpected credit"); });
  const order = savedOrder({ paymentMethod: "wallet" });
  await refundWallet(order, {});
  assert.equal(order.paymentStatus, "pending");
  assert.equal(update.mock.callCount(), 0);
});

test("an existing refund ledger prevents a second balance credit", async (t) => {
  t.mock.method(WalletTransaction, "findOne", () => queryResult({ _id: ids.order }));
  const update = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Duplicate credit"); });
  const order = savedOrder({ paymentMethod: "wallet", paymentStatus: "paid" });
  await refundWallet(order, {});
  assert.equal(update.mock.callCount(), 0);
  assert.equal(order.paymentStatus, "refunded");
  assert.equal(order.refund.method, "wallet");
  assert.equal(order.refund.amount, 15000);
});

test("failed wallet credit leaves the order refund state uncompleted", async (t) => {
  t.mock.method(WalletTransaction, "findOne", () => queryResult(null));
  const update = t.mock.method(User, "findOneAndUpdate", () => queryResult(null));
  const order = savedOrder({ paymentMethod: "wallet", paymentStatus: "paid" });
  await assert.rejects(refundWallet(order, {}), { status: 409 });
  assert.equal(order.paymentStatus, "paid");
  assert.equal(order.refund.status, "none");
  assert.equal(update.mock.calls[0].arguments[0].$or[1].walletBalancePaise.$lte, Number.MAX_SAFE_INTEGER - 15000);
});

test("wallet history and totals belong to the signed-in customer and hide internal fields", async (t) => {
  t.mock.method(User, "findById", () => queryResult({ walletBalancePaise: 12345 }));
  const count = t.mock.method(WalletTransaction, "countDocuments", async () => 1);
  const find = t.mock.method(WalletTransaction, "find", () => queryResult([{
    _id: ids.product, orderId: ids.order, type: "credit", amountPaise: 12345,
    description: "Refund", secret: "private", createdAt: new Date(),
  }]));
  const result = await getWallet({ user: account(), query: {} });
  assert.equal(result.body.data.balancePaise, 12345);
  assert.deepEqual(count.mock.calls[0].arguments[0], { userId: ids.user });
  assert.deepEqual(find.mock.calls[0].arguments[0], { userId: ids.user });
  assert.equal(Object.hasOwn(result.body.data.transactions[0], "secret"), false);
});
